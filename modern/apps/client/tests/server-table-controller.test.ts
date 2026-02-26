import type { ActionOptionDTO, SeatActionStateDTO } from '@poker/poker-engine';
import { describe, expect, it } from 'vitest';
import { selectAutomatedActionCommand } from '../src/server-table-controller.ts';

function makeActionOption(
  action: ActionOptionDTO['action'],
  allowed: boolean,
  amountSemantics: ActionOptionDTO['amountSemantics'] = 'NO_AMOUNT',
  minAmount: number | null = null,
  maxAmount: number | null = null,
): ActionOptionDTO {
  return {
    action,
    allowed,
    amountSemantics,
    minAmount,
    maxAmount,
  };
}

function makeSeatActionState(toCall: number, actions: ActionOptionDTO[]): SeatActionStateDTO {
  return {
    seatId: 3,
    isActingSeat: true,
    folded: false,
    allIn: false,
    stack: 380,
    currentBet: 20,
    toCall,
    canRaise: true,
    actions,
  };
}

describe('server table automated action selection', () => {
  it('prefers CALL when facing a bet', () => {
    const command = selectAutomatedActionCommand(
      makeSeatActionState(15, [makeActionOption('CALL', true), makeActionOption('FOLD', true)]),
    );
    expect(command).toEqual({
      type: 'PLAYER_ACTION',
      seatId: 3,
      action: 'CALL',
    });
  });

  it('falls back to FOLD when CALL is unavailable', () => {
    const command = selectAutomatedActionCommand(
      makeSeatActionState(15, [makeActionOption('CALL', false), makeActionOption('FOLD', true)]),
    );
    expect(command).toEqual({
      type: 'PLAYER_ACTION',
      seatId: 3,
      action: 'FOLD',
    });
  });

  it('prefers CHECK when no chips are required', () => {
    const command = selectAutomatedActionCommand(
      makeSeatActionState(0, [makeActionOption('CHECK', true), makeActionOption('BET', true, 'TARGET_BET', 30, 120)]),
    );
    expect(command).toEqual({
      type: 'PLAYER_ACTION',
      seatId: 3,
      action: 'CHECK',
    });
  });

  it('uses minimum legal amount for target-bet actions', () => {
    const command = selectAutomatedActionCommand(
      makeSeatActionState(0, [makeActionOption('CHECK', false), makeActionOption('BET', true, 'TARGET_BET', 60, 260)]),
    );
    expect(command).toEqual({
      type: 'PLAYER_ACTION',
      seatId: 3,
      action: 'BET',
      amount: 60,
    });
  });

  it('returns null when no legal actions exist', () => {
    const command = selectAutomatedActionCommand(
      makeSeatActionState(0, [makeActionOption('CHECK', false), makeActionOption('FOLD', false)]),
    );
    expect(command).toBeNull();
  });
});
