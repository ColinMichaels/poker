import { createFirebaseAdminIdTokenVerifier } from './firebase-admin-id-token.ts';
import type { FirebaseExternalIdentity, FirebaseIdTokenVerificationOptions } from './firebase-id-token.ts';
import { verifyFirebaseIdToken } from './firebase-id-token.ts';
import type { FirebaseVerifierMode } from './startup-config.ts';

export type FirebaseIdTokenVerifierFn = (
  idToken: string,
  options: FirebaseIdTokenVerificationOptions,
) => Promise<FirebaseExternalIdentity>;

export interface FirebaseIdTokenVerifierFactoryOptions {
  verifierMode: FirebaseVerifierMode;
  firebaseAdminServiceAccountFile?: string;
}

export function createFirebaseIdTokenVerifier(
  options: FirebaseIdTokenVerifierFactoryOptions,
): FirebaseIdTokenVerifierFn {
  if (options.verifierMode === 'admin_sdk') {
    return createFirebaseAdminIdTokenVerifier({
      serviceAccountFile: options.firebaseAdminServiceAccountFile,
    });
  }

  return verifyFirebaseIdToken;
}
