import { loadClientRuntimeConfig } from './client-runtime-config.ts';
import { ServerTableController } from './server-table-controller.ts';
import { LocalTableController, type TableController } from './table-controller.ts';

interface RuntimeTableControllerOptions {
  userSeatId: number;
}

function joinBaseUrlAndPath(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.trim();
  if (!normalizedBase) {
    return path;
  }
  return `${normalizedBase}${path}`;
}

export function createRuntimeTableController(options: RuntimeTableControllerOptions): TableController {
  const config = loadClientRuntimeConfig();
  if (config.tableRuntimeMode === 'server') {
    return new ServerTableController({
      userSeatId: options.userSeatId,
      snapshotUrl: joinBaseUrlAndPath(config.apiBaseUrl, '/api/table/state'),
      commandUrl: joinBaseUrlAndPath(config.apiBaseUrl, '/api/table/command'),
      seatClaimUrl: joinBaseUrlAndPath(config.apiBaseUrl, '/api/table/seat'),
      pollIntervalMs: config.tablePollIntervalMs,
    });
  }

  return new LocalTableController({
    userSeatId: options.userSeatId,
  });
}
