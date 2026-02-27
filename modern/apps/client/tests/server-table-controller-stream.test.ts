import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerTableController, type StreamCommandTelemetryEvent } from '../src/server-table-controller.ts';

type MockSocketEventType = 'open' | 'message' | 'close' | 'error';
type MockSocketListener = (event: { data?: unknown }) => void;

class MockWebSocket {
  public static instances: MockWebSocket[] = [];
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;
  public readonly url: string;
  public readyState = MockWebSocket.CONNECTING;
  public readonly sentMessages: string[] = [];
  private readonly listeners: Record<MockSocketEventType, MockSocketListener[]> = {
    open: [],
    message: [],
    close: [],
    error: [],
  };

  public constructor(url: string | URL) {
    this.url = String(url);
    MockWebSocket.instances.push(this);
  }

  public addEventListener(type: MockSocketEventType, listener: MockSocketListener): void {
    this.listeners[type].push(listener);
  }

  public close(): void {
    if (this.readyState === MockWebSocket.CLOSED) {
      return;
    }

    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', {});
  }

  public emitOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.emit('open', {});
  }

  public emitMessage(data: string): void {
    this.emit('message', { data });
  }

  public emitError(): void {
    this.emit('error', {});
  }

  public send(payload: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open.');
    }

    this.sentMessages.push(payload);
  }

  private emit(type: MockSocketEventType, event: { data?: unknown }): void {
    for (const listener of this.listeners[type]) {
      listener(event);
    }
  }
}

function createSnapshot(sequence: number): unknown {
  return createSnapshotWithState(sequence, {
    handId: `hand-${String(sequence).padStart(4, '0')}`,
    phase: 'SEATED',
    actingSeatId: 0,
  });
}

function createSnapshotWithState(
  sequence: number,
  stateOverrides: {
    handId?: string;
    phase?: string;
    actingSeatId?: number;
  },
): unknown {
  return {
    tableId: 'atlas-01',
    commandSequence: sequence,
    eventSequence: sequence,
    state: {
      handId: stateOverrides.handId ?? `hand-${String(sequence).padStart(4, '0')}`,
      phase: stateOverrides.phase ?? 'SEATED',
      actingSeatId: stateOverrides.actingSeatId ?? 0,
    },
    actionState: {
      seats: [],
    },
  };
}

function createApplyCommandResult(command: unknown, snapshot: unknown): unknown {
  return {
    command: {
      command,
    },
    events: [],
    snapshot,
  };
}

function createCommandAckMessage(commandId: string, command: unknown, snapshot: unknown): string {
  return JSON.stringify({
    type: 'COMMAND_ACK',
    commandId,
    acceptedAt: '2026-01-01T00:00:05.000Z',
    tableId: 'atlas-01',
    result: createApplyCommandResult(command, snapshot),
  });
}

