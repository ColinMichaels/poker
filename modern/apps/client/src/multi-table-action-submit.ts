import type { ActionOptionDTO, PokerAction } from '@poker/poker-engine';
import type { MultiTableActionId } from './multi-table-logic';

interface UserActionIntent {
  action: PokerAction;
  amount?: number;
}

export interface MultiTableActionController {
  performUserAction(intent: UserActionIntent): void;
}

export interface ExecuteMultiTableActionInput {
  controller: MultiTableActionController | null;
  tableName: string;
  selectedActionId: MultiTableActionId;
  selectedActionLabel: string;
  actionOption: ActionOptionDTO | null;
  isUserActing: boolean;
  targetBetAmount: number;
  userStack: number | null;
  timestampLabel: string;
}

export interface ExecuteMultiTableActionResult {
  submitted: boolean;
  submittedActionId: MultiTableActionId | null;
  clampedTargetBetAmount: number;
  activityNote: string;
  illegalActionRequested: boolean;
}

export function executeMultiTableAction(input: ExecuteMultiTableActionInput): ExecuteMultiTableActionResult {
  if (!input.controller) {
    return {
      submitted: false,
      submittedActionId: null,
      clampedTargetBetAmount: input.targetBetAmount,
      activityNote: `${input.timestampLabel} • ${input.tableName} controller is unavailable.`,
      illegalActionRequested: false,
    };
  }

  if (!input.isUserActing) {
    return {
      submitted: false,
      submittedActionId: null,
      clampedTargetBetAmount: input.targetBetAmount,
      activityNote: `${input.timestampLabel} • Waiting for your turn on ${input.tableName}.`,
      illegalActionRequested: false,
    };
  }

  if (!input.actionOption || !input.actionOption.allowed) {
    return {
      submitted: false,
      submittedActionId: null,
      clampedTargetBetAmount: input.targetBetAmount,
      activityNote: `${input.timestampLabel} • ${input.selectedActionLabel} is not legal on ${input.tableName} right now.`,
      illegalActionRequested: true,
    };
  }

  let amount: number | undefined;
  let clampedTargetBetAmount = input.targetBetAmount;
  if (input.actionOption.amountSemantics === 'TARGET_BET') {
    const min = input.actionOption.minAmount ?? input.targetBetAmount;
    const max = Math.max(min, input.actionOption.maxAmount ?? min);
    clampedTargetBetAmount = clampWholeNumberAmount(input.targetBetAmount, min, max);
    amount = clampedTargetBetAmount;
  }

  input.controller.performUserAction({ action: input.actionOption.action, amount });

  return {
    submitted: true,
    submittedActionId: input.selectedActionId,
    clampedTargetBetAmount,
    activityNote: buildSuccessNote(input, input.actionOption, clampedTargetBetAmount),
    illegalActionRequested: false,
  };
}

function buildSuccessNote(
  input: ExecuteMultiTableActionInput,
  actionOption: ActionOptionDTO,
  clampedTargetBetAmount: number,
): string {
  if (actionOption.action === 'RAISE') {
    return `${input.timestampLabel} • You raised to ${chips(clampedTargetBetAmount)} on ${input.tableName}.`;
  }
  if (actionOption.action === 'BET') {
    return `${input.timestampLabel} • You bet ${chips(clampedTargetBetAmount)} on ${input.tableName}.`;
  }
  if (actionOption.action === 'CALL') {
    const callAmount = actionOption.minAmount ?? 0;
    return `${input.timestampLabel} • You called ${chips(callAmount)} on ${input.tableName}.`;
  }
  if (actionOption.action === 'CHECK') {
    return `${input.timestampLabel} • You checked on ${input.tableName}.`;
  }
  if (actionOption.action === 'FOLD') {
    return `${input.timestampLabel} • You folded on ${input.tableName}.`;
  }
  if (actionOption.action === 'ALL_IN') {
    const stackAmount = input.userStack ?? clampedTargetBetAmount;
    return `${input.timestampLabel} • You moved all in for ${chips(stackAmount)} on ${input.tableName}.`;
  }

  return `${input.timestampLabel} • You acted on ${input.tableName}.`;
}

function clampWholeNumberAmount(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  const rounded = Math.round(value);
  return Math.max(min, Math.min(max, rounded));
}

function chips(amount: number): string {
  return `${amount.toLocaleString()} chips`;
}
