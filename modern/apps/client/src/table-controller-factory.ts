import { loadClientRuntimeConfig } from './client-runtime-config.ts';
import { ServerTableController, type StreamCommandTelemetryEvent } from './server-table-controller.ts';
import { LocalTableController, type TableController } from './table-controller.ts';

interface RuntimeTableControllerOptions {
  userSeatId: number;
  tableId?: string;
}

export const TABLE_WS_COMMAND_TELEMETRY_EVENT = 'poker:ws-command-telemetry';

function joinBaseUrlAndPath(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.trim();
  if (!normalizedBase) {
    return path;
  }
  return `${normalizedBase}${path}`;
}

function appendTableIdQuery(route: string, tableId: string | undefined): string {
  const normalizedTableId = tableId?.trim();
  if (!normalizedTableId) {
    return route;
  }

  return `${route}${route.includes('?') ? '&' : '?'}tableId=${encodeURIComponent(normalizedTableId)}`;
}

export function buildTableScopedRouteUrl(baseUrl: string, path: string, tableId?: string): string {
  return appendTableIdQuery(joinBaseUrlAndPath(baseUrl, path), tableId);
}

function toWebSocketUrl(routeUrl: string): string | null {
  const trimmed = routeUrl.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return trimmed;
  }

  if (trimmed.startsWith('http://')) {
    return `ws://${trimmed.slice('http://'.length)}`;
  }

  if (trimmed.startsWith('https://')) {
    return `wss://${trimmed.slice('https://'.length)}`;
  }

  if (!trimmed.startsWith('/')) {
    return null;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${trimmed}`;
}

export function buildTableScopedWebSocketUrl(baseUrl: string, path: string, tableId?: string): string | null {
  const scopedRouteUrl = buildTableScopedRouteUrl(baseUrl, path, tableId);
  return toWebSocketUrl(scopedRouteUrl);
}

function createStreamCommandTelemetryReporter(
  enabled: boolean,
): ((event: StreamCommandTelemetryEvent) => void) | undefined {
  if (!enabled) {
    return undefined;
  }

  return (event: StreamCommandTelemetryEvent): void => {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent(TABLE_WS_COMMAND_TELEMETRY_EVENT, { detail: event }));
    }

    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[poker][ws-command]', event);
    }
  };
}

export function createRuntimeTableController(options: RuntimeTableControllerOptions): TableController {
  const config = loadClientRuntimeConfig();
  const streamCommandTelemetryReporter = createStreamCommandTelemetryReporter(config.tableWsCommandTelemetryEnabled);
  if (config.tableRuntimeMode === 'server') {
    return new ServerTableController({
      userSeatId: options.userSeatId,
      snapshotUrl: buildTableScopedRouteUrl(config.apiBaseUrl, '/api/table/state', options.tableId),
      commandUrl: buildTableScopedRouteUrl(config.apiBaseUrl, '/api/table/command', options.tableId),
      seatClaimUrl: buildTableScopedRouteUrl(config.apiBaseUrl, '/api/table/seat', options.tableId),
      streamUrl: buildTableScopedWebSocketUrl(config.apiBaseUrl, '/api/table/ws', options.tableId) ?? undefined,
      pollIntervalMs: config.tablePollIntervalMs,
      streamCommandChannelEnabled: config.tableWsCommandChannelEnabled,
      streamCommandTelemetryReporter,
    });
  }

  return new LocalTableController({
    userSeatId: options.userSeatId,
  });
}
