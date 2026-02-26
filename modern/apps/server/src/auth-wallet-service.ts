import { createHmac, randomBytes, scryptSync } from 'node:crypto';
import type {
  AuthSessionDTO,
  LoginRequestDTO,
  LoginResponseDTO,
  PlayerWalletDTO,
  UserRole,
  UpdateProfileRequestDTO,
  UserProfileDTO,
  WalletAdjustmentRequestDTO,
  WalletAdjustmentResponseDTO,
  WalletLedgerEntryDTO,
} from '@poker/game-contracts';

const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DEFAULT_TOKEN_SECRET = 'poker-local-dev-auth-secret-change-me';
const SESSION_TOKEN_PREFIX = 'pkr';
const PASSWORD_HASH_PREFIX = 'scrypt';
const PASSWORD_HASH_KEY_LENGTH = 32;
const PASSWORD_SALT_BYTES = 16;
const MAX_AUTH_AUDIT_LIMIT = 500;
const MAX_AUTH_AUDIT_ENTRIES = 2000;
const ALLOWED_USER_ROLES: readonly UserRole[] = ['PLAYER', 'OPERATOR', 'ADMIN'];

export type AuthAuditEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'SESSION_REVOKED'
  | 'SESSION_INVALID'
  | 'SESSION_EXPIRED'
  | 'SESSION_RESTORE_DROPPED';

export interface AuthAuditEntry {
  id: string;
  createdAt: string;
  event: AuthAuditEvent;
  userId: number | null;
  email: string | null;
  tokenHint: string | null;
  reason: string | null;
}

export interface PersistedUserRecord {
  id: number;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  externalIdentities: ExternalIdentityLink[];
  walletBalance: number;
  wins: number;
  gamesPlayed: number;
  walletUpdatedAt: string;
  walletLedger: WalletLedgerEntryDTO[];
}

interface LegacyPersistedUserRecord extends Omit<PersistedUserRecord, 'passwordHash'> {
  passwordHash?: string;
  password?: string;
}

export interface PersistedSessionRecord {
  token: string;
  userId: number;
  issuedAt: string;
  expiresAt: string | null;
}

export interface AuthUserSeedRecord {
  id?: number;
  email: string;
  passwordHash?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  externalIdentities?: ExternalIdentityLink[];
  walletBalance?: number;
  wins?: number;
  gamesPlayed?: number;
  walletUpdatedAt?: string;
  walletLedger?: WalletLedgerEntryDTO[];
}

export interface ExternalIdentityLink {
  provider: string;
  subject: string;
  linkedAt: string;
}

export interface ExternalIdentityLoginRequest {
  provider: string;
  subject: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
}

export interface AuthWalletStateSnapshot {
  users: PersistedUserRecord[];
  sessions: PersistedSessionRecord[];
  auditLog?: AuthAuditEntry[];
}

export interface AuthWalletServiceOptions {
  users?: Array<PersistedUserRecord | LegacyPersistedUserRecord | AuthUserSeedRecord>;
  sessions?: PersistedSessionRecord[];
  auditLog?: AuthAuditEntry[];
  allowDefaultUsers?: boolean;
  tokenSecret?: string;
  sessionTtlMs?: number;
}

export interface AuthContext {
  token: string;
  user: UserProfileDTO;
}

