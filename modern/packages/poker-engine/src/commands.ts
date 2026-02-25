export type PlayerAction = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN';

export type TableCommand =
  | { type: 'START_HAND'; handId: string; seed?: number }
  | { type: 'POST_BLINDS' }
  | { type: 'DEAL_HOLE' }
  | { type: 'PLAYER_ACTION'; seatId: number; action: PlayerAction; amount?: number };

export interface DomainEvent {
  type: string;
  payload: Record<string, unknown>;
}

export interface CommandResult<TState> {
  state: TState;
  events: DomainEvent[];
}

