import type { ActionOptionDTO, PokerAction } from '@poker/poker-engine';
import { describe, expect, it } from 'vitest';
import { executeMultiTableAction, type MultiTableActionController } from '../src/multi-table-action-submit';
import type { MultiTableActionId } from '../src/multi-table-logic';

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

function makeControllerCapture(): {
  controller: MultiTableActionController;
  intents: Array<{ action: PokerAction; amount?: number }>;
} {
  const intents: Array<{ action: PokerAction; amount?: number }> = [];
  return {
    intents,
    controller: {
      performUserAction(intent): void {
        intents.push(intent);
      },
    },
  };
}

function execute(params: {
  selectedActionId?: MultiTableActionId;
  selectedActionLabel?: string;
  actionOption?: ActionOptionDTO | null;
  isUserActing?: boolean;
  targetBetAmount?: number;
  userStack?: number | null;
  tableName?: string;
  controller?: MultiTableActionController | null;
}) {
  return executeMultiTableAction({
    controller: params.controller ?? null,
    tableName: params.tableName ?? 'Atlas 01',
    selectedActionId: params.selectedActionId ?? 'CALL',
    selectedActionLabel: params.selectedActionLabel ?? 'Call',
    actionOption: params.actionOption ?? null,
    isUserActing: params.isUserActing ?? true,
    targetBetAmount: params.targetBetAmount ?? 120,
    userStack: params.userStack ?? 400,
    timestampLabel: '10:18 AM',
  });
}

describe('multi-table action submission integration', () => {
  it('blocks submission when action is illegal', () => {
    const { controller, intents } = makeControllerCapture();
    const result = execute({
      controller,
      selectedActionId: 'CALL',
      selectedActionLabel: 'Call',
      actionOption: makeActionOption('CALL', false),
    });

    expect(result.submitted).toBe(false);
    expect(result.illegalActionRequested).toBe(true);
    expect(result.activityNote).toContain('Call is not legal');
    expect(intents).toHaveLength(0);
  });

  it('blocks submission when table is not on user turn', () => {
    const { controller, intents } = makeControllerCapture();
    const result = execute({
      controller,
      isUserActing: false,
      selectedActionId: 'CHECK',
      selectedActionLabel: 'Check',
      actionOption: makeActionOption('CHECK', true),
    });

    expect(result.submitted).toBe(false);
    expect(result.activityNote).toContain('Waiting for your turn');
    expect(intents).toHaveLength(0);
  });

  it('clamps raise amount into legal range and submits', () => {
    const { controller, intents } = makeControllerCapture();
    const result = execute({
      controller,
      selectedActionId: 'RAISE',
      selectedActionLabel: 'Raise',
      targetBetAmount: 999,
      actionOption: makeActionOption('RAISE', true, 'TARGET_BET', 80, 560),
    });

    expect(result.submitted).toBe(true);
    expect(result.clampedTargetBetAmount).toBe(560);
    expect(intents).toEqual([{ action: 'RAISE', amount: 560 }]);
    expect(result.activityNote).toContain('raised to 560 chips');
  });

  it('supports RAISE intent mapped to BET option and clamps min amount', () => {
    const { controller, intents } = makeControllerCapture();
    const result = execute({
      controller,
      selectedActionId: 'RAISE',
      selectedActionLabel: 'Raise',
      targetBetAmount: 10,
      actionOption: makeActionOption('BET', true, 'TARGET_BET', 40, 300),
    });

    expect(result.submitted).toBe(true);
    expect(result.clampedTargetBetAmount).toBe(40);
    expect(intents).toEqual([{ action: 'BET', amount: 40 }]);
    expect(result.activityNote).toContain('bet 40 chips');
  });
});
