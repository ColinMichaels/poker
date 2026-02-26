import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { LoginRequestDTO, UpdateProfileRequestDTO, WalletAdjustmentRequestDTO } from '@poker/game-contracts';
import type { TableCommand } from '@poker/poker-engine';
import { AuthWalletService } from './auth-wallet-service.ts';
import { TableService, createDefaultTableState } from './table-service.ts';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const DEFAULT_TABLE_ID = 'table-1';
const MAX_LOG_LIMIT = 500;

class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  public constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

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
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
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
    throw new HttpError(400, 'BAD_REQUEST', `Invalid limit value: ${rawValue}`);
  }

  return Math.min(parsed, MAX_LOG_LIMIT);
}

function getHeaderValue(request: IncomingMessage, headerName: string): string | undefined {
  const value = request.headers[headerName];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getBearerToken(request: IncomingMessage): string | undefined {
  const authorization = getHeaderValue(request, 'authorization');
  if (!authorization) {
    return undefined;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : undefined;
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new HttpError(400, 'BAD_REQUEST', `${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function assertInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isInteger(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${label} must be an integer.`);
  }
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

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new HttpError(400, 'BAD_REQUEST', 'Request body must be valid JSON.');
  }
}

function assertCommand(command: unknown): asserts command is TableCommand {
  const record = requireObject(command, 'command');
  const type = record.type;

  if (typeof type !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', 'Command payload must include a string "type" field.');
  }

  switch (type) {
    case 'START_HAND':
      if (typeof record.handId !== 'string' || record.handId.trim().length === 0) {
        throw new HttpError(400, 'BAD_REQUEST', 'START_HAND requires a non-empty handId.');
      }
      if (record.seed !== undefined) {
        assertInteger(record.seed, 'START_HAND seed');
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
      assertInteger(record.seatId, 'PLAYER_ACTION seatId');
      if (typeof record.action !== 'string') {
        throw new HttpError(400, 'BAD_REQUEST', 'PLAYER_ACTION requires action.');
      }
      if (record.amount !== undefined) {
        assertInteger(record.amount, 'PLAYER_ACTION amount');
      }
      return;

    default:
      throw new HttpError(400, 'BAD_REQUEST', `Unknown command type: ${type}`);
  }
}

function extractCommand(body: unknown): TableCommand {
  const record = requireObject(body, 'body');
  const candidate = typeof record.command === 'object' && record.command !== null ? record.command : body;
  assertCommand(candidate);
  return candidate;
}

function parseLoginRequest(body: unknown): LoginRequestDTO {
  const record = requireObject(body, 'body');

  if (typeof record.email !== 'string' || record.email.trim().length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'email is required.');
  }

  if (record.password !== undefined && typeof record.password !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', 'password must be a string.');
  }

  return {
    email: record.email,
    password: record.password as string | undefined,
  };
}

function parseProfileUpdate(body: unknown): UpdateProfileRequestDTO {
  const record = requireObject(body, 'body');
  const result: UpdateProfileRequestDTO = {};

  if (record.firstName !== undefined) {
    if (typeof record.firstName !== 'string') {
      throw new HttpError(400, 'BAD_REQUEST', 'firstName must be a string.');
    }
    result.firstName = record.firstName;
  }

  if (record.lastName !== undefined) {
    if (typeof record.lastName !== 'string') {
      throw new HttpError(400, 'BAD_REQUEST', 'lastName must be a string.');
    }
    result.lastName = record.lastName;
  }

  if (result.firstName === undefined && result.lastName === undefined) {
    throw new HttpError(400, 'BAD_REQUEST', 'At least one profile field is required.');
  }

  return result;
}

function parseWalletAdjustment(body: unknown): WalletAdjustmentRequestDTO {
  const record = requireObject(body, 'body');

  if (record.method !== 'add' && record.method !== 'sub') {
    throw new HttpError(400, 'BAD_REQUEST', 'Wallet method must be add or sub.');
  }

  assertInteger(record.amount, 'Wallet amount');

  if (record.reason !== undefined && typeof record.reason !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', 'Wallet reason must be a string.');
  }

  return {
    method: record.method,
    amount: record.amount,
    reason: record.reason as string | undefined,
  };
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

function mapToHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message === 'Authentication required.' || message === 'Invalid session token.') {
    return new HttpError(401, 'UNAUTHORIZED', message);
  }

  if (message === 'Invalid credentials.') {
    return new HttpError(401, 'INVALID_CREDENTIALS', message);
  }

  if (message.includes('was not found')) {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  return new HttpError(400, 'REQUEST_REJECTED', message);
}

