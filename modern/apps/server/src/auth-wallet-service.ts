import type {
  AuthSessionDTO,
  LoginRequestDTO,
  LoginResponseDTO,
  PlayerWalletDTO,
  UpdateProfileRequestDTO,
  UserProfileDTO,
  WalletAdjustmentRequestDTO,
  WalletAdjustmentResponseDTO,
  WalletLedgerEntryDTO,
} from '@poker/game-contracts';

export interface PersistedUserRecord {
  id: number;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  walletBalance: number;
  wins: number;
  gamesPlayed: number;
  walletUpdatedAt: string;
  walletLedger: WalletLedgerEntryDTO[];
}

export interface PersistedSessionRecord {
  token: string;
  userId: number;
  issuedAt: string;
  expiresAt: string | null;
}

export interface AuthWalletStateSnapshot {
  users: PersistedUserRecord[];
  sessions: PersistedSessionRecord[];
}

export interface AuthWalletServiceOptions {
  users?: PersistedUserRecord[];
  sessions?: PersistedSessionRecord[];
}

export interface AuthContext {
  token: string;
  user: UserProfileDTO;
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

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

function createSessionToken(userId: number): string {
  const entropy = Math.random().toString(36).slice(2, 12);
  return `sess_${userId}_${Date.now()}_${entropy}`;
}

function buildDefaultUsers(): PersistedUserRecord[] {
  const createdAt = nowIso();

  return [
    {
      id: 1,
      email: 'colin@example.com',
      password: 'demo',
      firstName: 'Colin',
      lastName: 'Player',
      walletBalance: 500,
      wins: 0,
      gamesPlayed: 0,
      walletUpdatedAt: createdAt,
      walletLedger: [],
    },
    {
      id: 2,
      email: 'luna@example.com',
      password: 'demo',
      firstName: 'Luna',
      lastName: 'Bot',
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
  private readonly sessionsByToken: Map<string, PersistedSessionRecord>;

  public constructor(options: AuthWalletServiceOptions = {}) {
    const users = options.users ? cloneDeep(options.users) : buildDefaultUsers();
    const sessions = options.sessions ? cloneDeep(options.sessions) : [];

    this.usersById = new Map();
    this.usersByEmail = new Map();
    this.sessionsByToken = new Map();

    for (const user of users) {
      if (this.usersById.has(user.id)) {
        throw new Error(`Duplicate user id detected during auth restore: ${user.id}`);
      }

      const normalizedEmail = normalizeEmail(user.email);
      if (this.usersByEmail.has(normalizedEmail)) {
        throw new Error(`Duplicate email detected during auth restore: ${user.email}`);
      }

      this.usersById.set(user.id, user);
      this.usersByEmail.set(normalizedEmail, user);
    }

    for (const session of sessions) {
      if (!this.usersById.has(session.userId)) {
        throw new Error(`Session ${session.token} references missing user ${session.userId}.`);
      }

      this.sessionsByToken.set(session.token, session);
    }
  }

  public login(request: LoginRequestDTO): LoginResponseDTO {
    if (!request.email || request.email.trim().length === 0) {
      throw new Error('Email is required.');
    }

    const user = this.usersByEmail.get(normalizeEmail(request.email));
    if (!user) {
      throw new Error('Invalid credentials.');
    }

    if (typeof request.password === 'string' && request.password !== user.password) {
      throw new Error('Invalid credentials.');
    }

    const session: PersistedSessionRecord = {
      token: createSessionToken(user.id),
      userId: user.id,
      issuedAt: nowIso(),
      expiresAt: null,
    };

    this.sessionsByToken.set(session.token, session);

    return {
      session: this.toSessionDTO(session),
    };
  }

  public logout(token: string): void {
    this.sessionsByToken.delete(token);
  }

  public requireAuth(token: string | undefined): AuthContext {
    if (!token) {
      throw new Error('Authentication required.');
    }

    const session = this.sessionsByToken.get(token);
    if (!session) {
      throw new Error('Invalid session token.');
    }

    return {
      token,
      user: this.toUserProfileDTO(this.requireUser(session.userId)),
    };
  }

  public getSession(token: string): AuthSessionDTO {
    const session = this.sessionsByToken.get(token);
    if (!session) {
      throw new Error('Invalid session token.');
    }

    return this.toSessionDTO(session);
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

  public exportState(): AuthWalletStateSnapshot {
    return {
      users: cloneDeep(Array.from(this.usersById.values()).sort((left, right) => left.id - right.id)),
      sessions: cloneDeep(Array.from(this.sessionsByToken.values()).sort((left, right) =>
        left.issuedAt.localeCompare(right.issuedAt),
      )),
    };
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