interface ParsedSessionToken {
  userId: number;
  issuedAtMs: number;
  expiresAtMs: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeExternalIdentityProvider(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeExternalIdentitySubject(value: string): string {
  return value.trim();
}

function toExternalIdentityKey(provider: string, subject: string): string {
  return `${provider}\u0000${subject}`;
}

function isValidUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && ALLOWED_USER_ROLES.includes(value as UserRole);
}

function normalizeUserRole(value: unknown): UserRole {
  if (value === undefined || value === null) {
    return 'PLAYER';
  }

  if (!isValidUserRole(value)) {
    throw new Error(`Invalid user role: ${String(value)}`);
  }

  return value;
}

function normalizeExternalIdentityLink(rawLink: unknown): ExternalIdentityLink {
  if (typeof rawLink !== 'object' || rawLink === null) {
    throw new Error('External identity link must be an object.');
  }

  const record = rawLink as Record<string, unknown>;
  const provider = normalizeExternalIdentityProvider(typeof record.provider === 'string' ? record.provider : '');
  const subject = normalizeExternalIdentitySubject(typeof record.subject === 'string' ? record.subject : '');
  const linkedAt = typeof record.linkedAt === 'string' && record.linkedAt.length > 0
    ? record.linkedAt
    : nowIso();

  if (!provider) {
    throw new Error('External identity link provider is required.');
  }

  if (!subject) {
    throw new Error('External identity link subject is required.');
  }

  return {
    provider,
    subject,
    linkedAt,
  };
}

function normalizeExternalIdentityLinks(rawLinks: unknown): ExternalIdentityLink[] {
  if (!Array.isArray(rawLinks) || rawLinks.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: ExternalIdentityLink[] = [];
  for (const rawLink of rawLinks) {
    const link = normalizeExternalIdentityLink(rawLink);
    const key = toExternalIdentityKey(link.provider, link.subject);
    if (seen.has(key)) {
      throw new Error(`Duplicate external identity link detected: ${link.provider}/${link.subject}`);
    }
    seen.add(key);
    normalized.push(link);
  }

  return normalized;
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

function requireTokenSecret(rawValue: string | undefined): string {
  const secret = (rawValue ?? DEFAULT_TOKEN_SECRET).trim();
  if (secret.length < 16) {
    throw new Error('tokenSecret must be at least 16 characters.');
  }

  return secret;
}

function toIso(valueMs: number): string {
  return new Date(valueMs).toISOString();
}

function isFiniteTimestamp(valueMs: number): boolean {
  return Number.isFinite(valueMs) && valueMs > 0;
}

function toTokenHint(token: string): string {
  return token.length <= 14 ? token : token.slice(-14);
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function hashPassword(password: string): string {
  if (password.length === 0) {
    throw new Error('Password cannot be empty.');
  }

  const salt = randomBytes(PASSWORD_SALT_BYTES).toString('hex');
  const digest = scryptSync(password, salt, PASSWORD_HASH_KEY_LENGTH).toString('hex');
  return `${PASSWORD_HASH_PREFIX}$${salt}$${digest}`;
}

function verifyPassword(password: string, passwordHash: string): boolean {
  const parts = passwordHash.split('$');
  if (parts.length !== 3 || parts[0] !== PASSWORD_HASH_PREFIX) {
    return false;
  }

  const salt = parts[1];
  const expectedDigest = parts[2];
  const actualDigest = scryptSync(password, salt, PASSWORD_HASH_KEY_LENGTH).toString('hex');
  return constantTimeEqual(actualDigest, expectedDigest);
}

function isValidScryptPasswordHash(passwordHash: string): boolean {
  const parts = passwordHash.split('$');
  if (parts.length !== 3 || parts[0] !== PASSWORD_HASH_PREFIX) {
    return false;
  }

  const salt = parts[1];
  const digest = parts[2];
  return /^[0-9a-f]{32}$/i.test(salt) && /^[0-9a-f]{64}$/i.test(digest);
}

function signSessionPayload(payload: string, tokenSecret: string): string {
  return createHmac('sha256', tokenSecret).update(payload).digest('hex');
}

function createSessionToken(
  userId: number,
  issuedAtMs: number,
  expiresAtMs: number,
  tokenSecret: string,
): string {
  const nonce = randomBytes(16).toString('hex');
  const payload = `${userId}:${issuedAtMs}:${expiresAtMs}:${nonce}`;
  const signature = signSessionPayload(payload, tokenSecret);
  return `${SESSION_TOKEN_PREFIX}.${payload}.${signature}`;
}

function parseSessionToken(token: string, tokenSecret: string): ParsedSessionToken {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== SESSION_TOKEN_PREFIX) {
    throw new Error('Invalid session token.');
  }

  const payload = parts[1];
  const signature = parts[2];
  const expectedSignature = signSessionPayload(payload, tokenSecret);

  if (!constantTimeEqual(signature, expectedSignature)) {
    throw new Error('Invalid session token.');
  }

  const payloadParts = payload.split(':');
  if (payloadParts.length !== 4) {
    throw new Error('Invalid session token.');
  }

  const userId = Number.parseInt(payloadParts[0], 10);
  const issuedAtMs = Number.parseInt(payloadParts[1], 10);
  const expiresAtMs = Number.parseInt(payloadParts[2], 10);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('Invalid session token.');
  }

  if (!isFiniteTimestamp(issuedAtMs) || !isFiniteTimestamp(expiresAtMs) || expiresAtMs <= issuedAtMs) {
    throw new Error('Invalid session token.');
  }

  return {
    userId,
    issuedAtMs,
    expiresAtMs,
  };
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function deriveDefaultName(email: string): { firstName: string; lastName: string } {
  const localPart = email.split('@')[0] ?? 'player';
  const segments = localPart
    .split(/[._-]+/g)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return {
      firstName: 'Demo',
      lastName: 'User',
    };
  }

  if (segments.length === 1) {
    return {
      firstName: capitalize(segments[0]),
      lastName: 'User',
    };
  }

  return {
    firstName: capitalize(segments[0]),
    lastName: capitalize(segments.slice(1).join(' ')),
  };
}

function normalizePersistedUserRecord(
  rawUser: PersistedUserRecord | LegacyPersistedUserRecord | AuthUserSeedRecord,
  fallbackId: number,
): PersistedUserRecord {
  const user = cloneDeep(rawUser as LegacyPersistedUserRecord & AuthUserSeedRecord);

  const normalizedEmail = normalizeEmail(user.email ?? '');
  if (!normalizedEmail) {
    throw new Error('User email is required.');
  }

  const id = Number.isInteger(user.id) && (user.id as number) > 0 ? (user.id as number) : fallbackId;
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid user id: ${String(user.id)}`);
  }

  const hasPasswordHash = typeof user.passwordHash === 'string' && user.passwordHash.length > 0;
  const hasPassword = typeof user.password === 'string' && user.password.length > 0;
  const passwordHash = (() => {
    if (hasPasswordHash && isValidScryptPasswordHash(user.passwordHash as string)) {
      return user.passwordHash as string;
    }

    if (hasPassword) {
      return hashPassword(user.password as string);
    }

    if (hasPasswordHash) {
      const legacyPasswordValue = user.passwordHash as string;
      if (legacyPasswordValue.includes('$')) {
        throw new Error(`User ${id} has unsupported passwordHash format.`);
      }

      // Compatibility path for older persisted payloads that stored plaintext in passwordHash.
      return hashPassword(legacyPasswordValue);
    }

    return null;
  })();

  if (passwordHash === null) {
    throw new Error(`User ${id} is missing password credentials.`);
  }

  const derivedName = deriveDefaultName(normalizedEmail);
  const firstName = typeof user.firstName === 'string' && user.firstName.trim().length > 0
    ? user.firstName.trim()
    : derivedName.firstName;
  const lastName = typeof user.lastName === 'string' && user.lastName.trim().length > 0
    ? user.lastName.trim()
    : derivedName.lastName;
  const role = normalizeUserRole(user.role);
  const externalIdentities = normalizeExternalIdentityLinks(user.externalIdentities);

  const walletBalance = Number.isInteger(user.walletBalance) && (user.walletBalance as number) >= 0
    ? (user.walletBalance as number)
    : 500;
  const wins = Number.isInteger(user.wins) && (user.wins as number) >= 0 ? (user.wins as number) : 0;
  const gamesPlayed = Number.isInteger(user.gamesPlayed) && (user.gamesPlayed as number) >= 0
    ? (user.gamesPlayed as number)
    : 0;

  return {
    id,
    email: normalizedEmail,
    passwordHash,
    firstName,
    lastName,
    role,
    externalIdentities,
    walletBalance,
    wins,
    gamesPlayed,
    walletUpdatedAt: typeof user.walletUpdatedAt === 'string' && user.walletUpdatedAt.length > 0
      ? user.walletUpdatedAt
      : nowIso(),
    walletLedger: Array.isArray(user.walletLedger) ? user.walletLedger : [],
  };
}

function buildDefaultUsers(): PersistedUserRecord[] {
  const createdAt = nowIso();

  return [
    {
      id: 1,
      email: 'colin@example.com',
      passwordHash: hashPassword('demo'),
      firstName: 'Colin',
      lastName: 'Player',
      role: 'ADMIN',
      externalIdentities: [],
      walletBalance: 500,
      wins: 0,
      gamesPlayed: 0,
      walletUpdatedAt: createdAt,
      walletLedger: [],
    },
    {
      id: 2,
      email: 'luna@example.com',
      passwordHash: hashPassword('demo'),
      firstName: 'Luna',
      lastName: 'Bot',
      role: 'PLAYER',
      externalIdentities: [],
      walletBalance: 500,
      wins: 0,
      gamesPlayed: 0,
      walletUpdatedAt: createdAt,
      walletLedger: [],
    },
  ];
}

export class AuthWalletService {
  private readonly usersById: Map<number, PersistedUserRecord>;
  private readonly usersByEmail: Map<string, PersistedUserRecord>;
  private readonly externalIdentityToUserId: Map<string, number>;
  private readonly sessionsByToken: Map<string, PersistedSessionRecord>;
  private readonly tokenSecret: string;
  private readonly sessionTtlMs: number;
  private readonly authAuditLog: AuthAuditEntry[];
  private authAuditSequence: number;
  private nextUserId: number;

  public constructor(options: AuthWalletServiceOptions = {}) {
    const allowDefaultUsers = options.allowDefaultUsers ?? true;
    const userSeeds = options.users ? cloneDeep(options.users) : [];
    const users = userSeeds.length > 0
      ? userSeeds
      : allowDefaultUsers
        ? buildDefaultUsers()
        : [];
    const sessions = options.sessions ? cloneDeep(options.sessions) : [];
    const auditLog = options.auditLog ? cloneDeep(options.auditLog) : [];

    this.usersById = new Map();
    this.usersByEmail = new Map();
    this.externalIdentityToUserId = new Map();
    this.sessionsByToken = new Map();
    this.tokenSecret = requireTokenSecret(options.tokenSecret);
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    this.authAuditLog = auditLog;
    this.authAuditSequence = auditLog.length;
    this.nextUserId = 1;

    requirePositiveInteger(this.sessionTtlMs, 'sessionTtlMs');
    if (users.length === 0) {
      throw new Error('No auth users configured. Provide bootstrap users or enable demo users.');
    }

    let nextFallbackUserId = 1;
    for (const rawUser of users) {
      const user = normalizePersistedUserRecord(rawUser, nextFallbackUserId);
      nextFallbackUserId = Math.max(nextFallbackUserId, user.id + 1);

      if (this.usersById.has(user.id)) {
        throw new Error(`Duplicate user id detected during auth restore: ${user.id}`);
      }

      const normalizedEmail = normalizeEmail(user.email);
      if (this.usersByEmail.has(normalizedEmail)) {
        throw new Error(`Duplicate email detected during auth restore: ${user.email}`);
      }

      this.usersById.set(user.id, user);
      this.usersByEmail.set(normalizedEmail, user);
      this.registerExternalIdentities(user);
    }

    this.nextUserId = nextFallbackUserId;

    for (const rawSession of sessions) {
      const normalizedSession = this.normalizeSessionForRestore(rawSession);
      if (!normalizedSession) {
        continue;
      }

      if (!this.usersById.has(normalizedSession.userId)) {
        throw new Error(`Session ${normalizedSession.token} references missing user ${normalizedSession.userId}.`);
      }

      this.sessionsByToken.set(normalizedSession.token, normalizedSession);
    }
  }

  public login(request: LoginRequestDTO): LoginResponseDTO {
    if (!request.email || request.email.trim().length === 0) {
      throw new Error('Email is required.');
    }

    if (typeof request.password !== 'string' || request.password.length === 0) {
      throw new Error('Password is required.');
    }

    const user = this.usersByEmail.get(normalizeEmail(request.email));
    if (!user) {
      this.appendAuthAudit({
        event: 'LOGIN_FAILURE',
        userId: null,
        email: normalizeEmail(request.email),
        tokenHint: null,
        reason: 'unknown-email',
      });
      throw new Error('Invalid credentials.');
    }

    if (!verifyPassword(request.password, user.passwordHash)) {
      this.appendAuthAudit({
        event: 'LOGIN_FAILURE',
        userId: user.id,
        email: user.email,
        tokenHint: null,
        reason: 'invalid-password',
      });
      throw new Error('Invalid credentials.');
    }

    return this.createSessionForUser(user, null);
  }

  public loginWithExternalIdentity(request: ExternalIdentityLoginRequest): LoginResponseDTO {
    const provider = normalizeExternalIdentityProvider(request.provider);
    if (!provider) {
      throw new Error('External identity provider is required.');
    }

    const subject = normalizeExternalIdentitySubject(request.subject);
    if (!subject) {
      throw new Error('External identity subject is required.');
    }

    const email = normalizeEmail(request.email);
    if (!email) {
      throw new Error('External identity email is required.');
    }

    const linkKey = toExternalIdentityKey(provider, subject);
    const linkedUserId = this.externalIdentityToUserId.get(linkKey);
    if (linkedUserId !== undefined) {
      const user = this.requireUser(linkedUserId);
      if (email !== user.email) {
        throw new Error('External identity email does not match linked user.');
      }
      return this.createSessionForUser(user, `external:${provider}`);
    }

    const userByEmail = this.usersByEmail.get(email);
    if (userByEmail) {
      this.linkExternalIdentity(userByEmail, provider, subject);
      return this.createSessionForUser(userByEmail, `external:${provider}`);
    }

    const derivedName = deriveDefaultName(email);
    const firstName = request.firstName?.trim() || derivedName.firstName;
    const lastName = request.lastName?.trim() || derivedName.lastName;
    const role = normalizeUserRole(request.role);
    const createdAt = nowIso();
    const user: PersistedUserRecord = {
      id: this.nextUserId,
      email,
      passwordHash: hashPassword(randomBytes(PASSWORD_SALT_BYTES).toString('hex')),
      firstName,
      lastName,
      role,
      externalIdentities: [
        {
          provider,
          subject,
          linkedAt: createdAt,
        },
      ],
      walletBalance: 500,
      wins: 0,
      gamesPlayed: 0,
      walletUpdatedAt: createdAt,
      walletLedger: [],
    };
    this.nextUserId += 1;
    this.usersById.set(user.id, user);
    this.usersByEmail.set(user.email, user);
    this.registerExternalIdentities(user);

    return this.createSessionForUser(user, `external:${provider}`);
  }

  public logout(token: string): void {
    const session = this.sessionsByToken.get(token);
    this.sessionsByToken.delete(token);
    if (session) {
      const user = this.usersById.get(session.userId);
      this.appendAuthAudit({
        event: 'LOGOUT',
        userId: session.userId,
        email: user?.email ?? null,
        tokenHint: toTokenHint(token),
        reason: null,
      });
    }
  }

  public requireAuth(token: string | undefined): AuthContext {
    if (!token) {
      throw new Error('Authentication required.');
    }

    const session = this.requireSession(token);

    return {
      token,
      user: this.toUserProfileDTO(this.requireUser(session.userId)),
    };
  }

  public getSession(token: string): AuthSessionDTO {
    return this.toSessionDTO(this.requireSession(token));
  }

  public getUserProfile(userId: number): UserProfileDTO {
    return this.toUserProfileDTO(this.requireUser(userId));
  }

  public updateUserProfile(userId: number, request: UpdateProfileRequestDTO): UserProfileDTO {
    const user = this.requireUser(userId);

    if (typeof request.firstName === 'string') {
      const trimmed = request.firstName.trim();
      if (!trimmed) {
        throw new Error('firstName cannot be empty.');
      }
      user.firstName = trimmed;
    }

    if (typeof request.lastName === 'string') {
      const trimmed = request.lastName.trim();
      if (!trimmed) {
        throw new Error('lastName cannot be empty.');
      }
      user.lastName = trimmed;
    }

    return this.toUserProfileDTO(user);
  }

  public getWallet(userId: number): PlayerWalletDTO {
    return this.toWalletDTO(this.requireUser(userId));
  }

  public adjustWallet(userId: number, request: WalletAdjustmentRequestDTO): WalletAdjustmentResponseDTO {
    const user = this.requireUser(userId);
    const method = request.method;

    if (method !== 'add' && method !== 'sub') {
      throw new Error('Wallet adjustment method must be add or sub.');
    }

    requirePositiveInteger(request.amount, 'Wallet amount');

    if (method === 'sub' && user.walletBalance < request.amount) {
      throw new Error('Insufficient wallet balance for subtraction.');
    }

    user.walletBalance = method === 'add'
      ? user.walletBalance + request.amount
      : user.walletBalance - request.amount;
    user.walletUpdatedAt = nowIso();

    const entry: WalletLedgerEntryDTO = {
      id: `wallet_${user.id}_${user.walletLedger.length + 1}`,
      userId,
      method,
      amount: request.amount,
      balanceAfter: user.walletBalance,
      reason: request.reason?.trim() || 'manual-adjustment',
      createdAt: user.walletUpdatedAt,
    };

    user.walletLedger.push(entry);

    return {
      wallet: this.toWalletDTO(user),
      entry: cloneDeep(entry),
    };
  }

  public getWalletLedger(userId: number, limit = 50): WalletLedgerEntryDTO[] {
    const user = this.requireUser(userId);
    const boundedLimit = Math.max(1, Math.min(limit, 500));
    return cloneDeep(user.walletLedger.slice(-boundedLimit));
  }

  public getLegacyWalletAmount(userId: number): number {
    return this.requireUser(userId).walletBalance;
  }

  public revokeOtherSessions(userId: number, currentToken: string): number {
    this.requireUser(userId);

    let revokedCount = 0;
    for (const [token, session] of this.sessionsByToken.entries()) {
      if (session.userId !== userId || token === currentToken) {
        continue;
      }

      this.sessionsByToken.delete(token);
      revokedCount += 1;
      this.appendAuthAudit({
        event: 'SESSION_REVOKED',
        userId,
        email: this.usersById.get(userId)?.email ?? null,
        tokenHint: toTokenHint(token),
        reason: 'revoke-others',
      });
    }

    return revokedCount;
  }

  public getAuthAuditLog(limit = 100, userId?: number): AuthAuditEntry[] {
    const boundedLimit = Math.max(1, Math.min(limit, MAX_AUTH_AUDIT_LIMIT));
    const entries = userId === undefined
      ? this.authAuditLog
      : this.authAuditLog.filter((entry) => entry.userId === userId);

    return cloneDeep(entries.slice(-boundedLimit));
  }

  public exportState(): AuthWalletStateSnapshot {
    return {
      users: cloneDeep(Array.from(this.usersById.values()).sort((left, right) => left.id - right.id)),
      sessions: cloneDeep(Array.from(this.sessionsByToken.values()).sort((left, right) =>
        left.issuedAt.localeCompare(right.issuedAt),
      )),
      auditLog: cloneDeep(this.authAuditLog),
    };
  }

  private createSessionForUser(user: PersistedUserRecord, reason: string | null): LoginResponseDTO {
    const issuedAtMs = Date.now();
    const expiresAtMs = issuedAtMs + this.sessionTtlMs;

    const session: PersistedSessionRecord = {
      token: createSessionToken(user.id, issuedAtMs, expiresAtMs, this.tokenSecret),
      userId: user.id,
      issuedAt: toIso(issuedAtMs),
      expiresAt: toIso(expiresAtMs),
    };

    this.sessionsByToken.set(session.token, session);
    this.appendAuthAudit({
      event: 'LOGIN_SUCCESS',
      userId: user.id,
      email: user.email,
      tokenHint: toTokenHint(session.token),
      reason,
    });

    return {
      session: this.toSessionDTO(session),
    };
  }

  private linkExternalIdentity(user: PersistedUserRecord, provider: string, subject: string): void {
    const key = toExternalIdentityKey(provider, subject);
    const existingUserId = this.externalIdentityToUserId.get(key);
    if (existingUserId !== undefined && existingUserId !== user.id) {
      throw new Error('External identity is already linked to another user.');
    }

    const alreadyLinked = user.externalIdentities.some(
      (link) => link.provider === provider && link.subject === subject,
    );
    if (alreadyLinked) {
      return;
    }

    const linkedAt = nowIso();
    user.externalIdentities.push({
      provider,
      subject,
      linkedAt,
    });
    this.externalIdentityToUserId.set(key, user.id);
  }

  private registerExternalIdentities(user: PersistedUserRecord): void {
    for (const link of user.externalIdentities) {
      const key = toExternalIdentityKey(link.provider, link.subject);
      const existingUserId = this.externalIdentityToUserId.get(key);
      if (existingUserId !== undefined && existingUserId !== user.id) {
        throw new Error(`External identity ${link.provider}/${link.subject} is linked to multiple users.`);
      }
      this.externalIdentityToUserId.set(key, user.id);
    }
  }

  private normalizeSessionForRestore(rawSession: PersistedSessionRecord): PersistedSessionRecord | null {
    const parsed = this.tryParseSession(rawSession.token);
    if (!parsed) {
      this.appendAuthAudit({
        event: 'SESSION_RESTORE_DROPPED',
        userId: null,
        email: null,
        tokenHint: toTokenHint(rawSession.token),
        reason: 'invalid-session-token',
      });
      return null;
    }

    const nowMs = Date.now();
    if (parsed.expiresAtMs <= nowMs) {
      const user = this.usersById.get(parsed.userId);
      this.appendAuthAudit({
        event: 'SESSION_RESTORE_DROPPED',
        userId: parsed.userId,
        email: user?.email ?? null,
        tokenHint: toTokenHint(rawSession.token),
        reason: 'expired-session',
      });
      return null;
    }

    return {
      token: rawSession.token,
      userId: parsed.userId,
      issuedAt: toIso(parsed.issuedAtMs),
      expiresAt: toIso(parsed.expiresAtMs),
    };
  }

  private requireSession(token: string): PersistedSessionRecord {
    const session = this.sessionsByToken.get(token);
    if (!session) {
      const parsed = this.tryParseSession(token);
      const user = parsed ? this.usersById.get(parsed.userId) : undefined;
      this.appendAuthAudit({
        event: 'SESSION_INVALID',
        userId: parsed?.userId ?? null,
        email: user?.email ?? null,
        tokenHint: toTokenHint(token),
        reason: 'missing-session',
      });
      throw new Error('Invalid session token.');
    }

    const parsed = this.tryParseSession(token);
    if (!parsed || parsed.userId !== session.userId) {
      this.sessionsByToken.delete(token);
      const user = this.usersById.get(session.userId);
      this.appendAuthAudit({
        event: 'SESSION_INVALID',
        userId: session.userId,
        email: user?.email ?? null,
        tokenHint: toTokenHint(token),
        reason: 'signature-or-user-mismatch',
      });
      throw new Error('Invalid session token.');
    }

    const nowMs = Date.now();
    if (parsed.expiresAtMs <= nowMs) {
      this.sessionsByToken.delete(token);
      const user = this.usersById.get(session.userId);
      this.appendAuthAudit({
        event: 'SESSION_EXPIRED',
        userId: session.userId,
        email: user?.email ?? null,
        tokenHint: toTokenHint(token),
        reason: null,
      });
      throw new Error('Session expired.');
    }

    return session;
  }

  private tryParseSession(token: string): ParsedSessionToken | null {
    try {
      return parseSessionToken(token, this.tokenSecret);
    } catch {
      return null;
    }
  }

  private appendAuthAudit(entry: Omit<AuthAuditEntry, 'id' | 'createdAt'>): void {
    this.authAuditSequence += 1;
    this.authAuditLog.push({
      id: `auth_audit_${this.authAuditSequence}`,
      createdAt: nowIso(),
      event: entry.event,
      userId: entry.userId,
      email: entry.email,
      tokenHint: entry.tokenHint,
      reason: entry.reason,
    });

    if (this.authAuditLog.length > MAX_AUTH_AUDIT_ENTRIES) {
      this.authAuditLog.splice(0, this.authAuditLog.length - MAX_AUTH_AUDIT_ENTRIES);
    }
  }

  private requireUser(userId: number): PersistedUserRecord {
    const user = this.usersById.get(userId);
    if (!user) {
      throw new Error(`User ${userId} was not found.`);
    }

    return user;
  }

  private toWalletDTO(user: PersistedUserRecord): PlayerWalletDTO {
    return {
      userId: user.id,
      balance: user.walletBalance,
      wins: user.wins,
      gamesPlayed: user.gamesPlayed,
      updatedAt: user.walletUpdatedAt,
    };
  }

  private toUserProfileDTO(user: PersistedUserRecord): UserProfileDTO {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: `${user.firstName} ${user.lastName}`,
      role: user.role,
      wallet: this.toWalletDTO(user),
    };
  }

  private toSessionDTO(session: PersistedSessionRecord): AuthSessionDTO {
    return {
      token: session.token,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
      user: this.toUserProfileDTO(this.requireUser(session.userId)),
    };
  }
}
