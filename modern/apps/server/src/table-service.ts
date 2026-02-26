import {
  applyTexasHoldemCommand,
  buildTableActionStateDTO,
  createTexasHoldemState,
  type DomainEvent,
  type EngineConfig,
  type SeatDefinition,
  type TableActionStateDTO,
  type TableCommand,
  type TablePhase,
  type TexasHoldemState,
} from '@poker/poker-engine';

export interface TableSnapshot {
  tableId: string;
  generatedAt: string;
  commandSequence: number;
  eventSequence: number;
  state: TexasHoldemState;
  actionState: TableActionStateDTO;
}

export interface CommandRecord {
  sequence: number;
  handId: string;
  createdAt: string;
  beforePhase: TablePhase;
  afterPhase: TablePhase;
  command: TableCommand;
}

export interface EventRecord {
  sequence: number;
  commandSequence: number;
  handId: string;
  createdAt: string;
  event: DomainEvent;
}

export interface HandHistory {
  handId: string;
  startedAt: string;
  completedAt: string | null;
  startSnapshot: TexasHoldemState;
  finalSnapshot: TexasHoldemState | null;
  commands: CommandRecord[];
  events: EventRecord[];
}

export interface HandHistorySummary {
  handId: string;
  startedAt: string;
  completedAt: string | null;
  commandCount: number;
  eventCount: number;
}

export interface ApplyCommandResult {
  command: CommandRecord;
  events: EventRecord[];
  snapshot: TableSnapshot;
}

export interface HandReplayResult {
  handId: string;
  commandCount: number;
  eventCount: number;
  replayedFinalState: TexasHoldemState;
  matchesRecordedFinalState: boolean | null;
}

export interface TableServiceOptions {
  tableId: string;
  initialState?: TexasHoldemState;
  restoredState?: TableServiceStateSnapshot;
}

export interface TableServiceStateSnapshot {
  tableId: string;
  state: TexasHoldemState;
  commandSequence: number;
  eventSequence: number;
  commandLog: CommandRecord[];
  eventLog: EventRecord[];
  handHistory: HandHistory[];
}

export interface DefaultTableStateOptions {
  handId?: string;
  seed?: number;
  dealerSeatId?: number;
}

const STARTABLE_PHASES: readonly TablePhase[] = ['SEATED', 'HAND_COMPLETE'];

function nowIso(): string {
  return new Date().toISOString();
}

