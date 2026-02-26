export type ExternalAuthMode = 'disabled' | 'firebase_id_token';
export type TableRuntimeMode = 'local' | 'server';

export interface FirebaseClientRuntimeConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
  measurementId?: string;
  authEmulatorUrl?: string;
  customToken?: string;
}

export interface ClientRuntimeConfig {
  apiBaseUrl: string;
  externalAuthMode: ExternalAuthMode;
  externalAuthLoginPath: string;
  tableRuntimeMode: TableRuntimeMode;
  tablePollIntervalMs: number;
  firebase: FirebaseClientRuntimeConfig | null;
}

function normalizeBaseUrl(value: string | undefined): string {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function normalizePath(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parsePositiveInteger(rawValue: string | undefined, fallback: number): number {
  if (!rawValue || rawValue.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function resolveExternalAuthMode(env: ImportMetaEnv, firebaseConfig: FirebaseClientRuntimeConfig | null): ExternalAuthMode {
  const rawMode = normalizeOptional(env.VITE_EXTERNAL_AUTH_MODE)?.toLowerCase();
  if (!rawMode) {
    return firebaseConfig ? 'firebase_id_token' : 'disabled';
  }

  if (rawMode === 'firebase_id_token') {
    return 'firebase_id_token';
  }

  return 'disabled';
}

function loadFirebaseConfig(env: ImportMetaEnv): FirebaseClientRuntimeConfig | null {
  const apiKey = normalizeOptional(env.VITE_FIREBASE_API_KEY);
  const authDomain = normalizeOptional(env.VITE_FIREBASE_AUTH_DOMAIN);
  const projectId = normalizeOptional(env.VITE_FIREBASE_PROJECT_ID);
  const appId = normalizeOptional(env.VITE_FIREBASE_APP_ID);

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId: normalizeOptional(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
    storageBucket: normalizeOptional(env.VITE_FIREBASE_STORAGE_BUCKET),
    measurementId: normalizeOptional(env.VITE_FIREBASE_MEASUREMENT_ID),
    authEmulatorUrl: normalizeOptional(env.VITE_FIREBASE_AUTH_EMULATOR_URL),
    customToken: normalizeOptional(env.VITE_FIREBASE_AUTH_CUSTOM_TOKEN),
  };
}

function resolveTableRuntimeMode(env: ImportMetaEnv): TableRuntimeMode {
  const rawMode = normalizeOptional(env.VITE_TABLE_RUNTIME_MODE)?.toLowerCase();
  return rawMode === 'server' ? 'server' : 'local';
}

export function loadClientRuntimeConfig(env: ImportMetaEnv = import.meta.env): ClientRuntimeConfig {
  const firebaseConfig = loadFirebaseConfig(env);
  return {
    apiBaseUrl: normalizeBaseUrl(env.VITE_API_BASE_URL),
    externalAuthMode: resolveExternalAuthMode(env, firebaseConfig),
    externalAuthLoginPath: normalizePath(env.VITE_EXTERNAL_AUTH_LOGIN_PATH, '/api/auth/external/login'),
    tableRuntimeMode: resolveTableRuntimeMode(env),
    tablePollIntervalMs: parsePositiveInteger(env.VITE_TABLE_POLL_INTERVAL_MS, 900),
    firebase: firebaseConfig,
  };
}
