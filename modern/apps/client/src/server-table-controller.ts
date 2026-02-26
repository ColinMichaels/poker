import type {
  ActionOptionDTO,
  DomainEvent,
  PokerAction,
  SeatActionStateDTO,
  TableActionStateDTO,
  TableCommand,
  TablePhase,
  TexasHoldemState,
} from '@poker/poker-engine';
import { readStoredServerSession } from './auth/server-session-store.ts';
import type { TableController, TableLogEntry, TableLogKind, TableViewModel, UserActionIntent } from './table-controller.ts';

const MAX_LOGS = 120;
const BETTING_PHASES: readonly TablePhase[] = ['BETTING_PRE_FLOP', 'BETTING_FLOP', 'BETTING_TURN', 'BETTING_RIVER'];
const STARTABLE_PHASES: readonly TablePhase[] = ['SEATED', 'HAND_COMPLETE'];

interface ServerTableSnapshot {
  tableId: string;
  commandSequence: number;
  eventSequence: number;
  state: TexasHoldemState;
  actionState: TableActionStateDTO;
}

interface ServerCommandRecord {
  command: TableCommand;
}

interface ServerEventRecord {
  event: DomainEvent;
}

interface ServerApplyCommandResult {
  command: ServerCommandRecord;
  events: ServerEventRecord[];
  snapshot: ServerTableSnapshot;
}

interface ServerTableControllerOptions {
  userSeatId: number;
  snapshotUrl: string;
  commandUrl: string;
  seatClaimUrl?: string;
  pollIntervalMs?: number;
  fetchImpl?: typeof fetch;
}

type Listener = (model: TableViewModel) => void;

function isBettingPhase(phase: TablePhase): boolean {
  return BETTING_PHASES.includes(phase);
}

