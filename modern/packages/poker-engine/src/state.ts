import type { Card } from './types';

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

export interface SeatState {
  seatId: number;
  playerId: string;
  stack: number;
  folded: boolean;
  holeCards: Card[];
}

export interface TexasHoldemState {
  handId: string;
  phase: TablePhase;
  dealerSeatId: number;
  actingSeatId: number;
  pot: number;
  board: Card[];
  seats: SeatState[];
  burnCards: Card[];
}

export interface EngineConfig {
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
}
