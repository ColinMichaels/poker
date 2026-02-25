export type SeatId = number;
export type PlayerId = string;

export type TablePhase =
  | 'LOBBY'
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