function requireAuthenticatedContext(request: IncomingMessage, authWalletService: AuthWalletService): {
  token: string;
  userId: number;
} {
  const token = getBearerToken(request);
  const context = authWalletService.requireAuth(token);

  return {
    token: context.token,
    userId: context.user.id,
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  tableService: TableService,
  authWalletService: AuthWalletService,
): Promise<void> {
  const method = request.method ?? 'GET';
  const host = getHeaderValue(request, 'host') ?? `${DEFAULT_HOST}:${DEFAULT_PORT}`;
  const requestUrl = new URL(request.url ?? '/', `http://${host}`);
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

    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await readJsonBody(request);
      const loginRequest = parseLoginRequest(body);
      sendJson(response, 200, authWalletService.login(loginRequest));
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/logout') {
      const { token } = requireAuthenticatedContext(request, authWalletService);
      authWalletService.logout(token);
      sendNoContent(response);
      return;
    }

    if (method === 'GET' && pathname === '/api/auth/session') {
      const { token } = requireAuthenticatedContext(request, authWalletService);
      sendJson(response, 200, {
        session: authWalletService.getSession(token),
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/users/me') {
      const { userId } = requireAuthenticatedContext(request, authWalletService);
      sendJson(response, 200, {
        user: authWalletService.getUserProfile(userId),
      });
      return;
    }

    if (method === 'PATCH' && pathname === '/api/users/me') {
      const { userId } = requireAuthenticatedContext(request, authWalletService);
      const body = await readJsonBody(request);
      const update = parseProfileUpdate(body);
      sendJson(response, 200, {
        user: authWalletService.updateUserProfile(userId, update),
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/wallet') {
      const { userId } = requireAuthenticatedContext(request, authWalletService);
      sendJson(response, 200, {
        wallet: authWalletService.getWallet(userId),
      });
      return;
    }

    if (method === 'PATCH' && pathname === '/api/wallet') {
      const { userId } = requireAuthenticatedContext(request, authWalletService);
      const body = await readJsonBody(request);
      sendJson(response, 200, authWalletService.adjustWallet(userId, parseWalletAdjustment(body)));
      return;
    }

    if (method === 'GET' && pathname === '/api/wallet/ledger') {
      const { userId } = requireAuthenticatedContext(request, authWalletService);
      const limit = parseLogLimit(requestUrl.searchParams.get('limit'), 50);
      sendJson(response, 200, {
        records: authWalletService.getWalletLedger(userId, limit),
      });
      return;
    }

    // Legacy compatibility route parity for old wallet calls.
    if (method === 'GET' && pathname === '/wallet') {
      const { userId } = requireAuthenticatedContext(request, authWalletService);
      sendJson(response, 200, authWalletService.getLegacyWalletAmount(userId));
      return;
    }

    if (method === 'PATCH' && /^\/wallet\/[^/]+$/.test(pathname)) {
      const { userId } = requireAuthenticatedContext(request, authWalletService);
      const body = await readJsonBody(request);
      const result = authWalletService.adjustWallet(userId, parseWalletAdjustment(body));
      sendJson(response, 200, result.wallet.balance);
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
    const httpError = mapToHttpError(error);
    sendJson(response, httpError.statusCode, {
      error: httpError.code,
      message: httpError.message,
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

const authWalletService = new AuthWalletService();

const server = createServer((request, response) => {
  void handleRequest(request, response, tableService, authWalletService);
});

server.listen(port, host, () => {
  const address = `http://${host}:${port}`;
  console.info(`Poker server listening at ${address}`);
  console.info('Endpoints: /health, /api/auth/*, /api/users/me, /api/wallet*, /api/table/*');
});
