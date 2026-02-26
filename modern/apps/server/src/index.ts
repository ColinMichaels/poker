import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { TableCommand } from '@poker/poker-engine';
import { TableService, createDefaultTableState } from './table-service.ts';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const DEFAULT_TABLE_ID = 'table-1';
const MAX_LOG_LIMIT = 500;

function parsePort(rawValue: string | undefined): number {
  if (!rawValue) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid PORT value: ${rawValue}`);
  }

  return parsed;
}

function jsonHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, jsonHeaders());
  response.end(JSON.stringify(payload));
}

function sendNoContent(response: ServerResponse): void {
  response.writeHead(204, jsonHeaders());
  response.end();
}

function sendRouteNotFound(response: ServerResponse, method: string, pathname: string): void {
  sendJson(response, 404, {
    error: 'NOT_FOUND',
    message: `No route for ${method} ${pathname}`,
  });
}

function parseLogLimit(rawValue: string | null, fallback: number): number {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid limit value: ${rawValue}`);
  }

  return Math.min(parsed, MAX_LOG_LIMIT);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const decoder = new TextDecoder();
  let bodyText = '';

  for await (const chunk of request) {
    if (typeof chunk === 'string') {
      bodyText += chunk;
    } else {
      bodyText += decoder.decode(chunk, { stream: true });
    }
  }

  bodyText += decoder.decode();
  const trimmed = bodyText.trim();
  if (!trimmed) {
    return {};
  }

  return JSON.parse(trimmed) as unknown;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertInteger(value: unknown, label: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }
}

function assertCommand(command: unknown): asserts command is TableCommand {
  if (!isObjectRecord(command) || typeof command.type !== 'string') {
    throw new Error('Command payload must include a string "type" field.');
  }

  switch (command.type) {
    case 'START_HAND':
      if (typeof command.handId !== 'string' || command.handId.trim().length === 0) {
        throw new Error('START_HAND requires a non-empty handId.');
      }
      if (command.seed !== undefined) {
        assertInteger(command.seed, 'START_HAND seed');
      }
      return;

    case 'POST_BLINDS':
    case 'DEAL_HOLE':
    case 'DEAL_FLOP':
    case 'DEAL_TURN':
    case 'DEAL_RIVER':
    case 'RESOLVE_SHOWDOWN':
      return;

    case 'PLAYER_ACTION':
      assertInteger(command.seatId, 'PLAYER_ACTION seatId');
      if (typeof command.action !== 'string') {
        throw new Error('PLAYER_ACTION requires action.');
      }
      if (command.amount !== undefined) {
        assertInteger(command.amount, 'PLAYER_ACTION amount');
      }
      return;

    default:
      throw new Error(`Unknown command type: ${command.type}`);
  }
}

function extractCommand(body: unknown): TableCommand {
  const candidate = isObjectRecord(body) && isObjectRecord(body.command) ? body.command : body;
  assertCommand(candidate);
  return candidate;
}

function getHandIdFromPath(pathname: string, suffix: '' | '/replay'): string | null {
  const pattern = suffix === ''
    ? /^\/api\/table\/hands\/([^/]+)$/
    : /^\/api\/table\/hands\/([^/]+)\/replay$/;

  const match = pathname.match(pattern);
  if (!match) {
    return null;
  }

  return decodeURIComponent(match[1]);
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  tableService: TableService,
): Promise<void> {
  const method = request.method ?? 'GET';
  const hostHeader = request.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const requestUrl = new URL(request.url ?? '/', `http://${host ?? `${DEFAULT_HOST}:${DEFAULT_PORT}`}`);
  const pathname = requestUrl.pathname;

  if (method === 'OPTIONS') {
    sendNoContent(response);
    return;
  }

  try {
    if (method === 'GET' && pathname === '/health') {
      const snapshot = tableService.getSnapshot();
      sendJson(response, 200, {
        ok: true,
        tableId: snapshot.tableId,
        handId: snapshot.state.handId,
        phase: snapshot.state.phase,
        commandSequence: snapshot.commandSequence,
        eventSequence: snapshot.eventSequence,
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/table/state') {
      sendJson(response, 200, tableService.getSnapshot());
      return;
    }

    if (method === 'GET' && pathname === '/api/table/logs/commands') {
      const limit = parseLogLimit(requestUrl.searchParams.get('limit'), 100);
      sendJson(response, 200, {
        records: tableService.getCommandLog(limit),
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/table/logs/events') {
      const limit = parseLogLimit(requestUrl.searchParams.get('limit'), 200);
      sendJson(response, 200, {
        records: tableService.getEventLog(limit),
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/table/hands') {
      sendJson(response, 200, {
        records: tableService.listHandSummaries(),
      });
      return;
    }

    if (method === 'GET') {
      const handId = getHandIdFromPath(pathname, '');
      if (handId) {
        sendJson(response, 200, tableService.getHandHistory(handId));
        return;
      }

      const replayHandId = getHandIdFromPath(pathname, '/replay');
      if (replayHandId) {
        sendJson(response, 200, {
          history: tableService.getHandHistory(replayHandId),
          replay: tableService.replayHand(replayHandId),
        });
        return;
      }
    }

    if (method === 'POST' && pathname === '/api/table/command') {
      const body = await readJsonBody(request);
      const command = extractCommand(body);
      const result = tableService.applyCommand(command);
      sendJson(response, 200, result);
      return;
    }

    sendRouteNotFound(response, method, pathname);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(response, 400, {
      error: 'REQUEST_REJECTED',
      message,
    });
  }
}

const port = parsePort(process.env.PORT);
const host = process.env.HOST ?? DEFAULT_HOST;
const tableId = process.env.TABLE_ID ?? DEFAULT_TABLE_ID;

const tableService = new TableService({
  tableId,
  initialState: createDefaultTableState(),
});

const server = createServer((request, response) => {
  void handleRequest(request, response, tableService);
});

server.listen(port, host, () => {
  const address = `http://${host}:${port}`;
  console.info(`Poker server listening at ${address}`);
  console.info('Endpoints: /health, /api/table/state, /api/table/command, /api/table/hands');
});
