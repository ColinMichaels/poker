import type { ActionOptionDTO, TableCommand, TablePhase } from '@poker/poker-engine';
import { TableService, createDefaultTableState } from './table-service.ts';

const BETTING_PHASES: readonly TablePhase[] = ['BETTING_PRE_FLOP', 'BETTING_FLOP', 'BETTING_TURN', 'BETTING_RIVER'];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message} (actual=${String(actual)} expected=${String(expected)})`);
  }
}

function assertThrows(fn: () => void, expectedPattern: RegExp, message: string): void {
  try {
    fn();
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    if (!expectedPattern.test(details)) {
      throw new Error(`${message} (unexpected error: ${details})`);
    }
    return;
  }

  throw new Error(message);
}

function isBettingPhase(phase: TablePhase): boolean {
  return BETTING_PHASES.includes(phase);
}

function pickAllowedAction(options: readonly ActionOptionDTO[]): ActionOptionDTO {
  const priorities: ActionOptionDTO['action'][] = ['CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN', 'FOLD'];

  for (const action of priorities) {
    const option = options.find((candidate) => candidate.action === action && candidate.allowed);
    if (option) {
      return option;
    }
  }

  throw new Error('No legal actions available for acting seat.');
}

function chooseActingCommand(table: TableService): TableCommand {
  const snapshot = table.getSnapshot();
  const actingSeatId = snapshot.state.actingSeatId;

  assert(actingSeatId > 0, 'Expected an acting seat in betting phase.');

  const actingSeat = snapshot.actionState.seats.find((seat) => seat.seatId === actingSeatId);
  assert(actingSeat !== undefined, 'Acting seat must be present in action DTO.');

  const option = pickAllowedAction(actingSeat.actions);

  if (option.amountSemantics === 'TARGET_BET') {
    assert(option.minAmount !== null, 'TARGET_BET action requires minAmount.');
    return {
      type: 'PLAYER_ACTION',
      seatId: actingSeatId,
      action: option.action,
      amount: option.minAmount,
    };
  }

  return {
    type: 'PLAYER_ACTION',
    seatId: actingSeatId,
    action: option.action,
  };
}

function runHandToCompletion(table: TableService, handId: string, seed: number): void {
  table.applyCommand({ type: 'START_HAND', handId, seed });
  table.applyCommand({ type: 'POST_BLINDS' });
  table.applyCommand({ type: 'DEAL_HOLE' });

  for (let guard = 0; guard < 512; guard += 1) {
    const phase = table.getSnapshot().state.phase;

    if (phase === 'HAND_COMPLETE') {
      return;
    }

    if (phase === 'DEAL_FLOP') {
      table.applyCommand({ type: 'DEAL_FLOP' });
      continue;
    }

    if (phase === 'DEAL_TURN') {
      table.applyCommand({ type: 'DEAL_TURN' });
      continue;
    }

    if (phase === 'DEAL_RIVER') {
      table.applyCommand({ type: 'DEAL_RIVER' });
      continue;
    }

    if (phase === 'SHOWDOWN') {
      table.applyCommand({ type: 'RESOLVE_SHOWDOWN' });
      continue;
    }

    if (isBettingPhase(phase)) {
      table.applyCommand(chooseActingCommand(table));
      continue;
    }

    throw new Error(`Unexpected phase during test lifecycle: ${phase}`);
  }

  throw new Error('Loop guard reached while attempting to complete hand lifecycle.');
}

function testRunsFullHandAndReplayMatches(): void {
  const table = new TableService({
    tableId: 'table-test',
    initialState: createDefaultTableState({ handId: 'boot-hand', seed: 100 }),
  });

  runHandToCompletion(table, 'hand-0001', 101);

  const snapshot = table.getSnapshot();
  assertEqual(snapshot.state.phase, 'HAND_COMPLETE', 'Expected completed phase after full lifecycle.');

  const handHistory = table.getHandHistory('hand-0001');
  assertEqual(handHistory.commands[0]?.command.type, 'START_HAND', 'Expected first command to be START_HAND.');
  assertEqual(handHistory.finalSnapshot?.phase, 'HAND_COMPLETE', 'Expected final snapshot to be complete.');

  const replay = table.replayHand('hand-0001');
  assertEqual(replay.matchesRecordedFinalState, true, 'Expected replay final state to match stored final snapshot.');
  assert(replay.commandCount > 0, 'Expected replay command count to be > 0.');
  assert(replay.eventCount > 0, 'Expected replay event count to be > 0.');
}

function testRejectsStartHandInProgress(): void {
  const table = new TableService({
    tableId: 'table-test',
    initialState: createDefaultTableState({ handId: 'boot-hand', seed: 200 }),
  });

  table.applyCommand({ type: 'START_HAND', handId: 'hand-0001', seed: 201 });
  table.applyCommand({ type: 'POST_BLINDS' });
  table.applyCommand({ type: 'DEAL_HOLE' });

  assertThrows(
    () => table.applyCommand({ type: 'START_HAND', handId: 'hand-0002', seed: 202 }),
    /START_HAND is only allowed in phases/,
    'Expected START_HAND rejection while a hand is active.',
  );
}

function testStateRoundTripRestore(): void {
  const original = new TableService({
    tableId: 'table-test',
    initialState: createDefaultTableState({ handId: 'boot-hand', seed: 300 }),
  });

  runHandToCompletion(original, 'hand-0001', 301);

  const restored = new TableService({
    tableId: 'table-test',
    restoredState: original.exportState(),
  });

  const originalSnapshot = original.getSnapshot();
  const restoredSnapshot = restored.getSnapshot();

  assertEqual(
    restoredSnapshot.commandSequence,
    originalSnapshot.commandSequence,
    'Expected restored command sequence to match.',
  );
  assertEqual(
    restoredSnapshot.eventSequence,
    originalSnapshot.eventSequence,
    'Expected restored event sequence to match.',
  );
  assertEqual(restoredSnapshot.state.phase, 'HAND_COMPLETE', 'Expected restored phase to be HAND_COMPLETE.');
  assertEqual(restored.listHandSummaries().length, 1, 'Expected restored hand history to be present.');

  const replay = restored.replayHand('hand-0001');
  assertEqual(replay.matchesRecordedFinalState, true, 'Expected restored replay to match final snapshot.');
}

function runAll(): void {
  testRunsFullHandAndReplayMatches();
  testRejectsStartHandInProgress();
  testStateRoundTripRestore();
  console.info('Server tests passed (table lifecycle + replay + lifecycle guard).');
}

runAll();
