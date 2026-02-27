import { loadClientRuntimeConfig } from './client-runtime-config.ts';
import { ServerTableController } from './server-table-controller.ts';
import { LocalTableController, type TableController } from './table-controller.ts';

interface RuntimeTableControllerOptions {
  userSeatId: number;
  tableId?: string;
}

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

export function createRuntimeTableController(options: RuntimeTableControllerOptions): TableController {
  const config = loadClientRuntimeConfig();
  if (config.tableRuntimeMode === 'server') {
    return new ServerTableController({
      userSeatId: options.userSeatId,
      snapshotUrl: buildTableScopedRouteUrl(config.apiBaseUrl, '/api/table/state', options.tableId),
      commandUrl: buildTableScopedRouteUrl(config.apiBaseUrl, '/api/table/command', options.tableId),
      seatClaimUrl: buildTableScopedRouteUrl(config.apiBaseUrl, '/api/table/seat', options.tableId),
      pollIntervalMs: config.tablePollIntervalMs,
    });
  }

  return new LocalTableController({
    userSeatId: options.userSeatId,
  });
}