function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function statesMatch(left: TexasHoldemState, right: TexasHoldemState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildDefaultSeats(): SeatDefinition[] {
  return [
    { seatId: 1, playerId: 'seat-1', stack: 400 },
    { seatId: 2, playerId: 'seat-2', stack: 400 },
    { seatId: 3, playerId: 'seat-3', stack: 400 },
    { seatId: 4, playerId: 'seat-4', stack: 400 },
  ];
}

function buildDefaultConfig(): EngineConfig {
  return {
    smallBlind: 5,
    bigBlind: 10,
    minBuyIn: 100,
    maxBuyIn: 1000,
  };
}

function buildHandHistory(handId: string, startedAt: string, startSnapshot: TexasHoldemState): HandHistory {
  return {
    handId,
    startedAt,
    completedAt: null,
    startSnapshot,
    finalSnapshot: null,
    commands: [],
    events: [],
  };
}

export function createDefaultTableState(options: DefaultTableStateOptions = {}): TexasHoldemState {
  return createTexasHoldemState({
    handId: options.handId ?? 'hand-bootstrap',
    dealerSeatId: options.dealerSeatId ?? 1,
    seed: options.seed ?? 42,
    config: buildDefaultConfig(),
    seats: buildDefaultSeats(),
  });
}

export class TableService {
  private readonly tableId: string;
  private state: TexasHoldemState;
  private commandSequence: number;
  private eventSequence: number;
  private readonly commandLog: CommandRecord[];
  private readonly eventLog: EventRecord[];
  private readonly handHistoryById: Map<string, HandHistory>;

  public constructor(options: TableServiceOptions) {
    this.tableId = options.tableId;
    this.commandLog = [];
    this.eventLog = [];
    this.handHistoryById = new Map();

    if (options.restoredState) {
      if (options.restoredState.tableId !== this.tableId) {
        throw new Error(
          `Restored table id ${options.restoredState.tableId} does not match configured table id ${this.tableId}.`,
        );
      }

      this.state = cloneDeep(options.restoredState.state);
      this.commandSequence = options.restoredState.commandSequence;
      this.eventSequence = options.restoredState.eventSequence;
      this.commandLog.push(...cloneDeep(options.restoredState.commandLog));
      this.eventLog.push(...cloneDeep(options.restoredState.eventLog));

      for (const history of options.restoredState.handHistory) {
        this.handHistoryById.set(history.handId, cloneDeep(history));
      }

      return;
    }

    this.state = cloneDeep(options.initialState ?? createDefaultTableState());
    this.commandSequence = 0;
    this.eventSequence = 0;
  }

  public getSnapshot(): TableSnapshot {
    return {
      tableId: this.tableId,
      generatedAt: nowIso(),
      commandSequence: this.commandSequence,
      eventSequence: this.eventSequence,
      state: cloneDeep(this.state),
      actionState: buildTableActionStateDTO(this.state),
    };
  }

  public getCommandLog(limit?: number): CommandRecord[] {
    const records = limit === undefined ? this.commandLog : this.commandLog.slice(-Math.max(0, limit));
    return cloneDeep(records);
  }

  public getEventLog(limit?: number): EventRecord[] {
    const records = limit === undefined ? this.eventLog : this.eventLog.slice(-Math.max(0, limit));
    return cloneDeep(records);
  }

  public listHandSummaries(): HandHistorySummary[] {
    return Array.from(this.handHistoryById.values())
      .map((history) => ({
        handId: history.handId,
        startedAt: history.startedAt,
        completedAt: history.completedAt,
        commandCount: history.commands.length,
        eventCount: history.events.length,
      }))
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  }

  public getHandHistory(handId: string): HandHistory {
    const history = this.handHistoryById.get(handId);
    if (!history) {
      throw new Error(`Hand ${handId} was not found.`);
    }

    return cloneDeep(history);
  }

  public replayHand(handId: string): HandReplayResult {
    const history = this.getHandHistory(handId);
    let replayState = cloneDeep(history.startSnapshot);

    for (const commandRecord of history.commands) {
      const result = applyTexasHoldemCommand(replayState, cloneDeep(commandRecord.command));
      replayState = result.state;
    }

    return {
      handId,
      commandCount: history.commands.length,
      eventCount: history.events.length,
      replayedFinalState: replayState,
      matchesRecordedFinalState: history.finalSnapshot ? statesMatch(history.finalSnapshot, replayState) : null,
    };
  }

  public exportState(): TableServiceStateSnapshot {
    return {
      tableId: this.tableId,
      state: cloneDeep(this.state),
      commandSequence: this.commandSequence,
      eventSequence: this.eventSequence,
      commandLog: cloneDeep(this.commandLog),
      eventLog: cloneDeep(this.eventLog),
      handHistory: cloneDeep(Array.from(this.handHistoryById.values()).sort((left, right) =>
        left.startedAt.localeCompare(right.startedAt),
      )),
    };
  }

  public applyCommand(command: TableCommand): ApplyCommandResult {
    if (command.type === 'START_HAND') {
      if (!STARTABLE_PHASES.includes(this.state.phase)) {
        throw new Error(
          `START_HAND is only allowed in phases ${STARTABLE_PHASES.join(', ')}. Current phase: ${this.state.phase}.`,
        );
      }

      if (this.handHistoryById.has(command.handId)) {
        throw new Error(`Hand ${command.handId} already exists in history.`);
      }
    }

    const createdAt = nowIso();
    const handId = command.type === 'START_HAND' ? command.handId : this.state.handId;
    const beforePhase = this.state.phase;

    let history = this.handHistoryById.get(handId);
    if (!history) {
      history = buildHandHistory(handId, createdAt, cloneDeep(this.state));
      this.handHistoryById.set(handId, history);
    }

    const commandForEngine = cloneDeep(command);
    const result = applyTexasHoldemCommand(this.state, commandForEngine);
    this.state = result.state;

    this.commandSequence += 1;
    const commandRecord: CommandRecord = {
      sequence: this.commandSequence,
      handId,
      createdAt,
      beforePhase,
      afterPhase: this.state.phase,
      command: cloneDeep(command),
    };

    this.commandLog.push(commandRecord);
    history.commands.push(commandRecord);

    const events: EventRecord[] = result.events.map((event) => {
      this.eventSequence += 1;
      const eventRecord: EventRecord = {
        sequence: this.eventSequence,
        commandSequence: this.commandSequence,
        handId,
        createdAt,
        event: cloneDeep(event),
      };

      this.eventLog.push(eventRecord);
      history.events.push(eventRecord);
      return eventRecord;
    });

    if (this.state.phase === 'HAND_COMPLETE') {
      history.completedAt = createdAt;
      history.finalSnapshot = cloneDeep(this.state);
    }

    return {
      command: cloneDeep(commandRecord),
      events: cloneDeep(events),
      snapshot: this.getSnapshot(),
    };
  }
}
