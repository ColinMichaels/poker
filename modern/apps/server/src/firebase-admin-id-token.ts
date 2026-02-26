import fs from 'node:fs';
import type { UserRole } from '@poker/game-contracts';
import type { FirebaseExternalIdentity, FirebaseIdTokenVerificationOptions } from './firebase-id-token.ts';

const ALLOWED_USER_ROLES: readonly UserRole[] = ['PLAYER', 'OPERATOR', 'ADMIN'];

type DynamicImportFn = (moduleName: string) => Promise<unknown>;

interface FirebaseAdminAppModule {
  getApps: () => unknown[];
  initializeApp: (options?: Record<string, unknown>) => unknown;
  cert?: (serviceAccount: Record<string, unknown>) => unknown;
}

interface FirebaseAdminAuthModule {
  getAuth: (app?: unknown) => {
    verifyIdToken: (idToken: string) => Promise<Record<string, unknown>>;
  };
}

export interface FirebaseAdminIdTokenVerifierOptions {
  serviceAccountFile?: string;
  importModule?: DynamicImportFn;
}

function defaultDynamicImport(moduleName: string): Promise<unknown> {
  return new Function('name', 'return import(name);')(moduleName) as Promise<unknown>;
}

function normalizeRole(value: unknown): UserRole | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string' && ALLOWED_USER_ROLES.includes(value as UserRole)) {
    return value as UserRole;
  }

  throw new Error(`Firebase ID token role claim is invalid: ${String(value)}.`);
}

function toUnixTimeMs(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Firebase ID token ${label} claim is invalid.`);
  }

  return Math.trunc(value * 1000);
}

function defaultNameParts(fullName: string): { firstName?: string; lastName?: string } {
  const normalized = fullName.trim();
  if (!normalized) {
    return {};
  }

  const parts = normalized.split(/\s+/g);
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

async function loadFirebaseAdminModules(importModule: DynamicImportFn): Promise<{
  appModule: FirebaseAdminAppModule;
  authModule: FirebaseAdminAuthModule;
}> {
  try {
    const appModule = await importModule('firebase-admin/app') as FirebaseAdminAppModule;
    const authModule = await importModule('firebase-admin/auth') as FirebaseAdminAuthModule;

    if (
      typeof appModule.getApps !== 'function'
      || typeof appModule.initializeApp !== 'function'
      || typeof authModule.getAuth !== 'function'
    ) {
      throw new Error('Firebase Admin SDK modules are missing required exports.');
    }

    return { appModule, authModule };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Firebase Admin SDK module load failed: ${message}`);
  }
}

function parseServiceAccountFile(serviceAccountFile: string): Record<string, unknown> {
  if (!fs.existsSync(serviceAccountFile)) {
    throw new Error(`Firebase service account file was not found: ${serviceAccountFile}`);
  }

  const text = fs.readFileSync(serviceAccountFile, 'utf8').trim();
  if (!text) {
    throw new Error(`Firebase service account file is empty: ${serviceAccountFile}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Firebase service account file parse failed: ${message}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Firebase service account file must contain an object payload.');
  }

  return parsed as Record<string, unknown>;
}

function validateDecodedToken(
  decoded: Record<string, unknown>,
  options: FirebaseIdTokenVerificationOptions,
): FirebaseExternalIdentity {
  const projectId = options.projectId.trim();
  if (!projectId) {
    throw new Error('Firebase project id is required for ID token verification.');
  }

  const expectedAudience = options.audience?.trim() || projectId;
  const expectedIssuer = options.issuer?.trim() || `https://securetoken.google.com/${projectId}`;
  const nowMs = options.nowMs ?? Date.now();

  const issuer = typeof decoded.iss === 'string' ? decoded.iss : '';
  if (issuer !== expectedIssuer) {
    throw new Error('Firebase ID token issuer is invalid.');
  }

  const audience = typeof decoded.aud === 'string' ? decoded.aud : '';
  if (audience !== expectedAudience) {
    throw new Error('Firebase ID token audience is invalid.');
  }

  const subject = typeof decoded.uid === 'string'
    ? decoded.uid.trim()
    : typeof decoded.sub === 'string'
      ? decoded.sub.trim()
      : '';
  if (!subject || subject.length > 128) {
    throw new Error('Firebase ID token subject is invalid.');
  }

  const expMs = toUnixTimeMs(decoded.exp, 'exp');
  if (expMs <= nowMs) {
    throw new Error('Firebase ID token has expired.');
  }

  const issuedAtMs = toUnixTimeMs(decoded.iat, 'iat');
  if (issuedAtMs > nowMs + 60_000) {
    throw new Error('Firebase ID token issued-at time is invalid.');
  }

  const email = typeof decoded.email === 'string' ? decoded.email.trim().toLowerCase() : '';
  if (!email) {
    throw new Error('Firebase ID token email claim is required.');
  }

  const explicitFirstName = typeof decoded.given_name === 'string' ? decoded.given_name.trim() : '';
  const explicitLastName = typeof decoded.family_name === 'string' ? decoded.family_name.trim() : '';
  const fullName = typeof decoded.name === 'string' ? decoded.name : '';
  const defaultNames = defaultNameParts(fullName);
  const firstName = explicitFirstName || defaultNames.firstName;
  const lastName = explicitLastName || defaultNames.lastName;

  return {
    provider: 'firebase',
    subject,
    email,
    firstName,
    lastName,
    role: normalizeRole(decoded.role),
  };
}

export function createFirebaseAdminIdTokenVerifier(
  options: FirebaseAdminIdTokenVerifierOptions = {},
): (
  idToken: string,
  verificationOptions: FirebaseIdTokenVerificationOptions,
) => Promise<FirebaseExternalIdentity> {
  const importModule = options.importModule ?? defaultDynamicImport;
  const serviceAccountFile = options.serviceAccountFile?.trim();
  let initializedApp: unknown | undefined;
  let initializedAuth:
    | {
      verifyIdToken: (idToken: string) => Promise<Record<string, unknown>>;
    }
    | null = null;

  async function ensureAuth(projectId: string): Promise<{
    verifyIdToken: (idToken: string) => Promise<Record<string, unknown>>;
  }> {
    if (initializedAuth) {
      return initializedAuth;
    }

    const { appModule, authModule } = await loadFirebaseAdminModules(importModule);
    if (appModule.getApps().length > 0) {
      initializedApp = appModule.getApps()[0];
    } else {
      const appOptions: Record<string, unknown> = {};
      if (projectId) {
        appOptions.projectId = projectId;
      }

      if (serviceAccountFile) {
        if (typeof appModule.cert !== 'function') {
          throw new Error('Firebase Admin SDK cert() export is not available.');
        }

        const serviceAccount = parseServiceAccountFile(serviceAccountFile);
        appOptions.credential = appModule.cert(serviceAccount);
      }

      initializedApp = appModule.initializeApp(Object.keys(appOptions).length > 0 ? appOptions : undefined);
    }

    initializedAuth = authModule.getAuth(initializedApp);
    return initializedAuth;
  }

  return async (idToken: string, verificationOptions: FirebaseIdTokenVerificationOptions): Promise<FirebaseExternalIdentity> => {
    const trimmedToken = idToken.trim();
    if (!trimmedToken) {
      throw new Error('Firebase ID token is required.');
    }

    try {
      const auth = await ensureAuth(verificationOptions.projectId);
      const decoded = await auth.verifyIdToken(trimmedToken);
      return validateDecodedToken(decoded, verificationOptions);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith('Firebase ID token')) {
        throw error;
      }
      throw new Error(`Firebase ID token verification failed: ${message}`);
    }
  };
}
