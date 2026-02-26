import type { ActionOptionDTO, SeatActionStateDTO, TablePhase } from '@poker/poker-engine';

export type MultiTableActionId = 'FOLD' | 'CHECK' | 'CALL' | 'RAISE' | 'ALL_IN';

const MULTI_TABLE_ACTION_ORDER: readonly MultiTableActionId[] = ['FOLD', 'CHECK', 'CALL', 'RAISE', 'ALL_IN'];
const BETTING_PHASES: readonly TablePhase[] = ['BETTING_PRE_FLOP', 'BETTING_FLOP', 'BETTING_TURN', 'BETTING_RIVER'];

export function resolveMultiTableActionOptionForIntent(
  actionState: SeatActionStateDTO | null,
  actionId: MultiTableActionId,
): ActionOptionDTO | null {
  if (!actionState) {
    return null;
  }

  if (actionId === 'RAISE') {
    return actionState.actions.find((option) => option.action === 'RAISE') ?? actionState.actions.find((option) => option.action === 'BET') ?? null;
  }

  return actionState.actions.find((option) => option.action === actionId) ?? null;
}

export function getAvailableMultiTableActionIdsFromActionState(actionState: SeatActionStateDTO | null): MultiTableActionId[] {
  return MULTI_TABLE_ACTION_ORDER.filter((actionId) => resolveMultiTableActionOptionForIntent(actionState, actionId)?.allowed);
}

export function normalizeSelectedMultiTableAction(
  actionState: SeatActionStateDTO | null,
  selectedActionId: MultiTableActionId,
): MultiTableActionId {
  const availableActionIds = getAvailableMultiTableActionIdsFromActionState(actionState);
  if (availableActionIds.length === 0 || availableActionIds.includes(selectedActionId)) {
    return selectedActionId;
  }

  return availableActionIds[0];
}

export function getRaiseBoundsFromActionState(
  actionState: SeatActionStateDTO | null,
  fallbackMin: number,
  fallbackMax: number,
): { min: number; max: number } {
  const safeFallbackMax = Math.max(fallbackMin, fallbackMax);
  const raiseOption = resolveMultiTableActionOptionForIntent(actionState, 'RAISE');
  if (!raiseOption || raiseOption.amountSemantics !== 'TARGET_BET') {
    return {
      min: fallbackMin,
      max: safeFallbackMax,
    };
  }

  const min = raiseOption.minAmount ?? fallbackMin;
  const max = Math.max(min, raiseOption.maxAmount ?? min);
  return {
    min,
    max,
  };
}

export function getPendingDecisionCountFromState(phase: TablePhase, actingSeatId: number, userSeatId: number): number {
  if (!BETTING_PHASES.includes(phase)) {
    return 0;
  }

  return actingSeatId === userSeatId ? 1 : 0;
}
