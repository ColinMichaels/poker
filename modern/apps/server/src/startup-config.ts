import fs from 'node:fs';
import type { UserRole } from '@poker/game-contracts';
import type { AuthUserSeedRecord } from './auth-wallet-service.ts';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const DEFAULT_TABLE_ID = 'table-1';
const DEFAULT_TABLE_WS_COMMAND_RATE_LIMIT_WINDOW_MS = 1_000;
const DEFAULT_TABLE_WS_COMMAND_RATE_LIMIT_MAX = 30;
const DEFAULT_TABLE_WS_COMMAND_MAX_IN_FLIGHT = 4;
const DEFAULT_EXTERNAL_AUTH_ISSUER = 'external-idp';
const DEFAULT_EXTERNAL_AUTH_MODE = 'signed_assertion';
const DEFAULT_FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const DEFAULT_FIREBASE_VERIFIER = 'jwt';
const ALLOWED_USER_ROLES: readonly UserRole[] = ['PLAYER', 'OPERATOR', 'ADMIN'];
const ALLOWED_EXTERNAL_AUTH_MODES: readonly ExternalAuthMode[] = [
  'signed_assertion',
  'trusted_headers',
  'firebase_id_token',
];
const ALLOWED_FIREBASE_VERIFIERS: readonly FirebaseVerifierMode[] = ['jwt', 'admin_sdk'];

function parsePort(rawValue: string | undefined): number {
  if (!rawValue) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid PORT value: ${rawValue}`);
  }

  return parsed;
}

function parsePersistenceEnabled(rawValue: string | undefined): boolean {
  if (rawValue === undefined) {
    return true;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid POKER_STATE_PERSIST value: ${rawValue}`);
}

function parseSessionTtlMs(rawValue: string | undefined): number | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid POKER_SESSION_TTL_MS value: ${rawValue}`);
  }

  return parsed;
}

function parsePositiveIntegerEnvWithDefault(rawValue: string | undefined, fallback: number, label: string): number {
  if (rawValue === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label} value: ${rawValue}`);
  }

  return parsed;
}

function parseBooleanEnv(rawValue: string, label: string): boolean {
  const normalized = rawValue.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid ${label} value: ${rawValue}`);
}

function parseAllowDemoUsers(rawValue: string | undefined, nodeEnv: string | undefined): boolean {
  if (rawValue !== undefined) {
    return parseBooleanEnv(rawValue, 'POKER_AUTH_ALLOW_DEMO_USERS');
  }

  const normalizedNodeEnv = nodeEnv?.trim().toLowerCase();
  return normalizedNodeEnv !== 'production';
}

function parseAllowLegacyWalletRoutes(rawValue: string | undefined, nodeEnv: string | undefined): boolean {
  if (rawValue !== undefined) {
    return parseBooleanEnv(rawValue, 'POKER_ENABLE_LEGACY_WALLET_ROUTES');
  }

  const normalizedNodeEnv = nodeEnv?.trim().toLowerCase();
  return normalizedNodeEnv !== 'production';
}

function parseExternalAuthEnabled(rawValue: string | undefined): boolean {
  if (rawValue === undefined) {
    return false;
  }

  return parseBooleanEnv(rawValue, 'POKER_EXTERNAL_AUTH_ENABLED');
}

export type ExternalAuthMode = 'signed_assertion' | 'trusted_headers' | 'firebase_id_token';
export type FirebaseVerifierMode = 'jwt' | 'admin_sdk';

function parseExternalAuthMode(rawValue: string | undefined): ExternalAuthMode {
  if (rawValue === undefined) {
    return DEFAULT_EXTERNAL_AUTH_MODE;
  }

  const normalized = rawValue.trim().toLowerCase().replace(/-/g, '_');
  if (ALLOWED_EXTERNAL_AUTH_MODES.includes(normalized as ExternalAuthMode)) {
    return normalized as ExternalAuthMode;
  }

  throw new Error(`Invalid POKER_EXTERNAL_AUTH_MODE value: ${rawValue}`);
}

function parseFirebaseVerifierMode(rawValue: string | undefined): FirebaseVerifierMode {
  if (rawValue === undefined) {
    return DEFAULT_FIREBASE_VERIFIER;
  }

  const normalized = rawValue.trim().toLowerCase().replace(/-/g, '_');
  if (ALLOWED_FIREBASE_VERIFIERS.includes(normalized as FirebaseVerifierMode)) {
    return normalized as FirebaseVerifierMode;
  }

  throw new Error(`Invalid POKER_EXTERNAL_AUTH_FIREBASE_VERIFIER value: ${rawValue}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && ALLOWED_USER_ROLES.includes(value as UserRole);
}

