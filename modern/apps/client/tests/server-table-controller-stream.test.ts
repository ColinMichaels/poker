import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerTableController } from '../src/server-table-controller.ts';

type MockSocketEventType = 'open' | 'message' | 'close' | 'error';
type MockSocketListener = (event: { data?: unknown }) => void;

class MockWebSocket {
  public static instances: MockWebSocket[] = [];
  public readonly url: string;
  public closed = false;
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
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.emit('close', {});
  }

  public emitOpen(): void {
    this.emit('open', {});
  }

  public emitMessage(data: string): void {
    this.emit('message', { data });
  }

  public emitError(): void {
    this.emit('error', {});
  }

  private emit(type: MockSocketEventType, event: { data?: unknown }): void {
    for (const listener of this.listeners[type]) {
      listener(event);
    }
  }
}

function createSnapshot(sequence: number): unknown {
  return {
    tableId: 'atlas-01',
    commandSequence: sequence,
    eventSequence: sequence,
    state: {
      handId: `hand-${String(sequence).padStart(4, '0')}`,
      phase: 'SEATED',
      actingSeatId: 0,
    },
    actionState: {
      seats: [],
    },
  };
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
});
