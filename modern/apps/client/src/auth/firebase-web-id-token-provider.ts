import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  onIdTokenChanged,
  signInWithCustomToken,
  type Auth,
  type User,
} from 'firebase/auth';
import type { FirebaseClientRuntimeConfig } from '../client-runtime-config.ts';
import type { ExternalIdTokenProvider } from './external-id-token-provider.ts';

export interface FirebaseWebIdTokenProviderOptions {
  config: FirebaseClientRuntimeConfig;
}

function toFirebaseOptions(config: FirebaseClientRuntimeConfig): FirebaseOptions {
  return {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    appId: config.appId,
    messagingSenderId: config.messagingSenderId,
    storageBucket: config.storageBucket,
    measurementId: config.measurementId,
  };
}

function resolveFirebaseApp(config: FirebaseClientRuntimeConfig): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(toFirebaseOptions(config));
}

let connectedAuthEmulatorUrl: string | null = null;

function maybeConnectAuthEmulator(auth: Auth, emulatorUrl: string | undefined): void {
  const target = emulatorUrl?.trim();
  if (!target) {
    return;
  }
  if (connectedAuthEmulatorUrl === target) {
    return;
  }

  connectAuthEmulator(auth, target, { disableWarnings: true });
  connectedAuthEmulatorUrl = target;
}

async function tryReadUserIdToken(user: User | null): Promise<string | null> {
  if (!user) {
    return null;
  }
  const token = await user.getIdToken();
  return token.trim().length > 0 ? token : null;
}

export function createFirebaseWebIdTokenProvider(options: FirebaseWebIdTokenProviderOptions): ExternalIdTokenProvider {
  const app = resolveFirebaseApp(options.config);
  const auth = getAuth(app);
  maybeConnectAuthEmulator(auth, options.config.authEmulatorUrl);

  let attemptedCustomTokenSignIn = false;

  async function ensureCustomTokenSignIn(): Promise<void> {
    const customToken = options.config.customToken?.trim();
    if (!customToken || attemptedCustomTokenSignIn || auth.currentUser) {
      return;
    }

    attemptedCustomTokenSignIn = true;
    await signInWithCustomToken(auth, customToken);
  }

  return {
    providerName: 'firebase',
    async getIdToken(): Promise<string | null> {
      try {
        await ensureCustomTokenSignIn();
        return await tryReadUserIdToken(auth.currentUser);
      } catch {
        return null;
      }
    },
    subscribe(listener: (idToken: string | null) => void): () => void {
      void ensureCustomTokenSignIn().catch(() => {
        listener(null);
      });

      const unsubscribe = onIdTokenChanged(auth, (user) => {
        void tryReadUserIdToken(user)
          .then((token) => {
            listener(token);
          })
          .catch(() => {
            listener(null);
          });
      });

      return () => {
        unsubscribe();
      };
    },
  };
}
