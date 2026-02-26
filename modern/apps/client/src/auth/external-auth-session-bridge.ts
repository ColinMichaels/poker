import type { AuthSessionDTO } from '@poker/game-contracts';
import type { ExternalIdTokenProvider } from './external-id-token-provider.ts';
import {
  clearStoredServerSession,
  readStoredServerSession,
  writeStoredServerSession,
  type StorageLike,
  type StoredServerSession,
} from './server-session-store.ts';

export type ExternalAuthSessionStatus = 'disabled' | 'waiting_for_identity' | 'linking' | 'linked' | 'error';

export interface ExternalAuthSessionState {
  status: ExternalAuthSessionStatus;
  provider: string | null;
  message: string;
  storedSession: StoredServerSession | null;
}

interface ExternalAuthSessionBridgeOptions {
  loginUrl: string;
  tokenProvider: ExternalIdTokenProvider | null;
  fetchImpl?: typeof fetch;
  storage?: StorageLike | null;
  storageKey?: string;
}

interface LoginResponseBody {
  session?: AuthSessionDTO;
  error?: string;
  message?: string;
}

type StateListener = (state: ExternalAuthSessionState) => void;

function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function toLoginResponseBody(payload: unknown): LoginResponseBody {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return {};
  }
  return payload as LoginResponseBody;
}

function ensureSession(payload: unknown): AuthSessionDTO {
  const body = toLoginResponseBody(payload);
  const session = body.session;
  if (!session || typeof session !== 'object') {
    throw new Error('External login response is missing session payload.');
  }
  if (typeof session.token !== 'string' || session.token.trim().length === 0) {
    throw new Error('External login response session token is invalid.');
  }
  if (!session.user || typeof session.user !== 'object') {
    throw new Error('External login response session user is invalid.');
  }
  if (typeof session.user.email !== 'string' || session.user.email.trim().length === 0) {
    throw new Error('External login response user email is invalid.');
  }

  return session;
}

async function exchangeFirebaseIdToken(options: {
  loginUrl: string;
  idToken: string;
  fetchImpl: typeof fetch;
}): Promise<AuthSessionDTO> {
  const response = await options.fetchImpl(options.loginUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${options.idToken}`,
    },
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const body = toLoginResponseBody(payload);
    const code = typeof body.error === 'string' ? body.error : `HTTP_${response.status}`;
    const detail = typeof body.message === 'string' ? body.message : response.statusText;
    throw new Error(`External auth login failed (${code}): ${detail || 'Unknown error'}`);
  }

  return ensureSession(payload);
}

export interface ExternalAuthSessionBridge {
  start(): Promise<void>;
  stop(): void;
  getState(): ExternalAuthSessionState;
  subscribe(listener: StateListener): () => void;
}

export function createExternalAuthSessionBridge(options: ExternalAuthSessionBridgeOptions): ExternalAuthSessionBridge {
  const fetchImpl = options.fetchImpl ?? fetch;
  const listeners = new Set<StateListener>();
  let unsubscribeTokenListener: (() => void) | null = null;
  let started = false;
  let exchangeSequence = 0;
  let lastExchangedToken: string | null = null;
  let inFlightToken: string | null = null;

  const initialStoredSession = readStoredServerSession({
    storage: options.storage,
    storageKey: options.storageKey,
  });

  let state: ExternalAuthSessionState = {
    status: options.tokenProvider ? 'waiting_for_identity' : 'disabled',
    provider: options.tokenProvider?.providerName ?? null,
    message: options.tokenProvider ? 'Waiting for external identity token.' : 'External auth bridge disabled.',
    storedSession: initialStoredSession,
  };

  function emitState(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  function updateState(nextState: ExternalAuthSessionState): void {
    state = nextState;
    emitState();
  }

  async function handleToken(idToken: string | null): Promise<void> {
    if (!started || !options.tokenProvider) {
      return;
    }

    const trimmedToken = idToken?.trim() || '';
    if (!trimmedToken) {
      exchangeSequence += 1;
      lastExchangedToken = null;
      inFlightToken = null;
      clearStoredServerSession({
        storage: options.storage,
        storageKey: options.storageKey,
      });
      updateState({
        status: 'waiting_for_identity',
        provider: options.tokenProvider.providerName,
        message: 'Waiting for external identity token.',
        storedSession: null,
      });
      return;
    }

    if (trimmedToken === lastExchangedToken && state.status === 'linked') {
      return;
    }
    if (trimmedToken === inFlightToken && state.status === 'linking') {
      return;
    }

    const currentSequence = ++exchangeSequence;
    inFlightToken = trimmedToken;
    updateState({
      status: 'linking',
      provider: options.tokenProvider.providerName,
      message: 'Linking Firebase identity to server session.',
      storedSession: state.storedSession,
    });

    try {
      const session = await exchangeFirebaseIdToken({
        loginUrl: options.loginUrl,
        idToken: trimmedToken,
        fetchImpl,
      });

      if (!started || currentSequence !== exchangeSequence) {
        return;
      }

      lastExchangedToken = trimmedToken;
      inFlightToken = null;
      writeStoredServerSession(session, {
        storage: options.storage,
        storageKey: options.storageKey,
      });
      const storedSession = readStoredServerSession({
        storage: options.storage,
        storageKey: options.storageKey,
      });
      updateState({
        status: 'linked',
        provider: options.tokenProvider.providerName,
        message: `Linked as ${session.user.email}.`,
        storedSession,
      });
    } catch (error) {
      if (!started || currentSequence !== exchangeSequence) {
        return;
      }

      inFlightToken = null;
      updateState({
        status: 'error',
        provider: options.tokenProvider.providerName,
        message: sanitizeErrorMessage(error),
        storedSession: state.storedSession,
      });
    }
  }

  return {
    async start(): Promise<void> {
      if (started) {
        return;
      }
      started = true;

      if (!options.tokenProvider) {
        emitState();
        return;
      }

      unsubscribeTokenListener = options.tokenProvider.subscribe((idToken) => {
        void handleToken(idToken);
      });

      const initialToken = await options.tokenProvider.getIdToken();
      await handleToken(initialToken);
    },
    stop(): void {
      started = false;
      exchangeSequence += 1;
      lastExchangedToken = null;
      inFlightToken = null;
      if (unsubscribeTokenListener) {
        unsubscribeTokenListener();
        unsubscribeTokenListener = null;
      }
    },
    getState(): ExternalAuthSessionState {
      return state;
    },
    subscribe(listener: StateListener): () => void {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
