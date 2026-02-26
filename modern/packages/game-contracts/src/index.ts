export type SeatId = number;
export type PlayerId = string;

export type TablePhase =
  | 'LOBBY'
  | 'SEATED'
  | 'BLINDS_POSTED'
  | 'DEAL_HOLE'
  | 'BETTING_PRE_FLOP'
  | 'DEAL_FLOP'
  | 'BETTING_FLOP'
  | 'DEAL_TURN'
  | 'BETTING_TURN'
  | 'DEAL_RIVER'
  | 'BETTING_RIVER'
  | 'SHOWDOWN'
  | 'PAYOUT'
  | 'HAND_COMPLETE';

export interface CommandEnvelope<TCommand extends string, TPayload> {
  id: string;
  handId: string;
  tableId: string;
  command: TCommand;
  payload: TPayload;
  createdAt: string;
}

export interface DomainEvent<TEvent extends string, TPayload> {
  event: TEvent;
  payload: TPayload;
  sequence: number;
  createdAt: string;
}

export type PokerAction = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN';
export type ActionAmountSemantics = 'NO_AMOUNT' | 'TARGET_BET' | 'ALL_IN';

export interface ActionOptionDTO {
  action: PokerAction;
  allowed: boolean;
  amountSemantics: ActionAmountSemantics;
  minAmount: number | null;
  maxAmount: number | null;
}

export interface SeatActionStateDTO {
  seatId: number;
  isActingSeat: boolean;
  folded: boolean;
  allIn: boolean;
  stack: number;
  currentBet: number;
  toCall: number;
  canRaise: boolean;
  actions: ActionOptionDTO[];
}

export interface TableActionStateDTO {
  handId: string;
  phase: TablePhase;
  actingSeatId: number;
  seats: SeatActionStateDTO[];
}

export type WalletAdjustmentMethod = 'add' | 'sub';

export interface PlayerWalletDTO {
  userId: number;
  balance: number;
  wins: number;
  gamesPlayed: number;
  updatedAt: string;
}

export type UserRole = 'PLAYER' | 'OPERATOR' | 'ADMIN';

export interface UserProfileDTO {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: UserRole;
  wallet: PlayerWalletDTO;
}

export interface AuthSessionDTO {
  token: string;
  issuedAt: string;
  expiresAt: string | null;
  user: UserProfileDTO;
}

export interface LoginRequestDTO {
  email: string;
  password?: string;
}

export interface LoginResponseDTO {
  session: AuthSessionDTO;
}

export interface UpdateProfileRequestDTO {
  firstName?: string;
  lastName?: string;
}

export interface WalletAdjustmentRequestDTO {
  method: WalletAdjustmentMethod;
  amount: number;
  reason?: string;
}

export interface WalletLedgerEntryDTO {
  id: string;
  userId: number;
  method: WalletAdjustmentMethod;
  amount: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
}

export interface WalletAdjustmentResponseDTO {
  wallet: PlayerWalletDTO;
  entry: WalletLedgerEntryDTO;
}