function createStreamSnapshotMessage(sequence: number): string {
  const snapshot = createSnapshot(sequence);
  return JSON.stringify({
    type: 'TABLE_SNAPSHOT',
    tableId: 'atlas-01',
    generatedAt: '2026-01-01T00:00:00.000Z',
    commandSequence: sequence,
    eventSequence: sequence,
    snapshot,
  });
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('server table controller stream sync', () => {
  const originalWindow = globalThis.window;
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    MockWebSocket.instances = [];
    (globalThis as { window?: unknown }).window = globalThis;
    (globalThis as { WebSocket: typeof WebSocket }).WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
    (globalThis as { WebSocket: typeof WebSocket }).WebSocket = originalWebSocket;
  });

  it('continues polling while websocket stream is disconnected', async () => {
    let sequence = 1;
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(createSnapshot(sequence++)), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }));

    const controller = new ServerTableController({
      userSeatId: 1,
      snapshotUrl: '/api/table/state?tableId=atlas-01',
      commandUrl: '/api/table/command?tableId=atlas-01',
      streamUrl: 'ws://example.test/api/table/ws?tableId=atlas-01',
      pollIntervalMs: 200,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const unsubscribe = controller.subscribe(() => {});
    await flushAsync();
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(650);
    await flushAsync();

    expect(fetchImpl.mock.calls.length).toBeGreaterThan(1);
    unsubscribe();
  });

  it('skips polling refreshes when websocket stream is connected and fresh', async () => {
    let sequence = 1;
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(createSnapshot(sequence++)), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }));

    const controller = new ServerTableController({
      userSeatId: 1,
      snapshotUrl: '/api/table/state?tableId=atlas-01',
      commandUrl: '/api/table/command?tableId=atlas-01',
      streamUrl: 'ws://example.test/api/table/ws?tableId=atlas-01',
      pollIntervalMs: 200,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const unsubscribe = controller.subscribe(() => {});
    await flushAsync();
    expect(MockWebSocket.instances).toHaveLength(1);

    const socket = MockWebSocket.instances[0];
    socket.emitOpen();
    socket.emitMessage(createStreamSnapshotMessage(99));
    await flushAsync();

    const fetchCallsAfterStreamConnected = fetchImpl.mock.calls.length;
    vi.advanceTimersByTime(1_200);
    await flushAsync();

    expect(fetchImpl).toHaveBeenCalledTimes(fetchCallsAfterStreamConnected);
    unsubscribe();
  });

  it('reconnects stale websocket streams and resumes polling fallback during reconnect', async () => {
    let sequence = 1;
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(createSnapshot(sequence++)), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }));
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const controller = new ServerTableController({
      userSeatId: 1,
      snapshotUrl: '/api/table/state?tableId=atlas-01',
      commandUrl: '/api/table/command?tableId=atlas-01',
      streamUrl: 'ws://example.test/api/table/ws?tableId=atlas-01',
      pollIntervalMs: 200,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const unsubscribe = controller.subscribe(() => {});
    await flushAsync();

    const firstSocket = MockWebSocket.instances[0];
    firstSocket.emitOpen();
    firstSocket.emitMessage(JSON.stringify({
      type: 'TABLE_HEARTBEAT',
      sentAt: '2026-01-01T00:00:00.000Z',
    }));
    await flushAsync();

    const baselineFetchCalls = fetchImpl.mock.calls.length;
    vi.advanceTimersByTime(5_100);
    await flushAsync();

    vi.advanceTimersByTime(351);
    await flushAsync();

    expect(MockWebSocket.instances).toHaveLength(2);
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(baselineFetchCalls);
    unsubscribe();
  });

  it('submits player actions over websocket command channel when connected', async () => {
    const initialSnapshot = createSnapshotWithState(1, {
      handId: 'hand-0001',
      phase: 'BETTING_PRE_FLOP',
      actingSeatId: 1,
    });
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(initialSnapshot), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }));

    const telemetryEvents: StreamCommandTelemetryEvent[] = [];
    const controller = new ServerTableController({
      userSeatId: 1,
      snapshotUrl: '/api/table/state?tableId=atlas-01',
      commandUrl: '/api/table/command?tableId=atlas-01',
      streamUrl: 'ws://example.test/api/table/ws?tableId=atlas-01',
      streamCommandChannelEnabled: true,
      streamCommandTelemetryReporter: (event) => {
        telemetryEvents.push(event);
      },
      pollIntervalMs: 200,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const unsubscribe = controller.subscribe(() => {});
    await flushAsync();

    const socket = MockWebSocket.instances[0];
    socket.emitOpen();
    await flushAsync();

    controller.performUserAction({ action: 'FOLD' });
    for (let step = 0; step < 8; step += 1) {
      await flushAsync();
    }

    expect(socket.sentMessages).toHaveLength(1);
    const outgoing = JSON.parse(socket.sentMessages[0]) as {
      type: string;
      commandId: string;
      command: {
        type: string;
        seatId: number;
        action: string;
      };
      authToken?: string;
    };
    expect(outgoing.type).toBe('APPLY_COMMAND');
    expect(outgoing.command.type).toBe('PLAYER_ACTION');
    expect(outgoing.command.seatId).toBe(1);
    expect(outgoing.command.action).toBe('FOLD');
    expect(outgoing.authToken).toBeUndefined();

    socket.emitMessage(
      createCommandAckMessage(
        outgoing.commandId,
        outgoing.command,
        createSnapshotWithState(2, {
          handId: 'hand-0001',
          phase: 'BETTING_PRE_FLOP',
          actingSeatId: 2,
        }),
      ),
    );
    await flushAsync();

    const postCalls = fetchImpl.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === 'POST');
    expect(postCalls).toHaveLength(0);
    expect(telemetryEvents.some((event) => event.kind === 'WS_COMMAND_SENT')).toBe(true);
    expect(telemetryEvents.some((event) => event.kind === 'WS_COMMAND_ACK')).toBe(true);
    unsubscribe();
  });

  it('falls back to HTTP command route when websocket command channel is unavailable', async () => {
    const initialSnapshot = createSnapshotWithState(1, {
      handId: 'hand-0001',
      phase: 'BETTING_PRE_FLOP',
      actingSeatId: 1,
    });
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'POST') {
        const command = JSON.parse(String(init?.body ?? '{}')) as unknown;
        return new Response(
          JSON.stringify(
            createApplyCommandResult(
              command,
              createSnapshotWithState(2, {
                handId: 'hand-0001',
                phase: 'BETTING_PRE_FLOP',
                actingSeatId: 2,
              }),
            ),
          ),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      }

      return new Response(JSON.stringify(initialSnapshot), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    });

    const telemetryEvents: StreamCommandTelemetryEvent[] = [];
    const controller = new ServerTableController({
      userSeatId: 1,
      snapshotUrl: '/api/table/state?tableId=atlas-01',
      commandUrl: '/api/table/command?tableId=atlas-01',
      streamUrl: 'ws://example.test/api/table/ws?tableId=atlas-01',
      streamCommandChannelEnabled: true,
      streamCommandTelemetryReporter: (event) => {
        telemetryEvents.push(event);
      },
      pollIntervalMs: 200,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const unsubscribe = controller.subscribe(() => {});
    await flushAsync();

    expect(MockWebSocket.instances).toHaveLength(1);
    const socket = MockWebSocket.instances[0];
    expect(socket.sentMessages).toHaveLength(0);

    controller.performUserAction({ action: 'FOLD' });
    for (let step = 0; step < 8; step += 1) {
      await flushAsync();
    }

    const postCalls = fetchImpl.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === 'POST');
    expect(postCalls).toHaveLength(1);
    expect(socket.sentMessages).toHaveLength(0);
    expect(telemetryEvents.some((event) => event.kind === 'WS_COMMAND_FALLBACK_HTTP')).toBe(true);
    unsubscribe();
  });

  it('emits timeout telemetry when websocket command ack is not received in time', async () => {
    const initialSnapshot = createSnapshotWithState(1, {
      handId: 'hand-0001',
      phase: 'BETTING_PRE_FLOP',
      actingSeatId: 1,
    });
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(initialSnapshot), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }));
    const telemetryEvents: StreamCommandTelemetryEvent[] = [];

    const controller = new ServerTableController({
      userSeatId: 1,
      snapshotUrl: '/api/table/state?tableId=atlas-01',
      commandUrl: '/api/table/command?tableId=atlas-01',
      streamUrl: 'ws://example.test/api/table/ws?tableId=atlas-01',
      streamCommandChannelEnabled: true,
      streamCommandTimeoutMs: 80,
      streamCommandTelemetryReporter: (event) => {
        telemetryEvents.push(event);
      },
      pollIntervalMs: 200,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const unsubscribe = controller.subscribe(() => {});
    await flushAsync();
    const socket = MockWebSocket.instances[0];
    socket.emitOpen();
    await flushAsync();

    controller.performUserAction({ action: 'FOLD' });
    for (let step = 0; step < 8; step += 1) {
      await flushAsync();
    }

    vi.advanceTimersByTime(90);
    for (let step = 0; step < 8; step += 1) {
      await flushAsync();
    }

    expect(telemetryEvents.some((event) => event.kind === 'WS_COMMAND_TIMEOUT')).toBe(true);
    unsubscribe();
  });
});