function loadBootstrapUsersFromFile(filePathValue: string | undefined): AuthUserSeedRecord[] | undefined {
  const filePath = filePathValue?.trim();
  if (!filePath) {
    return undefined;
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`POKER_AUTH_BOOTSTRAP_USERS_FILE does not exist: ${filePath}`);
  }

  const rawText = fs.readFileSync(filePath, 'utf8').trim();
  if (rawText.length === 0) {
    throw new Error(`POKER_AUTH_BOOTSTRAP_USERS_FILE is empty: ${filePath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse POKER_AUTH_BOOTSTRAP_USERS_FILE JSON: ${message}`);
  }

  const users = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.users)
      ? parsed.users
      : null;

  if (!users || users.length === 0) {
    throw new Error('Bootstrap users file must contain at least one user record.');
  }

  const normalizedUsers = users.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error('Bootstrap users file must contain object records only.');
    }

    if (typeof entry.email !== 'string' || entry.email.trim().length === 0) {
      throw new Error(`Bootstrap user at index ${index} must include a non-empty email.`);
    }

    const hasPassword = typeof entry.password === 'string' && entry.password.length > 0;
    const hasPasswordHash = typeof entry.passwordHash === 'string' && entry.passwordHash.length > 0;
    if (!hasPassword && !hasPasswordHash) {
      throw new Error(`Bootstrap user at index ${index} must include password or passwordHash.`);
    }

    if (entry.role !== undefined && !isValidUserRole(entry.role)) {
      throw new Error(`Bootstrap user at index ${index} must use role PLAYER, OPERATOR, or ADMIN when provided.`);
    }

    return entry as unknown as AuthUserSeedRecord;
  });

  return normalizedUsers;
}

function defaultStateFilePath(): string {
  return decodeURIComponent(new URL('../.data/runtime-state.json', import.meta.url).pathname);
}

export interface StartupConfig {
  isProduction: boolean;
  port: number;
  host: string;
  tableId: string;
  persistenceEnabled: boolean;
  stateFilePath: string;
  authTokenSecret: string | undefined;
  authSessionTtlMs: number | undefined;
  authAllowDemoUsers: boolean;
  authBootstrapUsersFile: string | undefined;
  authBootstrapUsers: AuthUserSeedRecord[] | undefined;
  allowLegacyWalletRoutes: boolean;
  tableWsCommandChannelEnabled: boolean;
  tableWsCommandRateLimitWindowMs: number;
  tableWsCommandRateLimitMax: number;
  tableWsCommandMaxInFlight: number;
  externalAuthEnabled: boolean;
  externalAuthMode: ExternalAuthMode;
  externalAuthIssuer: string;
  externalAuthSharedSecret: string | undefined;
  externalAuthSharedSecretPrevious: string | undefined;
  externalAuthProxySharedSecret: string | undefined;
  externalAuthFirebaseProjectId: string | undefined;
  externalAuthFirebaseAudience: string | undefined;
  externalAuthFirebaseIssuer: string | undefined;
  externalAuthFirebaseCertsUrl: string;
  externalAuthFirebaseVerifier: FirebaseVerifierMode;
  externalAuthFirebaseServiceAccountFile: string | undefined;
  externalAuthVerificationSecrets: string[];
}

