import type { Card } from './types.ts';

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

export interface EngineConfig {
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
}

export interface SeatDefinition {
  seatId: number;
  playerId: string;
  stack: number;
}

export interface SeatState {
  seatId: number;
  playerId: string;
  stack: number;
  folded: boolean;
  allIn: boolean;
  holeCards: Card[];
  currentBet: number;
  totalCommitted: number;
}

export interface SidePot {
  amount: number;
  participantSeatIds: number[];
  eligibleSeatIds: number[];
}

export interface Payout {
  seatId: number;
  amount: number;
  reason: 'SOLE_SURVIVOR' | 'SHOWDOWN';
}

export interface TexasHoldemState {
  handId: string;
  phase: TablePhase;
  config: EngineConfig;
  dealerSeatId: number;
  buttonSeatId: number;
  smallBlindSeatId: number;
  bigBlindSeatId: number;
  actingSeatId: number;
  actionQueue: number[];
  canRaiseSeatIds: number[];
  currentBet: number;
  minRaise: number;
  pot: number;
  board: Card[];
  burnCards: Card[];
  deck: Card[];
  seats: SeatState[];
  lastAggressorSeatId: number | null;
  sidePots: SidePot[];
  payouts: Payout[];
  rngSeed: number;
}
