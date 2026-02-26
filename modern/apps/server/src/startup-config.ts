import fs from 'node:fs';
import type { AuthUserSeedRecord } from './auth-wallet-service.ts';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const DEFAULT_TABLE_ID = 'table-1';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

    return entry as unknown as AuthUserSeedRecord;
  });

  return normalizedUsers;
}

function defaultStateFilePath(): string {
  return decodeURIComponent(new URL('../.data/runtime-state.json', import.meta.url).pathname);
}

export interface StartupConfig {
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
}

export function loadStartupConfig(env: Record<string, string | undefined>): StartupConfig {
  const normalizedNodeEnv = env.NODE_ENV?.trim().toLowerCase();
  const authBootstrapUsersFile = env.POKER_AUTH_BOOTSTRAP_USERS_FILE?.trim();
  const authTokenSecret = env.POKER_AUTH_TOKEN_SECRET?.trim();

  if (normalizedNodeEnv === 'production' && !authTokenSecret) {
    throw new Error('POKER_AUTH_TOKEN_SECRET is required when NODE_ENV=production.');
  }

  return {
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
  };
}