function isStartablePhase(phase: TablePhase): boolean {
  return STARTABLE_PHASES.includes(phase);
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function parseSnapshot(value: unknown): ServerTableSnapshot {
  const record = requireObject(value, 'table snapshot');
  if (
    typeof record.tableId !== 'string'
    || typeof record.commandSequence !== 'number'
    || typeof record.eventSequence !== 'number'
  ) {
    throw new Error('table snapshot shape is invalid.');
  }

  return record as unknown as ServerTableSnapshot;
}

function parseApplyCommandResult(value: unknown): ServerApplyCommandResult {
  const record = requireObject(value, 'apply command result');
  if (!record.snapshot) {
    throw new Error('apply command response is missing snapshot.');
  }

  const snapshot = parseSnapshot(record.snapshot);
  const commandRecord = requireObject(record.command, 'apply command response command') as unknown as ServerCommandRecord;
  const eventRecords = Array.isArray(record.events) ? (record.events as ServerEventRecord[]) : [];

  return {
    command: commandRecord,
    events: eventRecords,
    snapshot,
  };
}

function truncate(value: string, max = 140): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}...`;
}

function createCommandSeed(): number {
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] >>> 0;
  }

  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
}

function findAllowedOption(options: readonly ActionOptionDTO[], action: PokerAction): ActionOptionDTO | null {
  return options.find((option) => option.action === action && option.allowed) ?? null;
}

function resolveCommandAmount(option: ActionOptionDTO): number | undefined {
  if (option.amountSemantics !== 'TARGET_BET') {
    return undefined;
  }

  return option.minAmount ?? undefined;
}

function toPlayerActionCommand(seatId: number, option: ActionOptionDTO): TableCommand {
  const command: TableCommand = {
    type: 'PLAYER_ACTION',
    seatId,
    action: option.action,
  };

  const amount = resolveCommandAmount(option);
  if (typeof amount === 'number') {
    command.amount = amount;
  }

  return command;
}

export function selectAutomatedActionCommand(actingSeat: SeatActionStateDTO): TableCommand | null {
  const seatId = actingSeat.seatId;
  const fold = findAllowedOption(actingSeat.actions, 'FOLD');
  const check = findAllowedOption(actingSeat.actions, 'CHECK');
  const call = findAllowedOption(actingSeat.actions, 'CALL');
  const bet = findAllowedOption(actingSeat.actions, 'BET');
  const raise = findAllowedOption(actingSeat.actions, 'RAISE');
  const allIn = findAllowedOption(actingSeat.actions, 'ALL_IN');

  if (actingSeat.toCall > 0) {
    if (call) {
      return toPlayerActionCommand(seatId, call);
    }
    if (fold) {
      return toPlayerActionCommand(seatId, fold);
    }
    if (allIn) {
      return toPlayerActionCommand(seatId, allIn);
    }
    if (raise) {
      return toPlayerActionCommand(seatId, raise);
    }
    if (bet) {
      return toPlayerActionCommand(seatId, bet);
    }
    return null;
  }

  if (check) {
    return toPlayerActionCommand(seatId, check);
  }
  if (bet) {
    return toPlayerActionCommand(seatId, bet);
  }
  if (raise) {
    return toPlayerActionCommand(seatId, raise);
  }
  if (allIn) {
    return toPlayerActionCommand(seatId, allIn);
  }
  if (call) {
    return toPlayerActionCommand(seatId, call);
  }
  if (fold) {
    return toPlayerActionCommand(seatId, fold);
  }
  return null;
}

export class ServerTableController implements TableController {
  private readonly userSeatId: number;
  private readonly snapshotUrl: string;
  private readonly commandUrl: string;
  private readonly seatClaimUrl: string | null;
  private readonly pollIntervalMs: number;
  private readonly fetchImpl: typeof fetch;

  private readonly listeners = new Set<Listener>();
  private latestSnapshot: ServerTableSnapshot | null = null;
  private lastSnapshotVersion: string | null = null;
  private seatClaimContextKey: string | null = null;
  private pollTimerId: number | null = null;
  private operationChain: Promise<void> = Promise.resolve();
  private logs: TableLogEntry[] = [];
  private nextLogId = 1;
  private nextGeneratedHandNumber = 1;

  public constructor(options: ServerTableControllerOptions) {
    this.userSeatId = options.userSeatId;
    this.snapshotUrl = options.snapshotUrl;
    this.commandUrl = options.commandUrl;
    this.seatClaimUrl = options.seatClaimUrl ?? null;
    this.pollIntervalMs = options.pollIntervalMs ?? 900;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.latestSnapshot) {
      listener(this.toViewModel(this.latestSnapshot));
    }

    if (this.listeners.size === 1) {
      this.startPolling();
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stopPolling();
      }
    };
  }

  public startNextHand(): void {
    this.enqueue(async () => {
      let snapshot = await this.ensureSnapshot();
      if (!isStartablePhase(snapshot.state.phase)) {
        this.pushLog('ERROR', `Cannot start a hand from phase ${snapshot.state.phase}.`);
        this.emitSnapshot(snapshot);
        return;
      }

      const handId = this.createNextHandId(snapshot.state.handId);
      snapshot = await this.applyCommand({
        type: 'START_HAND',
        handId,
        seed: createCommandSeed(),
      });
      snapshot = await this.applyCommand({ type: 'POST_BLINDS' });
      snapshot = await this.applyCommand({ type: 'DEAL_HOLE' });
      await this.runAutomationLoop(snapshot);
    }, 'Unable to start next hand.');
  }

  public performUserAction(intent: UserActionIntent): void {
    this.enqueue(async () => {
      let snapshot = await this.ensureSnapshot();
      if (!isBettingPhase(snapshot.state.phase)) {
        this.pushLog('ERROR', `Cannot act in phase ${snapshot.state.phase}.`);
        this.emitSnapshot(snapshot);
        return;
      }

      if (snapshot.state.actingSeatId !== this.userSeatId) {
        this.pushLog('ERROR', `Seat ${this.userSeatId} is not currently acting.`);
        this.emitSnapshot(snapshot);
        return;
      }

      const command: TableCommand = {
        type: 'PLAYER_ACTION',
        seatId: this.userSeatId,
        action: intent.action,
      };
      if (typeof intent.amount === 'number') {
        command.amount = intent.amount;
      }

      snapshot = await this.applyCommand(command);
      await this.runAutomationLoop(snapshot);
    }, `Unable to apply ${intent.action}.`);
  }

  private enqueue(operation: () => Promise<void>, message: string): void {
    this.operationChain = this.operationChain
      .then(operation)
      .catch((error) => {
        const reason = error instanceof Error ? error.message : String(error);
        this.pushLog('ERROR', `${message} ${reason}`);
        if (this.latestSnapshot) {
          this.emitSnapshot(this.latestSnapshot);
        }
      });
  }

  private startPolling(): void {
    if (this.pollTimerId !== null) {
      return;
    }

    void this.refreshSnapshot('initial');
    this.pollTimerId = window.setInterval(() => {
      void this.refreshSnapshot('poll');
    }, this.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollTimerId !== null) {
      window.clearInterval(this.pollTimerId);
      this.pollTimerId = null;
    }
  }

  private async refreshSnapshot(source: 'initial' | 'poll'): Promise<void> {
    try {
      await this.ensureSeatClaimed();
      const snapshot = await this.fetchSnapshot();
      const changed = this.storeSnapshot(snapshot);
      if (changed || source === 'initial') {
        this.emitSnapshot(snapshot);
      }
    } catch (error) {
      if (source === 'initial') {
        const reason = error instanceof Error ? error.message : String(error);
        this.pushLog('ERROR', `Unable to load table snapshot from server. ${reason}`);
        if (this.latestSnapshot) {
          this.emitSnapshot(this.latestSnapshot);
        }
      }
    }
  }

  private async ensureSnapshot(): Promise<ServerTableSnapshot> {
    await this.ensureSeatClaimed();
    if (this.latestSnapshot) {
      return this.latestSnapshot;
    }

    const snapshot = await this.fetchSnapshot();
    this.storeSnapshot(snapshot);
    this.emitSnapshot(snapshot);
    return snapshot;
  }

  private async runAutomationLoop(initialSnapshot: ServerTableSnapshot): Promise<void> {
    let snapshot = initialSnapshot;

    for (let guard = 0; guard < 256; guard += 1) {
      if (snapshot.state.phase === 'DEAL_FLOP') {
        snapshot = await this.applyCommand({ type: 'DEAL_FLOP' });
        continue;
      }

      if (snapshot.state.phase === 'DEAL_TURN') {
        snapshot = await this.applyCommand({ type: 'DEAL_TURN' });
        continue;
      }

      if (snapshot.state.phase === 'DEAL_RIVER') {
        snapshot = await this.applyCommand({ type: 'DEAL_RIVER' });
        continue;
      }

      if (snapshot.state.phase === 'SHOWDOWN') {
        snapshot = await this.applyCommand({ type: 'RESOLVE_SHOWDOWN' });
        continue;
      }

      if (!isBettingPhase(snapshot.state.phase)) {
        return;
      }

      if (snapshot.state.actingSeatId <= 0 || snapshot.state.actingSeatId === this.userSeatId) {
        return;
      }

      const actingSeat = snapshot.actionState.seats.find((seat) => seat.seatId === snapshot.state.actingSeatId);
      if (!actingSeat) {
        this.pushLog('ERROR', `Unable to resolve action state for seat ${snapshot.state.actingSeatId}.`);
        this.emitSnapshot(snapshot);
        return;
      }

      const command = selectAutomatedActionCommand(actingSeat);
      if (!command) {
        this.pushLog('ERROR', `No legal automated action for seat ${snapshot.state.actingSeatId}.`);
        this.emitSnapshot(snapshot);
        return;
      }

      snapshot = await this.applyCommand(command);
    }

    this.pushLog('ERROR', 'Server automation loop guard reached; stopped to prevent infinite loop.');
    this.emitSnapshot(snapshot);
  }

  private async fetchSnapshot(): Promise<ServerTableSnapshot> {
    const response = await this.fetchImpl(this.snapshotUrl, {
      method: 'GET',
      headers: this.buildAuthHeaders(),
      cache: 'no-store',
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(this.extractHttpError(response.status, payload));
    }

    return parseSnapshot(payload);
  }

  private async applyCommand(command: TableCommand): Promise<ServerTableSnapshot> {
    await this.ensureSeatClaimed();
    const response = await this.fetchImpl(this.commandUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...this.buildAuthHeaders(),
      },
      body: JSON.stringify(command),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(this.extractHttpError(response.status, payload));
    }

    const result = parseApplyCommandResult(payload);
    this.pushLog('COMMAND', this.describeCommand(command));
    for (const eventRecord of result.events) {
      this.pushLog('EVENT', this.describeEvent(eventRecord.event));
    }

    this.storeSnapshot(result.snapshot);
    this.emitSnapshot(result.snapshot);
    return result.snapshot;
  }

  private extractHttpError(statusCode: number, payload: unknown): string {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return `Request failed with HTTP ${statusCode}.`;
    }

    const record = payload as Record<string, unknown>;
    const code = typeof record.error === 'string' ? record.error : `HTTP_${statusCode}`;
    const message = typeof record.message === 'string' ? record.message : 'Request failed.';
    return `${code}: ${message}`;
  }

  private async ensureSeatClaimed(): Promise<void> {
    if (!this.seatClaimUrl) {
      return;
    }

    const sessionToken = this.readSessionToken();
    if (!sessionToken) {
      this.seatClaimContextKey = null;
      return;
    }

    const nextContextKey = `${sessionToken}:${this.userSeatId}`;
    if (this.seatClaimContextKey === nextContextKey) {
      return;
    }

    const response = await this.fetchImpl(this.seatClaimUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        seatId: this.userSeatId,
      }),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(this.extractHttpError(response.status, payload));
    }

    this.seatClaimContextKey = nextContextKey;
    this.pushLog('EVENT', `Seat ${this.userSeatId} claimed for authenticated session.`);
  }

  private buildAuthHeaders(): Record<string, string> {
    const sessionToken = this.readSessionToken();
    if (!sessionToken) {
      return {};
    }

    return {
      authorization: `Bearer ${sessionToken}`,
    };
  }

  private readSessionToken(): string | null {
    const session = readStoredServerSession();
    return session ? session.token : null;
  }

  private storeSnapshot(snapshot: ServerTableSnapshot): boolean {
    const nextVersion = `${snapshot.commandSequence}:${snapshot.eventSequence}:${snapshot.state.handId}`;
    const changed = this.lastSnapshotVersion !== nextVersion;
    this.latestSnapshot = snapshot;
    this.lastSnapshotVersion = nextVersion;
    return changed;
  }

  private createNextHandId(currentHandId: string): string {
    const currentHandNumber = this.resolveHandNumber(currentHandId);
    const nextHandNumber = Math.max(this.nextGeneratedHandNumber, currentHandNumber + 1);
    this.nextGeneratedHandNumber = nextHandNumber + 1;
    return `hand-${String(nextHandNumber).padStart(4, '0')}`;
  }

  private resolveHandNumber(handId: string): number {
    const match = handId.match(/(\d+)(?!.*\d)/);
    if (!match) {
      return 0;
    }

    const parsed = Number.parseInt(match[1], 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  }

  private describeCommand(command: TableCommand): string {
    if (command.type === 'PLAYER_ACTION') {
      const suffix = typeof command.amount === 'number' ? ` ${command.amount}` : '';
      return `${command.type} seat=${command.seatId} action=${command.action}${suffix}`;
    }

    if (command.type === 'START_HAND') {
      return `${command.type} hand=${command.handId} seed=${command.seed ?? 'auto'}`;
    }

    return command.type;
  }

  private describeEvent(event: DomainEvent): string {
    const payloadText = truncate(JSON.stringify(event.payload));
    return `${event.type} ${payloadText}`;
  }

  private pushLog(kind: TableLogKind, message: string): void {
    this.logs.push({
      id: this.nextLogId,
      timestamp: new Date().toISOString().slice(11, 19),
      kind,
      message,
    });
    this.nextLogId += 1;

    if (this.logs.length > MAX_LOGS) {
      this.logs.splice(0, this.logs.length - MAX_LOGS);
    }
  }

  private toViewModel(snapshot: ServerTableSnapshot): TableViewModel {
    return {
      state: snapshot.state,
      actionState: snapshot.actionState,
      userSeatId: this.userSeatId,
      handNumber: this.resolveHandNumber(snapshot.state.handId),
      logs: [...this.logs],
    };
  }

  private emitSnapshot(snapshot: ServerTableSnapshot): void {
    const model = this.toViewModel(snapshot);
    for (const listener of this.listeners) {
      listener(model);
    }
  }
}
