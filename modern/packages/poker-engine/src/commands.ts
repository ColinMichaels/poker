export type TableCommand =
  | { type: 'START_HAND'; handId: string }
  | { type: 'POST_BLINDS' }
  | { type: 'DEAL_HOLE' }
  | { type: 'PLAYER_ACTION'; seatId: number; action: 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN'; amount?: number };

export interface CommandResult<TState> {
  state: TState;
  events: Array<{ type: string; payload: Record<string, unknown> }>;
}
