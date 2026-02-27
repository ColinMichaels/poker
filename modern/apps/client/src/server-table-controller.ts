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
const STREAM_RECONNECT_BASE_MS = 350;
const STREAM_RECONNECT_MAX_MS = 6_000;
const STREAM_STALE_MIN_TIMEOUT_MS = 4_000;
const STREAM_COMMAND_TIMEOUT_MS = 4_500;

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

interface ServerTableStreamSnapshotMessage {
  type: 'TABLE_SNAPSHOT';
  tableId: string;
  generatedAt: string;
  commandSequence: number;
  eventSequence: number;
  snapshot: ServerTableSnapshot;
}

interface ServerTableStreamHeartbeatMessage {
  type: 'TABLE_HEARTBEAT';
  sentAt: string;
}

interface ServerTableStreamApplyCommandMessage {
  type: 'APPLY_COMMAND';
  commandId: string;
  command: TableCommand;
  authToken?: string;
}

interface ServerTableStreamCommandAckMessage {
  type: 'COMMAND_ACK';
  commandId: string;
  acceptedAt: string;
  tableId: string;
  result: ServerApplyCommandResult;
}

interface ServerTableStreamCommandErrorMessage {
  type: 'COMMAND_ERROR';
  commandId: string;
  code: string;
  message: string;
}

export type StreamCommandTelemetryKind =
  | 'WS_COMMAND_SENT'
  | 'WS_COMMAND_ACK'
  | 'WS_COMMAND_ERROR'
  | 'WS_COMMAND_TIMEOUT'
  | 'WS_COMMAND_ABORTED'
  | 'WS_COMMAND_FALLBACK_HTTP';

export interface StreamCommandTelemetryEvent {
  kind: StreamCommandTelemetryKind;
  timestamp: string;
  commandId?: string;
  commandType?: TableCommand['type'];
  action?: PokerAction;
  latencyMs?: number;
  code?: string;
  reason?: string;
  inFlightCommands: number;
}

interface ServerTableControllerOptions {
  userSeatId: number;
  snapshotUrl: string;
  commandUrl: string;
  seatClaimUrl?: string;
  streamUrl?: string;
  streamCommandChannelEnabled?: boolean;
  streamCommandTelemetryReporter?: (event: StreamCommandTelemetryEvent) => void;
  streamCommandTimeoutMs?: number;
  pollIntervalMs?: number;
  fetchImpl?: typeof fetch;
}

interface PendingStreamCommand {
  timeoutId: number;
  startedAtMs: number;
  command: TableCommand;
  resolve: (result: ServerApplyCommandResult) => void;
  reject: (error: Error) => void;
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

function parseStreamSnapshotMessage(value: unknown): ServerTableSnapshot | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.type !== 'TABLE_SNAPSHOT') {
    return null;
  }

  if (!record.snapshot) {
    return null;
  }

  try {
    const streamMessage = record as unknown as ServerTableStreamSnapshotMessage;
    return parseSnapshot(streamMessage.snapshot);
  } catch {
    return null;
  }
}

function isStreamHeartbeatMessage(value: unknown): value is ServerTableStreamHeartbeatMessage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.type === 'TABLE_HEARTBEAT' && typeof record.sentAt === 'string';
}

function parseStreamCommandAckMessage(value: unknown): ServerTableStreamCommandAckMessage | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.type !== 'COMMAND_ACK' || typeof record.commandId !== 'string') {
    return null;
  }

  try {
    return {
      type: 'COMMAND_ACK',
      commandId: record.commandId,
      acceptedAt: typeof record.acceptedAt === 'string' ? record.acceptedAt : '',
      tableId: typeof record.tableId === 'string' ? record.tableId : '',
      result: parseApplyCommandResult(record.result),
    };
  } catch {
    return null;
  }
}

