import type { ActionOptionDTO, SeatActionStateDTO } from '@poker/poker-engine';
import { describe, expect, it } from 'vitest';
import {
  getAvailableMultiTableActionIdsFromActionState,
  getPendingDecisionCountFromState,
  getRaiseBoundsFromActionState,
  normalizeSelectedMultiTableAction,
  resolveMultiTableActionOptionForIntent,
} from '../src/multi-table-logic';

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

function makeSeatActionState(actions: ActionOptionDTO[]): SeatActionStateDTO {
  return {
    seatId: 1,
    isActingSeat: true,
    folded: false,
    allIn: false,
    stack: 380,
    currentBet: 20,
    toCall: 10,
    canRaise: true,
    actions,
  };
}

describe('multi-table action intent mapping', () => {
  it('prefers legal RAISE action when present', () => {
    const actionState = makeSeatActionState([
      makeActionOption('FOLD', true),
      makeActionOption('RAISE', true, 'TARGET_BET', 40, 400),
      makeActionOption('BET', true, 'TARGET_BET', 20, 200),
    ]);

    const option = resolveMultiTableActionOptionForIntent(actionState, 'RAISE');
    expect(option?.action).toBe('RAISE');
    expect(option?.allowed).toBe(true);
  });

  it('falls back RAISE intent to BET when RAISE is not available', () => {
    const actionState = makeSeatActionState([
      makeActionOption('FOLD', true),
      makeActionOption('BET', true, 'TARGET_BET', 30, 300),
    ]);

    const option = resolveMultiTableActionOptionForIntent(actionState, 'RAISE');
    expect(option?.action).toBe('BET');
    expect(option?.allowed).toBe(true);
  });
});

describe('multi-table availability and selection', () => {
  it('derives available action ids from legal options', () => {
    const actionState = makeSeatActionState([
      makeActionOption('FOLD', true),
      makeActionOption('CHECK', false),
      makeActionOption('CALL', false),
      makeActionOption('BET', true, 'TARGET_BET', 30, 200),
      makeActionOption('ALL_IN', true, 'ALL_IN'),
    ]);

    expect(getAvailableMultiTableActionIdsFromActionState(actionState)).toEqual(['FOLD', 'RAISE', 'ALL_IN']);
  });

  it('normalizes invalid selected action to first legal action', () => {
    const actionState = makeSeatActionState([
      makeActionOption('FOLD', true),
      makeActionOption('CALL', false),
      makeActionOption('BET', true, 'TARGET_BET', 40, 300),
    ]);

    expect(normalizeSelectedMultiTableAction(actionState, 'CALL')).toBe('FOLD');
    expect(normalizeSelectedMultiTableAction(actionState, 'RAISE')).toBe('RAISE');
  });
});

describe('multi-table bounds and pending decisions', () => {
  it('uses live target-bet bounds when available', () => {
    const actionState = makeSeatActionState([makeActionOption('RAISE', true, 'TARGET_BET', 80, 560)]);
    expect(getRaiseBoundsFromActionState(actionState, 20, 200)).toEqual({ min: 80, max: 560 });
  });

  it('falls back to static bounds when no target-bet option exists', () => {
    const actionState = makeSeatActionState([makeActionOption('CALL', true)]);
    expect(getRaiseBoundsFromActionState(actionState, 20, 200)).toEqual({ min: 20, max: 200 });
  });

  it('marks exactly one pending decision when user is acting in betting phase', () => {
    expect(getPendingDecisionCountFromState('BETTING_FLOP', 1, 1)).toBe(1);
    expect(getPendingDecisionCountFromState('BETTING_FLOP', 2, 1)).toBe(0);
    expect(getPendingDecisionCountFromState('DEAL_TURN', 1, 1)).toBe(0);
  });
});
