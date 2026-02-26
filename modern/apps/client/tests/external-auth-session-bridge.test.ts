import type { AuthSessionDTO } from '@poker/game-contracts';
import { describe, expect, it } from 'vitest';
import {
  createExternalAuthSessionBridge,
  type ExternalAuthSessionState,
} from '../src/auth/external-auth-session-bridge.ts';
import type { ExternalIdTokenProvider } from '../src/auth/external-id-token-provider.ts';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.has(key) ? this.values.get(key) ?? null : null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

class FakeTokenProvider implements ExternalIdTokenProvider {
  public readonly providerName = 'firebase';
  private token: string | null;
  private readonly listeners = new Set<(idToken: string | null) => void>();

  public constructor(initialToken: string | null) {
    this.token = initialToken;
  }

  public async getIdToken(): Promise<string | null> {
    return this.token;
  }

  public subscribe(listener: (idToken: string | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public emit(nextToken: string | null): void {
    this.token = nextToken;
    for (const listener of this.listeners) {
      listener(nextToken);
    }
  }
}

function makeSession(email: string): AuthSessionDTO {
  return {
    token: 'server-session-token',
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
    user: {
      id: 1,
      email,
      firstName: 'Poker',
      lastName: 'Player',
      displayName: 'Poker Player',
      role: 'PLAYER',
      wallet: {
        userId: 1,
        balance: 500,
        wins: 0,
        gamesPlayed: 0,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  };
}

async function waitForState(
  getState: () => ExternalAuthSessionState,
  predicate: (state: ExternalAuthSessionState) => boolean,
): Promise<ExternalAuthSessionState> {
  const startedAt = Date.now();
  for (;;) {
    const state = getState();
    if (predicate(state)) {
      return state;
    }
    if (Date.now() - startedAt > 1_000) {
      throw new Error(`Timed out waiting for state. Last state: ${JSON.stringify(state)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('external auth session bridge', () => {
  it('stays disabled when no token provider is configured', async () => {
    const fetchCalls: string[] = [];
    const bridge = createExternalAuthSessionBridge({
      loginUrl: '/api/auth/external/login',
      tokenProvider: null,
      fetchImpl: (async (url: string) => {
        fetchCalls.push(url);
        return new Response('{}', { status: 500 });
      }) as typeof fetch,
    });

    await bridge.start();
    expect(bridge.getState().status).toBe('disabled');
    expect(fetchCalls).toHaveLength(0);
  });

  it('exchanges initial firebase id token and stores linked session', async () => {
    const provider = new FakeTokenProvider('firebase-id-token-1');
    const storage = new MemoryStorage();
    const fetchCalls: string[] = [];
    const bridge = createExternalAuthSessionBridge({
      loginUrl: '/api/auth/external/login',
      tokenProvider: provider,
      storage,
      fetchImpl: (async (url: string) => {
        fetchCalls.push(url);
        return new Response(JSON.stringify({ session: makeSession('player@example.com') }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      }) as typeof fetch,
    });

    await bridge.start();
    const linked = await waitForState(bridge.getState, (state) => state.status === 'linked');
    expect(linked.storedSession?.userEmail).toBe('player@example.com');
    expect(fetchCalls).toEqual(['/api/auth/external/login']);

    provider.emit('firebase-id-token-1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchCalls).toHaveLength(1);
  });

  it('clears stored session and waits when firebase token is missing', async () => {
    const provider = new FakeTokenProvider(null);
    const storage = new MemoryStorage();
    storage.setItem(
      'poker.server.session',
      JSON.stringify({
        token: 'old',
        userEmail: 'old@example.com',
        userDisplayName: 'Old User',
        expiresAt: null,
      }),
    );

    const bridge = createExternalAuthSessionBridge({
      loginUrl: '/api/auth/external/login',
      tokenProvider: provider,
      storage,
      fetchImpl: (async () => new Response('{}', { status: 200 })) as typeof fetch,
    });

    await bridge.start();
    const waiting = await waitForState(bridge.getState, (state) => state.status === 'waiting_for_identity');
    expect(waiting.storedSession).toBeNull();
    expect(storage.getItem('poker.server.session')).toBeNull();
  });

  it('deduplicates repeated token emissions during an in-flight exchange', async () => {
    const provider = new FakeTokenProvider(null);
    const fetchCalls: string[] = [];
    const bridge = createExternalAuthSessionBridge({
      loginUrl: '/api/auth/external/login',
      tokenProvider: provider,
      fetchImpl: (async (url: string) => {
        fetchCalls.push(url);
        await new Promise((resolve) => setTimeout(resolve, 10));
        return new Response(JSON.stringify({ session: makeSession('player@example.com') }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      }) as typeof fetch,
    });

    await bridge.start();
    provider.emit('firebase-id-token-repeat');
    provider.emit('firebase-id-token-repeat');
    await waitForState(bridge.getState, (state) => state.status === 'linked');
    expect(fetchCalls).toHaveLength(1);
  });

  it('surfaces exchange errors', async () => {
    const provider = new FakeTokenProvider('firebase-id-token-error');
    const bridge = createExternalAuthSessionBridge({
      loginUrl: '/api/auth/external/login',
      tokenProvider: provider,
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            error: 'EXTERNAL_AUTH_DISABLED',
            message: 'External auth is currently disabled.',
          }),
          {
            status: 503,
            headers: {
              'content-type': 'application/json',
            },
          },
        )) as typeof fetch,
    });

    await bridge.start();
    const errored = await waitForState(bridge.getState, (state) => state.status === 'error');
    expect(errored.message).toContain('EXTERNAL_AUTH_DISABLED');
  });
});