export function loadStartupConfig(env: Record<string, string | undefined>): StartupConfig {
  const normalizedNodeEnv = env.NODE_ENV?.trim().toLowerCase();
  const isProduction = normalizedNodeEnv === 'production';
  const authBootstrapUsersFile = env.POKER_AUTH_BOOTSTRAP_USERS_FILE?.trim();
  const authTokenSecret = env.POKER_AUTH_TOKEN_SECRET?.trim();
  const externalAuthEnabled = parseExternalAuthEnabled(env.POKER_EXTERNAL_AUTH_ENABLED);
  const externalAuthMode = parseExternalAuthMode(env.POKER_EXTERNAL_AUTH_MODE);
  const externalAuthIssuer = env.POKER_EXTERNAL_AUTH_ISSUER?.trim() || DEFAULT_EXTERNAL_AUTH_ISSUER;
  const externalAuthSharedSecret = env.POKER_EXTERNAL_AUTH_SHARED_SECRET?.trim() || undefined;
  const externalAuthSharedSecretPrevious = env.POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS?.trim() || undefined;
  const externalAuthProxySharedSecret = env.POKER_EXTERNAL_AUTH_PROXY_SHARED_SECRET?.trim() || undefined;
  const externalAuthFirebaseProjectId = env.POKER_EXTERNAL_AUTH_FIREBASE_PROJECT_ID?.trim() || undefined;
  const externalAuthFirebaseVerifier = parseFirebaseVerifierMode(env.POKER_EXTERNAL_AUTH_FIREBASE_VERIFIER);
  const externalAuthFirebaseServiceAccountFile = env.POKER_EXTERNAL_AUTH_FIREBASE_SERVICE_ACCOUNT_FILE?.trim()
    || undefined;
  const externalAuthFirebaseAudience = env.POKER_EXTERNAL_AUTH_FIREBASE_AUDIENCE?.trim() || undefined;
  const externalAuthFirebaseIssuer = env.POKER_EXTERNAL_AUTH_FIREBASE_ISSUER?.trim()
    || (externalAuthFirebaseProjectId
      ? `https://securetoken.google.com/${externalAuthFirebaseProjectId}`
      : undefined);
  const externalAuthFirebaseCertsUrl = env.POKER_EXTERNAL_AUTH_FIREBASE_CERTS_URL?.trim() || DEFAULT_FIREBASE_CERTS_URL;

  if (isProduction && !authTokenSecret) {
    throw new Error('POKER_AUTH_TOKEN_SECRET is required when NODE_ENV=production.');
  }

  if (externalAuthEnabled && externalAuthMode === 'signed_assertion' && !externalAuthSharedSecret) {
    throw new Error('POKER_EXTERNAL_AUTH_SHARED_SECRET is required when POKER_EXTERNAL_AUTH_ENABLED=1.');
  }

  if (externalAuthEnabled && externalAuthMode === 'trusted_headers' && !externalAuthProxySharedSecret) {
    throw new Error('POKER_EXTERNAL_AUTH_PROXY_SHARED_SECRET is required in trusted_headers mode.');
  }

  if (externalAuthEnabled && externalAuthMode === 'firebase_id_token' && !externalAuthFirebaseProjectId) {
    throw new Error('POKER_EXTERNAL_AUTH_FIREBASE_PROJECT_ID is required in firebase_id_token mode.');
  }

  if (
    externalAuthEnabled
    && externalAuthMode === 'firebase_id_token'
    && externalAuthFirebaseVerifier === 'admin_sdk'
    && externalAuthFirebaseServiceAccountFile
    && !fs.existsSync(externalAuthFirebaseServiceAccountFile)
  ) {
    throw new Error(
      `POKER_EXTERNAL_AUTH_FIREBASE_SERVICE_ACCOUNT_FILE does not exist: ${externalAuthFirebaseServiceAccountFile}`,
    );
  }

  if (externalAuthSharedSecret && externalAuthSharedSecret.length < 16) {
    throw new Error('POKER_EXTERNAL_AUTH_SHARED_SECRET must be at least 16 characters when provided.');
  }

  if (externalAuthSharedSecretPrevious && !externalAuthSharedSecret) {
    throw new Error('POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS requires POKER_EXTERNAL_AUTH_SHARED_SECRET.');
  }

  if (externalAuthSharedSecretPrevious && externalAuthSharedSecretPrevious.length < 16) {
    throw new Error('POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS must be at least 16 characters when provided.');
  }

  if (externalAuthSharedSecretPrevious && externalAuthSharedSecretPrevious === externalAuthSharedSecret) {
    throw new Error('POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS must differ from POKER_EXTERNAL_AUTH_SHARED_SECRET.');
  }

  if (externalAuthProxySharedSecret && externalAuthProxySharedSecret.length < 16) {
    throw new Error('POKER_EXTERNAL_AUTH_PROXY_SHARED_SECRET must be at least 16 characters when provided.');
  }

  const externalAuthVerificationSecrets = externalAuthMode === 'signed_assertion' && externalAuthSharedSecret
    ? Array.from(
      new Set([externalAuthSharedSecret, externalAuthSharedSecretPrevious].filter((secret): secret is string =>
        typeof secret === 'string' && secret.length > 0
      )),
    )
    : [];

  return {
    isProduction,
    port: parsePort(env.PORT),
    host: env.HOST ?? DEFAULT_HOST,
    tableId: env.TABLE_ID ?? DEFAULT_TABLE_ID,
    persistenceEnabled: parsePersistenceEnabled(env.POKER_STATE_PERSIST),
    stateFilePath: env.POKER_STATE_FILE ?? defaultStateFilePath(),
    authTokenSecret: authTokenSecret || undefined,
    authSessionTtlMs: parseSessionTtlMs(env.POKER_SESSION_TTL_MS),
    authAllowDemoUsers: parseAllowDemoUsers(env.POKER_AUTH_ALLOW_DEMO_USERS, env.NODE_ENV),
    authBootstrapUsersFile,
    authBootstrapUsers: loadBootstrapUsersFromFile(authBootstrapUsersFile),
    allowLegacyWalletRoutes: parseAllowLegacyWalletRoutes(env.POKER_ENABLE_LEGACY_WALLET_ROUTES, env.NODE_ENV),
    tableWsCommandChannelEnabled: env.POKER_ENABLE_TABLE_WS_COMMANDS === undefined
      ? false
      : parseBooleanEnv(env.POKER_ENABLE_TABLE_WS_COMMANDS, 'POKER_ENABLE_TABLE_WS_COMMANDS'),
    tableWsCommandRateLimitWindowMs: parsePositiveIntegerEnvWithDefault(
      env.POKER_TABLE_WS_COMMAND_RATE_LIMIT_WINDOW_MS,
      DEFAULT_TABLE_WS_COMMAND_RATE_LIMIT_WINDOW_MS,
      'POKER_TABLE_WS_COMMAND_RATE_LIMIT_WINDOW_MS',
    ),
    tableWsCommandRateLimitMax: parsePositiveIntegerEnvWithDefault(
      env.POKER_TABLE_WS_COMMAND_RATE_LIMIT_MAX,
      DEFAULT_TABLE_WS_COMMAND_RATE_LIMIT_MAX,
      'POKER_TABLE_WS_COMMAND_RATE_LIMIT_MAX',
    ),
    tableWsCommandMaxInFlight: parsePositiveIntegerEnvWithDefault(
      env.POKER_TABLE_WS_COMMAND_MAX_IN_FLIGHT,
      DEFAULT_TABLE_WS_COMMAND_MAX_IN_FLIGHT,
      'POKER_TABLE_WS_COMMAND_MAX_IN_FLIGHT',
    ),
    externalAuthEnabled,
    externalAuthMode,
    externalAuthIssuer,
    externalAuthSharedSecret,
    externalAuthSharedSecretPrevious,
    externalAuthProxySharedSecret,
    externalAuthFirebaseProjectId,
    externalAuthFirebaseAudience,
    externalAuthFirebaseIssuer,
    externalAuthFirebaseCertsUrl,
    externalAuthFirebaseVerifier,
    externalAuthFirebaseServiceAccountFile,
    externalAuthVerificationSecrets,
  };
}