function parseStreamCommandErrorMessage(value: unknown): ServerTableStreamCommandErrorMessage | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    record.type !== 'COMMAND_ERROR'
    || typeof record.commandId !== 'string'
    || typeof record.code !== 'string'
    || typeof record.message !== 'string'
  ) {
    return null;
  }

  return {
    type: 'COMMAND_ERROR',
    commandId: record.commandId,
    code: record.code,
    message: record.message,
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
  private readonly streamUrl: string | null;
  private readonly streamCommandChannelEnabled: boolean;
  private readonly streamCommandTelemetryReporter: ((event: StreamCommandTelemetryEvent) => void) | null;
  private readonly streamCommandTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly fetchImpl: typeof fetch;

  private readonly listeners = new Set<Listener>();
  private latestSnapshot: ServerTableSnapshot | null = null;
  private lastSnapshotVersion: string | null = null;
  private seatClaimContextKey: string | null = null;
  private pollTimerId: number | null = null;
  private streamSocket: WebSocket | null = null;
  private streamConnected = false;
  private reconnectTimerId: number | null = null;
  private streamHealthTimerId: number | null = null;
  private reconnectAttempt = 0;
  private lastStreamMessageAtMs = 0;
  private lastStreamFallbackReason: string | null = null;
  private nextStreamCommandId = 1;
  private readonly pendingStreamCommands = new Map<string, PendingStreamCommand>();
  private operationChain: Promise<void> = Promise.resolve();
  private logs: TableLogEntry[] = [];
  private nextLogId = 1;
  private nextGeneratedHandNumber = 1;

  public constructor(options: ServerTableControllerOptions) {
    this.userSeatId = options.userSeatId;
    this.snapshotUrl = options.snapshotUrl;
    this.commandUrl = options.commandUrl;
    this.seatClaimUrl = options.seatClaimUrl ?? null;
    this.streamUrl = options.streamUrl ?? null;
    this.streamCommandChannelEnabled = options.streamCommandChannelEnabled ?? false;
    this.streamCommandTelemetryReporter = options.streamCommandTelemetryReporter ?? null;
    this.streamCommandTimeoutMs = options.streamCommandTimeoutMs ?? STREAM_COMMAND_TIMEOUT_MS;
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

    this.startStream();
    void this.refreshSnapshot('initial');
    this.pollTimerId = window.setInterval(() => {
      void this.refreshSnapshot('poll');
    }, this.pollIntervalMs);
    this.startStreamHealthCheck();
  }

  private stopPolling(): void {
    this.stopStream();
    if (this.streamHealthTimerId !== null) {
      window.clearInterval(this.streamHealthTimerId);
      this.streamHealthTimerId = null;
    }

    if (this.pollTimerId !== null) {
      window.clearInterval(this.pollTimerId);
      this.pollTimerId = null;
    }
  }

  private async refreshSnapshot(source: 'initial' | 'poll'): Promise<void> {
    if (source === 'poll' && this.streamConnected && !this.isStreamStale()) {
      return;
    }

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

  private startStream(): void {
    if (!this.streamUrl || this.streamSocket || this.reconnectTimerId !== null) {
      return;
    }

    this.connectStream();
  }

  private connectStream(): void {
    if (!this.streamUrl) {
      return;
    }

    let nextSocket: WebSocket;
    try {
      nextSocket = new WebSocket(this.streamUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.streamSocket = nextSocket;
    nextSocket.addEventListener('open', () => {
      if (this.streamSocket !== nextSocket) {
        return;
      }

      this.streamConnected = true;
      this.reconnectAttempt = 0;
      this.lastStreamMessageAtMs = Date.now();
      this.pushLog('SYSTEM', 'Live table stream connected.');
      if (this.latestSnapshot) {
        this.emitSnapshot(this.latestSnapshot);
      }
    });

    nextSocket.addEventListener('message', (event) => {
      if (this.streamSocket !== nextSocket) {
        return;
      }

      if (typeof event.data !== 'string') {
        return;
      }

      let payload: unknown = null;
      try {
        payload = JSON.parse(event.data) as unknown;
      } catch {
        return;
      }

      if (isStreamHeartbeatMessage(payload)) {
        this.lastStreamMessageAtMs = Date.now();
        return;
      }

      const streamCommandAck = parseStreamCommandAckMessage(payload);
      if (streamCommandAck) {
        this.lastStreamMessageAtMs = Date.now();
        const acknowledgedCommand = streamCommandAck.result.command.command;
        const pending = this.pendingStreamCommands.get(streamCommandAck.commandId);
        const latencyMs = pending ? Math.max(0, Date.now() - pending.startedAtMs) : undefined;
        this.reportStreamCommandTelemetry({
          kind: 'WS_COMMAND_ACK',
          commandId: streamCommandAck.commandId,
          command: acknowledgedCommand,
          latencyMs,
        });
        this.resolvePendingStreamCommand(streamCommandAck.commandId, streamCommandAck.result);
        return;
      }

      const streamCommandError = parseStreamCommandErrorMessage(payload);
      if (streamCommandError) {
        this.lastStreamMessageAtMs = Date.now();
        const pending = this.pendingStreamCommands.get(streamCommandError.commandId);
        const latencyMs = pending ? Math.max(0, Date.now() - pending.startedAtMs) : undefined;
        this.reportStreamCommandTelemetry({
          kind: 'WS_COMMAND_ERROR',
          commandId: streamCommandError.commandId,
          command: pending?.command,
          latencyMs,
          code: streamCommandError.code,
          reason: streamCommandError.message,
        });
        this.rejectPendingStreamCommand(streamCommandError.commandId, `${streamCommandError.code}: ${streamCommandError.message}`);
        return;
      }

      const streamSnapshot = parseStreamSnapshotMessage(payload);
      if (!streamSnapshot) {
        return;
      }

      this.lastStreamMessageAtMs = Date.now();
      const changed = this.storeSnapshot(streamSnapshot);
      if (changed) {
        this.emitSnapshot(streamSnapshot);
      }
    });

    nextSocket.addEventListener('close', () => {
      if (this.streamSocket !== nextSocket) {
        return;
      }

      this.streamConnected = false;
      this.streamSocket = null;
      for (const [commandId, pending] of this.pendingStreamCommands.entries()) {
        this.reportStreamCommandTelemetry({
          kind: 'WS_COMMAND_ABORTED',
          commandId,
          command: pending.command,
          latencyMs: Math.max(0, Date.now() - pending.startedAtMs),
          reason: 'stream_disconnected',
        });
      }
      this.rejectAllPendingStreamCommands('Live table stream disconnected before command acknowledgement.');
      this.scheduleReconnect();
    });

    nextSocket.addEventListener('error', () => {
      if (this.streamSocket !== nextSocket) {
        return;
      }

      this.streamConnected = false;
      for (const [commandId, pending] of this.pendingStreamCommands.entries()) {
        this.reportStreamCommandTelemetry({
          kind: 'WS_COMMAND_ABORTED',
          commandId,
          command: pending.command,
          latencyMs: Math.max(0, Date.now() - pending.startedAtMs),
          reason: 'stream_error',
        });
      }
      this.rejectAllPendingStreamCommands('Live table stream error interrupted command acknowledgement.');
      try {
        nextSocket.close();
      } catch {
        // Ignore close errors from errored sockets.
      }
    });
  }

  private stopStream(): void {
    this.streamConnected = false;
    this.lastStreamMessageAtMs = 0;
    this.reconnectAttempt = 0;
    for (const [commandId, pending] of this.pendingStreamCommands.entries()) {
      this.reportStreamCommandTelemetry({
        kind: 'WS_COMMAND_ABORTED',
        commandId,
        command: pending.command,
        latencyMs: Math.max(0, Date.now() - pending.startedAtMs),
        reason: 'stream_stopped',
      });
    }
    this.rejectAllPendingStreamCommands('Live table stream stopped before command acknowledgement.');
    if (this.reconnectTimerId !== null) {
      window.clearTimeout(this.reconnectTimerId);
      this.reconnectTimerId = null;
    }

    if (this.streamSocket) {
      const socketToClose = this.streamSocket;
      this.streamSocket = null;
      try {
        socketToClose.close();
      } catch {
        // Ignore close errors.
      }
    }
  }

  private scheduleReconnect(): void {
    if (!this.streamUrl || this.listeners.size === 0 || this.reconnectTimerId !== null) {
      return;
    }

    const backoffMs = Math.min(STREAM_RECONNECT_MAX_MS, STREAM_RECONNECT_BASE_MS * (2 ** this.reconnectAttempt));
    const jitterMs = Math.floor(Math.random() * 180);
    const delayMs = backoffMs + jitterMs;
    this.reconnectAttempt += 1;
    this.reconnectTimerId = window.setTimeout(() => {
      this.reconnectTimerId = null;
      this.connectStream();
    }, delayMs);
  }

  private startStreamHealthCheck(): void {
    if (this.streamHealthTimerId !== null) {
      return;
    }

    this.streamHealthTimerId = window.setInterval(() => {
      if (!this.streamConnected || !this.streamSocket) {
        return;
      }

      if (!this.isStreamStale()) {
        return;
      }

      this.pushLog('SYSTEM', 'Live table stream is stale; reconnecting.');
      const staleSocket = this.streamSocket;
      this.streamConnected = false;
      this.streamSocket = null;
      try {
        staleSocket.close();
      } catch {
        // Ignore close errors.
      }
      this.scheduleReconnect();
    }, Math.max(1_000, this.pollIntervalMs));
  }

  private isStreamStale(): boolean {
    if (!this.streamConnected) {
      return true;
    }

    const timeoutMs = Math.max(STREAM_STALE_MIN_TIMEOUT_MS, this.pollIntervalMs * 5);
    return Date.now() - this.lastStreamMessageAtMs > timeoutMs;
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
    let result: ServerApplyCommandResult | null = null;
    this.lastStreamFallbackReason = null;
    if (this.streamCommandChannelEnabled) {
      result = await this.tryApplyCommandOverStream(command);
    }

    if (!result) {
      if (this.streamCommandChannelEnabled) {
        this.pushLog('SYSTEM', 'Live command channel unavailable; falling back to HTTP command route.');
        this.reportStreamCommandTelemetry({
          kind: 'WS_COMMAND_FALLBACK_HTTP',
          command,
          reason: this.lastStreamFallbackReason ?? 'stream_unavailable',
        });
      }
      result = await this.applyCommandOverHttp(command);
    }

    this.pushLog('COMMAND', this.describeCommand(command));
    for (const eventRecord of result.events) {
      this.pushLog('EVENT', this.describeEvent(eventRecord.event));
    }

    this.storeSnapshot(result.snapshot);
    this.emitSnapshot(result.snapshot);
    return result.snapshot;
  }

  private async applyCommandOverHttp(command: TableCommand): Promise<ServerApplyCommandResult> {
    const response = await this.fetchImpl(this.commandUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...this.buildCommandAuthHeaders(command),
      },
      body: JSON.stringify(command),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(this.extractHttpError(response.status, payload));
    }

    return parseApplyCommandResult(payload);
  }

  private async tryApplyCommandOverStream(command: TableCommand): Promise<ServerApplyCommandResult | null> {
    if (!this.streamSocket || !this.streamConnected) {
      this.lastStreamFallbackReason = 'stream_not_connected';
      return null;
    }

    const socket = this.streamSocket;
    const readyState = (socket as unknown as { readyState?: number }).readyState;
    if (typeof readyState === 'number' && readyState !== 1) {
      this.lastStreamFallbackReason = 'stream_not_open';
      return null;
    }

    const commandId = this.createNextStreamCommandId();
    const authToken = this.resolveStreamCommandAuthToken(command);
    const message: ServerTableStreamApplyCommandMessage = {
      type: 'APPLY_COMMAND',
      commandId,
      command,
      authToken,
    };

    return new Promise<ServerApplyCommandResult>((resolve, reject) => {
      const startedAtMs = Date.now();
      const timeoutId = window.setTimeout(() => {
        this.pendingStreamCommands.delete(commandId);
        this.reportStreamCommandTelemetry({
          kind: 'WS_COMMAND_TIMEOUT',
          commandId,
          command,
          latencyMs: Math.max(0, Date.now() - startedAtMs),
          reason: 'ack_timeout',
        });
        reject(new Error('Timed out waiting for stream command acknowledgement.'));
      }, this.streamCommandTimeoutMs);

      this.pendingStreamCommands.set(commandId, {
        timeoutId,
        startedAtMs,
        command,
        resolve,
        reject,
      });
      this.reportStreamCommandTelemetry({
        kind: 'WS_COMMAND_SENT',
        commandId,
        command,
      });

      try {
        socket.send(JSON.stringify(message));
      } catch {
        this.clearPendingStreamCommand(commandId);
        this.lastStreamFallbackReason = 'stream_send_failed';
        reject(new Error('Stream command send failed.'));
      }
    }).catch((error) => {
      if (error instanceof Error) {
        if (error.message === 'Timed out waiting for stream command acknowledgement.') {
          throw error;
        }

        if (error.message === 'Stream command send failed.') {
          return null;
        }
      }

      throw error;
    });
  }

  private resolveStreamCommandAuthToken(command: TableCommand): string | undefined {
    if (command.type !== 'PLAYER_ACTION') {
      return undefined;
    }

    return this.readSessionToken() ?? undefined;
  }

  private createNextStreamCommandId(): string {
    const id = this.nextStreamCommandId;
    this.nextStreamCommandId += 1;
    return `ws-command-${Date.now()}-${id}`;
  }

  private resolvePendingStreamCommand(commandId: string, result: ServerApplyCommandResult): void {
    const pending = this.pendingStreamCommands.get(commandId);
    if (!pending) {
      return;
    }

    window.clearTimeout(pending.timeoutId);
    this.pendingStreamCommands.delete(commandId);
    pending.resolve(result);
  }

  private rejectPendingStreamCommand(commandId: string, reason: string): void {
    const pending = this.pendingStreamCommands.get(commandId);
    if (!pending) {
      return;
    }

    window.clearTimeout(pending.timeoutId);
    this.pendingStreamCommands.delete(commandId);
    pending.reject(new Error(reason));
  }

  private clearPendingStreamCommand(commandId: string): void {
    const pending = this.pendingStreamCommands.get(commandId);
    if (!pending) {
      return;
    }

    window.clearTimeout(pending.timeoutId);
    this.pendingStreamCommands.delete(commandId);
  }

  private rejectAllPendingStreamCommands(reason: string): void {
    for (const commandId of this.pendingStreamCommands.keys()) {
      this.rejectPendingStreamCommand(commandId, reason);
    }
  }

  private reportStreamCommandTelemetry(input: {
    kind: StreamCommandTelemetryKind;
    commandId?: string;
    command?: TableCommand;
    latencyMs?: number;
    code?: string;
    reason?: string;
  }): void {
    if (!this.streamCommandTelemetryReporter) {
      return;
    }

    const event: StreamCommandTelemetryEvent = {
      kind: input.kind,
      timestamp: new Date().toISOString(),
      commandId: input.commandId,
      commandType: input.command?.type,
      action: input.command?.type === 'PLAYER_ACTION' ? input.command.action : undefined,
      latencyMs: input.latencyMs,
      code: input.code,
      reason: input.reason,
      inFlightCommands: this.pendingStreamCommands.size,
    };
    this.streamCommandTelemetryReporter(event);
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

  private buildCommandAuthHeaders(command: TableCommand): Record<string, string> {
    if (command.type !== 'PLAYER_ACTION') {
      return {};
    }

    return this.buildAuthHeaders();
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
