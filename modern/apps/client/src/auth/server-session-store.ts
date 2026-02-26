import type { AuthSessionDTO } from '@poker/game-contracts';

export const DEFAULT_SERVER_SESSION_STORAGE_KEY = 'poker.server.session';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StoredServerSession {
  token: string;
  userEmail: string;
  userDisplayName: string;
  expiresAt: string | null;
}

interface StoreOptions {
  storage?: StorageLike | null;
  storageKey?: string;
}

function resolveStorage(storage: StorageLike | null | undefined): StorageLike | null {
  if (storage) {
    return storage;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function resolveStorageKey(storageKey: string | undefined): string {
  const trimmed = storageKey?.trim();
  return trimmed ? trimmed : DEFAULT_SERVER_SESSION_STORAGE_KEY;
}

function parseSessionPayload(raw: string): StoredServerSession | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const token = typeof record.token === 'string' ? record.token.trim() : '';
    const userEmail = typeof record.userEmail === 'string' ? record.userEmail.trim() : '';
    const userDisplayName = typeof record.userDisplayName === 'string' ? record.userDisplayName.trim() : '';
    const expiresAt = typeof record.expiresAt === 'string' ? record.expiresAt : record.expiresAt === null ? null : null;
    if (!token || !userEmail || !userDisplayName) {
      return null;
    }

    return {
      token,
      userEmail,
      userDisplayName,
      expiresAt,
    };
  } catch {
    return null;
  }
}

export function readStoredServerSession(options: StoreOptions = {}): StoredServerSession | null {
  const storage = resolveStorage(options.storage);
  if (!storage) {
    return null;
  }

  const storageKey = resolveStorageKey(options.storageKey);
  const raw = storage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  const parsed = parseSessionPayload(raw);
  if (!parsed) {
    storage.removeItem(storageKey);
    return null;
  }

  return parsed;
}

export function writeStoredServerSession(session: AuthSessionDTO, options: StoreOptions = {}): void {
  const storage = resolveStorage(options.storage);
  if (!storage) {
    return;
  }

  const payload: StoredServerSession = {
    token: session.token,
    userEmail: session.user.email,
    userDisplayName: session.user.displayName,
    expiresAt: session.expiresAt,
  };

  const storageKey = resolveStorageKey(options.storageKey);
  storage.setItem(storageKey, JSON.stringify(payload));
}

export function clearStoredServerSession(options: StoreOptions = {}): void {
  const storage = resolveStorage(options.storage);
  if (!storage) {
    return;
  }

  const storageKey = resolveStorageKey(options.storageKey);
  storage.removeItem(storageKey);
}
