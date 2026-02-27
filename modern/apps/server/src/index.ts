import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import type { LoginRequestDTO, UpdateProfileRequestDTO, UserRole, WalletAdjustmentRequestDTO } from '@poker/game-contracts';
import type { TableCommand } from '@poker/poker-engine';
import { AuthWalletService } from './auth-wallet-service.ts';
import { resolveAuditScopeUserId } from './auth-authorization.ts';
import { verifyExternalAuthAssertion } from './external-auth.ts';
import {
  type FirebaseExternalIdentity,
  type FirebaseIdTokenVerificationOptions,
} from './firebase-id-token.ts';
import { createFirebaseIdTokenVerifier } from './firebase-id-token-verifier.ts';
import { RuntimeStateStore, type RuntimeStateSnapshot } from './runtime-state-store.ts';
import { loadStartupConfig, type ExternalAuthMode, type FirebaseVerifierMode } from './startup-config.ts';
import {
  TableService,
  createDefaultTableState,
  type TableServiceStateSnapshot,
  type TableSnapshot,
} from './table-service.ts';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const MAX_LOG_LIMIT = 500;
const ALLOWED_USER_ROLES: readonly UserRole[] = ['PLAYER', 'OPERATOR', 'ADMIN'];
const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const TABLE_STREAM_COMMAND_IDEMPOTENCY_TTL_MS = 5 * 60_000;
const TABLE_STREAM_COMMAND_IDEMPOTENCY_MAX_PER_TABLE = 2_000;

class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  public constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function jsonHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
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

function resolveSingleHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function readWebSocketFramePayload(buffer: Buffer): { opcode: number; payload: Buffer } | null {
  if (buffer.length < 2) {
    return null;
  }

  const opcode = buffer[0] & 0x0f;
  const secondByte = buffer[1];
  const masked = (secondByte & 0x80) !== 0;
  let payloadLength = secondByte & 0x7f;
  let offset = 2;

  if (payloadLength === 126) {
    if (buffer.length < 4) {
      return null;
    }
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) {
      return null;
    }
    const payloadLengthBigInt = buffer.readBigUInt64BE(2);
    if (payloadLengthBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
      return null;
    }
    payloadLength = Number(payloadLengthBigInt);
    offset = 10;
  }

  let maskOffset = offset;
  if (masked) {
    if (buffer.length < maskOffset + 4) {
      return null;
    }
    offset += 4;
  }

  const end = offset + payloadLength;
  if (buffer.length < end) {
    return null;
  }

  const payload = Buffer.from(buffer.subarray(offset, end));
  if (!masked) {
    return {
      opcode,
      payload,
    };
  }

  const mask = buffer.subarray(maskOffset, maskOffset + 4);
  for (let index = 0; index < payload.length; index += 1) {
    payload[index] ^= mask[index % 4];
  }

  return {
    opcode,
    payload,
  };
}

function encodeWebSocketFrame(opcode: number, payload: Buffer): Buffer {
  if (payload.length < 126) {
    const frame = Buffer.alloc(2 + payload.length);
    frame[0] = 0x80 | (opcode & 0x0f);
    frame[1] = payload.length;
    payload.copy(frame, 2);
    return frame;
  }

  if (payload.length < 65_536) {
    const frame = Buffer.alloc(4 + payload.length);
    frame[0] = 0x80 | (opcode & 0x0f);
    frame[1] = 126;
    frame.writeUInt16BE(payload.length, 2);
    payload.copy(frame, 4);
    return frame;
  }

  const frame = Buffer.alloc(10 + payload.length);
  frame[0] = 0x80 | (opcode & 0x0f);
  frame[1] = 127;
  frame.writeBigUInt64BE(BigInt(payload.length), 2);
  payload.copy(frame, 10);
  return frame;
}

function encodeWebSocketTextFrame(payload: string): Buffer {
  return encodeWebSocketFrame(0x1, Buffer.from(payload, 'utf8'));
}

function encodeWebSocketControlFrame(opcode: number, payload?: Buffer): Buffer {
  return encodeWebSocketFrame(opcode, payload ?? Buffer.alloc(0));
}

function buildWebSocketAcceptValue(key: string): string {
  return createHash('sha1')
    .update(`${key}${WEBSOCKET_GUID}`)
    .digest('base64');
}

function writeUpgradeResponse(socket: Duplex, statusCode: number, statusText: string): void {
  socket.write(
    [
      `HTTP/1.1 ${statusCode} ${statusText}`,
      'Connection: close',
      '',
      '',
    ].join('\r\n'),
  );
  socket.destroy();
}

interface TableStreamSnapshotMessage {
  type: 'TABLE_SNAPSHOT';
  tableId: string;
  generatedAt: string;
  commandSequence: number;
  eventSequence: number;
  snapshot: TableSnapshot;
}

interface TableStreamHeartbeatMessage {
  type: 'TABLE_HEARTBEAT';
  sentAt: string;
}

interface TableStreamApplyCommandMessage {
  type: 'APPLY_COMMAND';
  commandId: string;
  command: TableCommand;
  authToken?: string;
}

interface TableStreamCommandAckMessage {
  type: 'COMMAND_ACK';
  commandId: string;
  acceptedAt: string;
  tableId: string;
  result: {
    command: {
      command: TableCommand;
    };
    events: Array<{
      event: unknown;
    }>;
    snapshot: TableSnapshot;
  };
}

interface TableStreamCommandErrorMessage {
  type: 'COMMAND_ERROR';
  commandId: string;
  code: string;
  message: string;
}

interface TableStreamHubOptions {
  heartbeatIntervalMs?: number;
}

export class TableStreamHub {
  private readonly socketsByTableId = new Map<string, Set<Duplex>>();
  private readonly tableIdBySocket = new Map<Duplex, string>();
  private readonly heartbeatTimer: ReturnType<typeof setInterval>;

  public constructor(options: TableStreamHubOptions = {}) {
    const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 2_500;
    this.heartbeatTimer = setInterval(() => {
      this.broadcastHeartbeat();
    }, heartbeatIntervalMs);
    this.heartbeatTimer.unref?.();
  }

  public addConnection(tableId: string, socket: Duplex, snapshot: TableSnapshot): void {
    const existingSockets = this.socketsByTableId.get(tableId) ?? new Set<Duplex>();
    existingSockets.add(socket);
    this.socketsByTableId.set(tableId, existingSockets);
    this.tableIdBySocket.set(socket, tableId);
    this.sendSnapshot(socket, snapshot);
  }

  public removeConnection(socket: Duplex): void {
    const tableId = this.tableIdBySocket.get(socket);
    if (!tableId) {
      return;
    }

    this.tableIdBySocket.delete(socket);
    const sockets = this.socketsByTableId.get(tableId);
    if (!sockets) {
      return;
    }

    sockets.delete(socket);
    if (sockets.size === 0) {
      this.socketsByTableId.delete(tableId);
    }
  }

  public publishSnapshot(snapshot: TableSnapshot): void {
    const sockets = this.socketsByTableId.get(snapshot.tableId);
    if (!sockets || sockets.size === 0) {
      return;
    }

    for (const socket of sockets) {
      this.sendSnapshot(socket, snapshot);
    }
  }

  public closeAll(): void {
    clearInterval(this.heartbeatTimer);
    for (const socket of this.tableIdBySocket.keys()) {
      try {
        socket.end(encodeWebSocketControlFrame(0x8));
      } catch {
        // Ignore close errors.
      }
      socket.destroy();
    }

    this.tableIdBySocket.clear();
    this.socketsByTableId.clear();
  }

  private broadcastHeartbeat(): void {
    if (this.tableIdBySocket.size === 0) {
      return;
    }

    const message: TableStreamHeartbeatMessage = {
      type: 'TABLE_HEARTBEAT',
      sentAt: new Date().toISOString(),
    };

    for (const socket of this.tableIdBySocket.keys()) {
      this.sendMessage(socket, message);
    }
  }

  private sendMessage(socket: Duplex, payload: unknown): void {
    if (socket.destroyed) {
      this.removeConnection(socket);
      return;
    }

    try {
      socket.write(encodeWebSocketTextFrame(JSON.stringify(payload)));
    } catch {
      this.removeConnection(socket);
      socket.destroy();
    }
  }

  private sendSnapshot(socket: Duplex, snapshot: TableSnapshot): void {
    const message: TableStreamSnapshotMessage = {
      type: 'TABLE_SNAPSHOT',
      tableId: snapshot.tableId,
      generatedAt: snapshot.generatedAt,
      commandSequence: snapshot.commandSequence,
      eventSequence: snapshot.eventSequence,
      snapshot,
    };
    this.sendMessage(socket, message);
  }
}

function sendWebSocketJson(socket: Duplex, payload: unknown): void {
  socket.write(encodeWebSocketTextFrame(JSON.stringify(payload)));
}

interface StoredTableStreamCommandResult {
  expiresAtMs: number;
  response: TableStreamCommandAckMessage | TableStreamCommandErrorMessage;
}

export class TableStreamCommandIdempotencyStore {
  private readonly ttlMs: number;
  private readonly maxEntriesPerTable: number;
  private readonly responsesByTableId = new Map<string, Map<string, StoredTableStreamCommandResult>>();

  public constructor(options: { ttlMs?: number; maxEntriesPerTable?: number } = {}) {
    this.ttlMs = options.ttlMs ?? TABLE_STREAM_COMMAND_IDEMPOTENCY_TTL_MS;
    this.maxEntriesPerTable = options.maxEntriesPerTable ?? TABLE_STREAM_COMMAND_IDEMPOTENCY_MAX_PER_TABLE;
  }

  public get(
    tableId: string,
    idempotencyKey: string,
  ): TableStreamCommandAckMessage | TableStreamCommandErrorMessage | null {
    const tableEntries = this.responsesByTableId.get(tableId);
    if (!tableEntries) {
      return null;
    }

    this.pruneExpiredEntries(tableEntries);
    const existing = tableEntries.get(idempotencyKey);
    return existing ? existing.response : null;
  }

  public set(
    tableId: string,
    idempotencyKey: string,
    response: TableStreamCommandAckMessage | TableStreamCommandErrorMessage,
  ): void {
    const tableEntries = this.responsesByTableId.get(tableId) ?? new Map<string, StoredTableStreamCommandResult>();
    this.pruneExpiredEntries(tableEntries);
    tableEntries.set(idempotencyKey, {
      expiresAtMs: Date.now() + this.ttlMs,
      response,
    });
    while (tableEntries.size > this.maxEntriesPerTable) {
      const firstKey = tableEntries.keys().next().value;
      if (typeof firstKey !== 'string') {
        break;
      }
      tableEntries.delete(firstKey);
    }
    this.responsesByTableId.set(tableId, tableEntries);
  }

  private pruneExpiredEntries(entries: Map<string, StoredTableStreamCommandResult>): void {
    const nowMs = Date.now();
    for (const [key, value] of entries.entries()) {
      if (value.expiresAtMs <= nowMs) {
        entries.delete(key);
      }
    }
  }
}

interface TableStreamCommandChannelOptions {
  enabled: boolean;
  tableService: TableService;
  authWalletService: AuthWalletService;
  persistRuntimeState: () => void;
  emitTableSnapshot: (tableService: TableService) => void;
  idempotencyStore: TableStreamCommandIdempotencyStore;
  tableId: string;
}

interface TableStreamUpgradeOptions {
  defaultTableId: string;
  resolveTableService: (tableId: string) => TableService;
  tableStreamHub: TableStreamHub;
  host: string;
  port: number;
  commandChannel?: {
    enabled: boolean;
    authWalletService: AuthWalletService;
    persistRuntimeState: () => void;
    emitTableSnapshot: (tableService: TableService) => void;
    idempotencyStore: TableStreamCommandIdempotencyStore;
  };
}

function parseOptionalAuthToken(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', 'APPLY_COMMAND authToken must be a string when provided.');
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseTableStreamApplyCommandMessage(payload: unknown): TableStreamApplyCommandMessage {
  const record = requireObject(payload, 'stream message');
  if (record.type !== 'APPLY_COMMAND') {
    throw new HttpError(400, 'BAD_REQUEST', 'Unsupported stream message type.');
  }

  if (typeof record.commandId !== 'string' || record.commandId.trim().length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'APPLY_COMMAND requires a non-empty commandId.');
  }

  const commandId = record.commandId.trim();
  if (commandId.length > 96) {
    throw new HttpError(400, 'BAD_REQUEST', 'APPLY_COMMAND commandId must not exceed 96 characters.');
  }

  if (!record.command || typeof record.command !== 'object' || Array.isArray(record.command)) {
    throw new HttpError(400, 'BAD_REQUEST', 'APPLY_COMMAND requires a command object.');
  }

  const command = record.command as unknown;
  assertCommand(command);

  return {
    type: 'APPLY_COMMAND',
    commandId,
    command,
    authToken: parseOptionalAuthToken(record.authToken),
  };
}

function resolveStreamCommandId(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return 'unknown';
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.commandId !== 'string') {
    return 'unknown';
  }
  const commandId = record.commandId.trim();
  return commandId.length > 0 ? commandId.slice(0, 96) : 'unknown';
}

function buildStreamIdempotencyKey(commandId: string, authToken: string | undefined): string {
  const authKey = authToken ? createHash('sha1').update(authToken).digest('hex') : 'anonymous';
  return `${authKey}:${commandId}`;
}

function sendStreamCommandError(
  socket: Duplex,
  commandId: string,
  code: string,
  message: string,
): TableStreamCommandErrorMessage | null {
  const payload: TableStreamCommandErrorMessage = {
    type: 'COMMAND_ERROR',
    commandId,
    code,
    message,
  };

  try {
    sendWebSocketJson(socket, payload);
    return payload;
  } catch {
    socket.destroy();
    return null;
  }
}

function sendStreamCommandAck(
  socket: Duplex,
  commandId: string,
  tableId: string,
  result: {
    command: {
      command: TableCommand;
    };
    events: Array<{
      event: unknown;
    }>;
    snapshot: TableSnapshot;
  },
): TableStreamCommandAckMessage | null {
  const payload: TableStreamCommandAckMessage = {
    type: 'COMMAND_ACK',
    commandId,
    tableId,
    acceptedAt: new Date().toISOString(),
    result,
  };
  try {
    sendWebSocketJson(socket, payload);
    return payload;
  } catch {
    socket.destroy();
    return null;
  }
}

function handleTableStreamApplyCommand(
  socket: Duplex,
  payload: unknown,
  commandChannel: TableStreamCommandChannelOptions,
): void {
  const fallbackCommandId = resolveStreamCommandId(payload);
  let commandId = fallbackCommandId;
  let idempotencyKey: string | null = null;

  try {
    const parsedMessage = parseTableStreamApplyCommandMessage(payload);
    commandId = parsedMessage.commandId;
    idempotencyKey = buildStreamIdempotencyKey(parsedMessage.commandId, parsedMessage.authToken);

    const cachedResponse = commandChannel.idempotencyStore.get(commandChannel.tableId, idempotencyKey);
    if (cachedResponse) {
      sendWebSocketJson(socket, cachedResponse);
      return;
    }

    if (!commandChannel.enabled) {
      const disabledResponse = sendStreamCommandError(
        socket,
        parsedMessage.commandId,
        'COMMAND_CHANNEL_DISABLED',
        'WebSocket command channel is disabled on this server.',
      );
      if (disabledResponse) {
        commandChannel.idempotencyStore.set(commandChannel.tableId, idempotencyKey, disabledResponse);
      }
      return;
    }

    authorizeTableCommand(
      parsedMessage.authToken,
      parsedMessage.command,
      commandChannel.tableService,
      commandChannel.authWalletService,
    );

    const result = commandChannel.tableService.applyCommand(parsedMessage.command) as {
      command: {
        command: TableCommand;
      };
      events: Array<{
        event: unknown;
      }>;
      snapshot: TableSnapshot;
    };
    commandChannel.persistRuntimeState();
    commandChannel.emitTableSnapshot(commandChannel.tableService);

    const ackResponse = sendStreamCommandAck(socket, parsedMessage.commandId, commandChannel.tableId, result);
    if (ackResponse) {
      commandChannel.idempotencyStore.set(commandChannel.tableId, idempotencyKey, ackResponse);
    }
  } catch (error) {
    const httpError = mapToHttpError(error);
    const errorResponse = sendStreamCommandError(socket, commandId, httpError.code, httpError.message);
    if (idempotencyKey && errorResponse) {
      commandChannel.idempotencyStore.set(commandChannel.tableId, idempotencyKey, errorResponse);
    }
  }
}

function handleTableStreamSocketData(
  socket: Duplex,
  chunk: Buffer,
  commandChannel: TableStreamCommandChannelOptions | undefined,
): void {
  const frame = readWebSocketFramePayload(chunk);
  if (!frame) {
    return;
  }

  if (frame.opcode === 0x8) {
    try {
      socket.end(encodeWebSocketControlFrame(0x8, frame.payload));
    } catch {
      socket.destroy();
    }
    return;
  }

  if (frame.opcode === 0x9) {
    try {
      socket.write(encodeWebSocketControlFrame(0xA, frame.payload));
    } catch {
      socket.destroy();
    }
    return;
  }

  if (frame.opcode !== 0x1 || !commandChannel) {
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(frame.payload.toString('utf8')) as unknown;
  } catch {
    sendStreamCommandError(socket, 'unknown', 'BAD_REQUEST', 'Stream message payload must be valid JSON.');
    return;
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    sendStreamCommandError(socket, 'unknown', 'BAD_REQUEST', 'Stream message payload must be an object.');
    return;
  }

  const record = payload as Record<string, unknown>;
  if (record.type === 'APPLY_COMMAND') {
    handleTableStreamApplyCommand(socket, payload, commandChannel);
  }
}

export function handleTableStreamUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  options: TableStreamUpgradeOptions,
): void {
  const method = request.method ?? 'GET';
  if (method !== 'GET') {
    writeUpgradeResponse(socket, 405, 'Method Not Allowed');
    return;
  }

  const upgradeHeader = resolveSingleHeaderValue(request.headers.upgrade)?.toLowerCase() ?? '';
  if (upgradeHeader !== 'websocket') {
    writeUpgradeResponse(socket, 400, 'Bad Request');
    return;
  }

  const connectionHeader = resolveSingleHeaderValue(request.headers.connection)?.toLowerCase() ?? '';
  if (!connectionHeader.split(',').some((token) => token.trim() === 'upgrade')) {
    writeUpgradeResponse(socket, 400, 'Bad Request');
    return;
  }

  const websocketVersion = resolveSingleHeaderValue(request.headers['sec-websocket-version']);
  if (websocketVersion !== '13') {
    writeUpgradeResponse(socket, 426, 'Upgrade Required');
    return;
  }

  const websocketKey = resolveSingleHeaderValue(request.headers['sec-websocket-key']);
  if (!websocketKey || websocketKey.trim().length === 0) {
    writeUpgradeResponse(socket, 400, 'Bad Request');
    return;
  }

  const hostHeader = resolveSingleHeaderValue(request.headers.host) ?? `${options.host}:${options.port}`;
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url ?? '/', `http://${hostHeader}`);
  } catch {
    writeUpgradeResponse(socket, 400, 'Bad Request');
    return;
  }

  if (requestUrl.pathname !== '/api/table/ws') {
    writeUpgradeResponse(socket, 404, 'Not Found');
    return;
  }

  let requestedTableId: string;
  try {
    requestedTableId = parseRequestedTableId(requestUrl.searchParams.get('tableId'), options.defaultTableId);
  } catch {
    writeUpgradeResponse(socket, 400, 'Bad Request');
    return;
  }

  const scopedTableService = options.resolveTableService(requestedTableId);
  const commandChannel: TableStreamCommandChannelOptions | undefined = options.commandChannel
    ? {
      enabled: options.commandChannel.enabled,
      tableService: scopedTableService,
      authWalletService: options.commandChannel.authWalletService,
      persistRuntimeState: options.commandChannel.persistRuntimeState,
      emitTableSnapshot: options.commandChannel.emitTableSnapshot,
      idempotencyStore: options.commandChannel.idempotencyStore,
      tableId: requestedTableId,
    }
    : undefined;
  const acceptValue = buildWebSocketAcceptValue(websocketKey.trim());
  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptValue}`,
      '',
      '',
    ].join('\r\n'),
  );

  socket.on('data', (chunk: Buffer | string) => {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
    handleTableStreamSocketData(socket, buffer, commandChannel);
  });
  socket.on('close', () => {
    options.tableStreamHub.removeConnection(socket);
  });
  socket.on('error', () => {
    options.tableStreamHub.removeConnection(socket);
  });

  options.tableStreamHub.addConnection(requestedTableId, socket, scopedTableService.getSnapshot());
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

function parseOptionalPositiveInteger(rawValue: string | null, label: string): number | undefined {
  if (!rawValue) {
    return undefined;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', `Invalid ${label} value: ${rawValue}`);
  }

  return parsed;
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

  if (typeof record.password !== 'string' || record.password.trim().length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'password is required.');
  }

  return {
    email: record.email,
    password: record.password,
  };
}

function parseExternalAuthLoginRequest(body: unknown): { assertion: string } {
  const record = requireObject(body, 'body');
  if (typeof record.assertion !== 'string' || record.assertion.trim().length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'assertion is required.');
  }

  return {
    assertion: record.assertion.trim(),
  };
}

function isValidUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && ALLOWED_USER_ROLES.includes(value as UserRole);
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function requireTrustedProxyAuth(request: IncomingMessage, expectedSecret: string): void {
  const providedSecret = getHeaderValue(request, 'x-external-auth-proxy-secret')?.trim() ?? '';
  if (!providedSecret || !constantTimeEqual(providedSecret, expectedSecret)) {
    throw new HttpError(401, 'INVALID_EXTERNAL_PROXY_AUTH', 'External auth trusted proxy authentication failed.');
  }
}

function parseTrustedHeaderExternalLogin(
  request: IncomingMessage,
  expectedIssuer: string,
): {
  provider: string;
  subject: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
} {
  const provider = getHeaderValue(request, 'x-external-auth-provider')?.trim() ?? '';
  const subject = getHeaderValue(request, 'x-external-auth-subject')?.trim() ?? '';
  const email = getHeaderValue(request, 'x-external-auth-email')?.trim() ?? '';
  const firstName = getHeaderValue(request, 'x-external-auth-first-name')?.trim() ?? '';
  const lastName = getHeaderValue(request, 'x-external-auth-last-name')?.trim() ?? '';
  const roleRaw = getHeaderValue(request, 'x-external-auth-role')?.trim();
  const issuerHeader = getHeaderValue(request, 'x-external-auth-issuer')?.trim();

  if (!provider) {
    throw new HttpError(400, 'BAD_REQUEST', 'x-external-auth-provider header is required.');
  }

  if (!subject) {
    throw new HttpError(400, 'BAD_REQUEST', 'x-external-auth-subject header is required.');
  }

  if (!email) {
    throw new HttpError(400, 'BAD_REQUEST', 'x-external-auth-email header is required.');
  }

  if (issuerHeader && issuerHeader !== expectedIssuer) {
    throw new HttpError(401, 'INVALID_EXTERNAL_ASSERTION', 'External auth trusted header issuer is invalid.');
  }

  if (roleRaw !== undefined && !isValidUserRole(roleRaw)) {
    throw new HttpError(400, 'BAD_REQUEST', `x-external-auth-role must be PLAYER, OPERATOR, or ADMIN when provided.`);
  }

  return {
    provider,
    subject,
    email,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    role: roleRaw as UserRole | undefined,
  };
}

function getFirebaseIdToken(request: IncomingMessage): string {
  const bearer = getBearerToken(request);
  if (bearer) {
    return bearer;
  }

  const headerToken = getHeaderValue(request, 'x-firebase-id-token')?.trim();
  if (headerToken) {
    return headerToken;
  }

  throw new HttpError(401, 'UNAUTHORIZED', 'Firebase ID token is required.');
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

function parseRequestedTableId(rawTableId: string | null, fallbackTableId: string): string {
  const candidate = rawTableId?.trim();
  if (!candidate) {
    return fallbackTableId;
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(candidate)) {
    throw new HttpError(400, 'BAD_REQUEST', 'Invalid tableId value.');
  }

  return candidate;
}

function parseSeatClaimRequest(body: unknown): { seatId: number } {
  const record = requireObject(body, 'body');
  assertInteger(record.seatId, 'seatId');
  if (record.seatId <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'seatId must be greater than zero.');
  }

  return {
    seatId: record.seatId,
  };
}

interface TableListRecord {
  tableId: string;
  name: string;
  stakesLabel: string;
  occupancyLabel: string;
  paceLabel: string;
  avgPot: number;
  minRaise: number;
  maxRaise: number;
  callAmount: number;
  phase: string;
  handId: string;
}

function formatTableName(tableId: string): string {
  const normalized = tableId.replace(/[_-]+/g, ' ').trim();
  if (!normalized) {
    return tableId;
  }

  return normalized
    .split(/\s+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function resolveTablePaceLabel(phase: string): string {
  if (phase.startsWith('BETTING_')) {
    return 'Aggressive';
  }
  if (phase.startsWith('DEAL_')) {
    return 'Fast';
  }
  return 'Standard';
}

function buildTableListRecord(tableService: TableService): TableListRecord {
  const snapshot = tableService.getSnapshot();
  const state = snapshot.state;
  const actionSeat = snapshot.actionState.seats.find((seat) => seat.seatId === 1) ?? snapshot.actionState.seats[0];
  const targetBetOption = actionSeat?.actions.find((option) => option.allowed && option.amountSemantics === 'TARGET_BET') ?? null;
  const minRaise = targetBetOption?.minAmount ?? state.config.bigBlind;
  const maxRaise = Math.max(minRaise, targetBetOption?.maxAmount ?? actionSeat?.stack ?? state.config.bigBlind * 20);
  const occupiedSeatCount = state.seats.filter((seat) => seat.stack > 0 || seat.totalCommitted > 0).length;

  return {
    tableId: snapshot.tableId,
    name: formatTableName(snapshot.tableId),
    stakesLabel: `${state.config.smallBlind} / ${state.config.bigBlind}`,
    occupancyLabel: `${occupiedSeatCount}/${state.seats.length} seated`,
    paceLabel: resolveTablePaceLabel(state.phase),
    avgPot: state.pot,
    minRaise,
    maxRaise,
    callAmount: actionSeat?.toCall ?? 0,
    phase: state.phase,
    handId: state.handId,
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
  if (message === 'Authentication required.' || message === 'Invalid session token.' || message === 'Session expired.') {
    return new HttpError(401, 'UNAUTHORIZED', message);
  }

  if (message === 'Invalid credentials.') {
    return new HttpError(401, 'INVALID_CREDENTIALS', message);
  }

  if (message.startsWith('External auth assertion')) {
    return new HttpError(401, 'INVALID_EXTERNAL_ASSERTION', message);
  }

  if (message.startsWith('Firebase ID token')) {
    return new HttpError(401, 'INVALID_FIREBASE_ID_TOKEN', message);
  }

  if (message.includes('already claimed by another user')) {
    return new HttpError(409, 'SEAT_CONFLICT', message);
  }

  if (message.includes('was not found')) {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  return new HttpError(400, 'REQUEST_REJECTED', message);
}

function requireAuthenticatedContext(request: IncomingMessage, authWalletService: AuthWalletService): {
  token: string;
  userId: number;
  role: UserRole;
} {
  const token = getBearerToken(request);
  const context = authWalletService.requireAuth(token);

  return {
    token: context.token,
    userId: context.user.id,
    role: context.user.role,
  };
}

function authorizeTableCommand(
  token: string | undefined,
  command: TableCommand,
  tableService: TableService,
  authWalletService: AuthWalletService,
): void {
  const authContext = token ? authWalletService.requireAuth(token) : null;

  if (command.type !== 'PLAYER_ACTION') {
    if (authContext && authContext.user.role === 'PLAYER') {
      throw new HttpError(
        403,
        'COMMAND_FORBIDDEN',
        'Non-player table commands are reserved for operator/admin or system automation.',
      );
    }
    return;
  }

  const seatClaim = tableService.getSeatClaimBySeatId(command.seatId);
  if (!authContext) {
    if (seatClaim) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required to act on a claimed seat.');
    }
    return;
  }

  if (authContext.user.role !== 'PLAYER') {
    return;
  }

  const userClaim = tableService.getSeatClaimForUser(authContext.user.id);
  if (!userClaim) {
    throw new HttpError(403, 'SEAT_UNCLAIMED', 'Claim a seat before submitting player actions.');
  }

  if (userClaim.seatId !== command.seatId) {
    throw new HttpError(
      403,
      'SEAT_FORBIDDEN',
      `Authenticated user controls seat ${userClaim.seatId}, not seat ${command.seatId}.`,
    );
  }
}

export async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  tableService: TableService,
  authWalletService: AuthWalletService,
  runtimeInfo: {
    persistenceEnabled: boolean;
    authAllowDemoUsers: boolean;
    allowLegacyWalletRoutes: boolean;
    externalAuthEnabled: boolean;
    externalAuthMode: ExternalAuthMode;
    externalAuthIssuer: string;
    externalAuthProxySharedSecret: string | undefined;
    externalAuthFirebaseProjectId: string | undefined;
    externalAuthFirebaseAudience: string | undefined;
    externalAuthFirebaseIssuer: string | undefined;
    externalAuthFirebaseCertsUrl: string;
    externalAuthFirebaseVerifier: FirebaseVerifierMode;
    externalAuthVerificationSecrets: readonly string[];
    tableWsCommandChannelEnabled?: boolean;
    verifyFirebaseIdTokenFn: (
      idToken: string,
      options: FirebaseIdTokenVerificationOptions,
    ) => Promise<FirebaseExternalIdentity>;
  },
  allowLegacyWalletRoutes: boolean,
  persistRuntimeState: () => void,
  tableRouting?: {
    defaultTableId?: string;
    resolveTableService?: (tableId: string) => TableService;
    releaseSeatClaimsForUser?: (userId: number) => void;
    listTableServices?: () => TableService[];
  },
  notifyTableSnapshot?: (tableService: TableService) => void,
): Promise<void> {
  const method = request.method ?? 'GET';
  const host = getHeaderValue(request, 'host') ?? `${DEFAULT_HOST}:${DEFAULT_PORT}`;
  const requestUrl = new URL(request.url ?? '/', `http://${host}`);
  const pathname = requestUrl.pathname;
  const initialTableId = tableService.getSnapshot().tableId;
  const defaultTableId = tableRouting?.defaultTableId ?? initialTableId;
  const resolveTableService = tableRouting?.resolveTableService ?? ((tableId: string) =>
    tableId === initialTableId
      ? tableService
      : tableService);
  const releaseSeatClaimsForUser = tableRouting?.releaseSeatClaimsForUser ?? ((userId: number) => {
    tableService.releaseSeatForUser(userId);
  });
  const listTableServices = tableRouting?.listTableServices ?? (() => [tableService]);
  const emitTableSnapshot = notifyTableSnapshot ?? (() => {});
  let resolvedTableService: TableService | null = null;
  function getScopedTableService(): TableService {
    if (resolvedTableService) {
      return resolvedTableService;
    }

    const requestedTableId = parseRequestedTableId(requestUrl.searchParams.get('tableId'), defaultTableId);
    resolvedTableService = resolveTableService(requestedTableId);
    return resolvedTableService;
  }

  if (method === 'OPTIONS') {
    sendNoContent(response);
    return;
  }

  try {
    if (method === 'GET' && pathname === '/health') {
      const snapshot = getScopedTableService().getSnapshot();
      sendJson(response, 200, {
        ok: true,
        tableId: snapshot.tableId,
        handId: snapshot.state.handId,
        phase: snapshot.state.phase,
        commandSequence: snapshot.commandSequence,
        eventSequence: snapshot.eventSequence,
        runtime: {
          persistenceEnabled: runtimeInfo.persistenceEnabled,
          authDemoUsersEnabled: runtimeInfo.authAllowDemoUsers,
          legacyWalletRoutesEnabled: runtimeInfo.allowLegacyWalletRoutes,
          externalAuthEnabled: runtimeInfo.externalAuthEnabled,
          externalAuthMode: runtimeInfo.externalAuthMode,
          externalAuthIssuer: runtimeInfo.externalAuthIssuer,
          externalAuthFirebaseProjectId: runtimeInfo.externalAuthFirebaseProjectId,
          externalAuthFirebaseIssuer: runtimeInfo.externalAuthFirebaseIssuer,
          externalAuthFirebaseVerifier: runtimeInfo.externalAuthFirebaseVerifier,
          externalAuthSecretRotationEnabled: runtimeInfo.externalAuthVerificationSecrets.length > 1,
          tableWsCommandChannelEnabled: runtimeInfo.tableWsCommandChannelEnabled ?? false,
        },
      });
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await readJsonBody(request);
      const loginRequest = parseLoginRequest(body);
      const loginResponse = authWalletService.login(loginRequest);
      persistRuntimeState();
      sendJson(response, 200, loginResponse);
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/external/login') {
      if (!runtimeInfo.externalAuthEnabled) {
        throw new HttpError(503, 'EXTERNAL_AUTH_DISABLED', 'External auth is not enabled.');
      }

      let loginResponse;
      if (runtimeInfo.externalAuthMode === 'signed_assertion') {
        if (runtimeInfo.externalAuthVerificationSecrets.length === 0) {
          throw new HttpError(500, 'SERVER_MISCONFIGURED', 'External auth shared secret is not configured.');
        }

        const body = await readJsonBody(request);
        const { assertion } = parseExternalAuthLoginRequest(body);
        const payload = verifyExternalAuthAssertion(assertion, {
          sharedSecrets: runtimeInfo.externalAuthVerificationSecrets,
          expectedIssuer: runtimeInfo.externalAuthIssuer,
        });
        loginResponse = authWalletService.loginWithExternalIdentity({
          provider: payload.iss,
          subject: payload.sub,
          email: payload.email,
          firstName: payload.firstName,
          lastName: payload.lastName,
          role: payload.role,
        });
      } else if (runtimeInfo.externalAuthMode === 'trusted_headers') {
        if (!runtimeInfo.externalAuthProxySharedSecret) {
          throw new HttpError(
            500,
            'SERVER_MISCONFIGURED',
            'External auth trusted proxy shared secret is not configured.',
          );
        }

        requireTrustedProxyAuth(request, runtimeInfo.externalAuthProxySharedSecret);
        const trustedIdentity = parseTrustedHeaderExternalLogin(request, runtimeInfo.externalAuthIssuer);
        loginResponse = authWalletService.loginWithExternalIdentity({
          provider: trustedIdentity.provider,
          subject: trustedIdentity.subject,
          email: trustedIdentity.email,
          firstName: trustedIdentity.firstName,
          lastName: trustedIdentity.lastName,
          role: trustedIdentity.role,
        });
      } else {
        if (!runtimeInfo.externalAuthFirebaseProjectId) {
          throw new HttpError(
            500,
            'SERVER_MISCONFIGURED',
            'External auth Firebase project id is not configured.',
          );
        }

        const idToken = getFirebaseIdToken(request);
        const firebaseIdentity = await runtimeInfo.verifyFirebaseIdTokenFn(idToken, {
          projectId: runtimeInfo.externalAuthFirebaseProjectId,
          audience: runtimeInfo.externalAuthFirebaseAudience,
          issuer: runtimeInfo.externalAuthFirebaseIssuer,
          certsUrl: runtimeInfo.externalAuthFirebaseCertsUrl,
        });
        loginResponse = authWalletService.loginWithExternalIdentity({
          provider: firebaseIdentity.provider,
          subject: firebaseIdentity.subject,
          email: firebaseIdentity.email,
          firstName: firebaseIdentity.firstName,
          lastName: firebaseIdentity.lastName,
          role: firebaseIdentity.role,
        });
      }

      persistRuntimeState();
      sendJson(response, 200, loginResponse);
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/logout') {
      const { token, userId } = requireAuthenticatedContext(request, authWalletService);
      releaseSeatClaimsForUser(userId);
      authWalletService.logout(token);
      persistRuntimeState();
      for (const scopedTableService of listTableServices()) {
        emitTableSnapshot(scopedTableService);
      }
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

    if (method === 'GET' && pathname === '/api/auth/audit') {
      const { userId, role } = requireAuthenticatedContext(request, authWalletService);
      const limit = parseLogLimit(requestUrl.searchParams.get('limit'), 100);
      const requestedUserId = parseOptionalPositiveInteger(requestUrl.searchParams.get('userId'), 'userId');
      let auditFilterUserId: number | undefined;
      try {
        auditFilterUserId = resolveAuditScopeUserId(userId, role, requestedUserId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new HttpError(403, 'FORBIDDEN', message);
      }
      sendJson(response, 200, {
        records: authWalletService.getAuthAuditLog(limit, auditFilterUserId),
      });
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/revoke-others') {
      const { token, userId } = requireAuthenticatedContext(request, authWalletService);
      const revoked = authWalletService.revokeOtherSessions(userId, token);
      persistRuntimeState();
      sendJson(response, 200, { revoked });
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
      const user = authWalletService.updateUserProfile(userId, update);
      persistRuntimeState();
      sendJson(response, 200, {
        user,
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
      const result = authWalletService.adjustWallet(userId, parseWalletAdjustment(body));
      persistRuntimeState();
      sendJson(response, 200, result);
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
    if (allowLegacyWalletRoutes && method === 'GET' && pathname === '/wallet') {
      const { userId } = requireAuthenticatedContext(request, authWalletService);
      sendJson(response, 200, authWalletService.getLegacyWalletAmount(userId));
      return;
    }

    if (allowLegacyWalletRoutes && method === 'PATCH' && /^\/wallet\/[^/]+$/.test(pathname)) {
      const { userId } = requireAuthenticatedContext(request, authWalletService);
      const body = await readJsonBody(request);
      const result = authWalletService.adjustWallet(userId, parseWalletAdjustment(body));
      persistRuntimeState();
      sendJson(response, 200, result.wallet.balance);
      return;
    }

    if (method === 'GET' && pathname === '/api/table/list') {
      sendJson(response, 200, {
        records: listTableServices()
          .map((scopedTableService) => buildTableListRecord(scopedTableService))
          .sort((left, right) => left.tableId.localeCompare(right.tableId)),
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/table/state') {
      sendJson(response, 200, getScopedTableService().getSnapshot());
      return;
    }

    if (method === 'GET' && pathname === '/api/table/seat') {
      const { userId } = requireAuthenticatedContext(request, authWalletService);
      sendJson(response, 200, {
        claim: getScopedTableService().getSeatClaimForUser(userId),
      });
      return;
    }

    if (method === 'POST' && pathname === '/api/table/seat') {
      const { userId } = requireAuthenticatedContext(request, authWalletService);
      const body = await readJsonBody(request);
      const { seatId } = parseSeatClaimRequest(body);
      const scopedTableService = getScopedTableService();
      const claim = scopedTableService.claimSeat(userId, seatId);
      persistRuntimeState();
      emitTableSnapshot(scopedTableService);
      sendJson(response, 200, {
        claim,
      });
      return;
    }

    if (method === 'DELETE' && pathname === '/api/table/seat') {
      const { userId } = requireAuthenticatedContext(request, authWalletService);
      const scopedTableService = getScopedTableService();
      const released = scopedTableService.releaseSeatForUser(userId);
      if (released) {
        persistRuntimeState();
        emitTableSnapshot(scopedTableService);
      }
      sendJson(response, 200, {
        released,
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/table/logs/commands') {
      const limit = parseLogLimit(requestUrl.searchParams.get('limit'), 100);
      sendJson(response, 200, {
        records: getScopedTableService().getCommandLog(limit),
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/table/logs/events') {
      const limit = parseLogLimit(requestUrl.searchParams.get('limit'), 200);
      sendJson(response, 200, {
        records: getScopedTableService().getEventLog(limit),
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/table/hands') {
      sendJson(response, 200, {
        records: getScopedTableService().listHandSummaries(),
      });
      return;
    }

    if (method === 'GET') {
      const handId = getHandIdFromPath(pathname, '');
      if (handId) {
        sendJson(response, 200, getScopedTableService().getHandHistory(handId));
        return;
      }

      const replayHandId = getHandIdFromPath(pathname, '/replay');
      if (replayHandId) {
        sendJson(response, 200, {
          history: getScopedTableService().getHandHistory(replayHandId),
          replay: getScopedTableService().replayHand(replayHandId),
        });
        return;
      }
    }

    if (method === 'POST' && pathname === '/api/table/command') {
      const body = await readJsonBody(request);
      const command = extractCommand(body);
      const scopedTableService = getScopedTableService();
      authorizeTableCommand(getBearerToken(request), command, scopedTableService, authWalletService);
      const result = scopedTableService.applyCommand(command);
      persistRuntimeState();
      emitTableSnapshot(scopedTableService);
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

const {
  isProduction,
  port,
  host,
  tableId,
  persistenceEnabled,
  stateFilePath,
  authTokenSecret,
  authSessionTtlMs,
  authAllowDemoUsers,
  authBootstrapUsersFile,
  authBootstrapUsers,
  allowLegacyWalletRoutes,
  tableWsCommandChannelEnabled,
  externalAuthEnabled,
  externalAuthMode,
  externalAuthIssuer,
  externalAuthSharedSecret,
  externalAuthSharedSecretPrevious,
  externalAuthProxySharedSecret,
  externalAuthFirebaseProjectId,
  externalAuthFirebaseAudience,
  externalAuthFirebaseIssuer,
  externalAuthFirebaseCertsUrl,
  externalAuthFirebaseVerifier,
  externalAuthFirebaseServiceAccountFile,
  externalAuthVerificationSecrets,
} = loadStartupConfig(process.env);

const firebaseIdTokenVerifier = createFirebaseIdTokenVerifier({
  verifierMode: externalAuthFirebaseVerifier,
  firebaseAdminServiceAccountFile: externalAuthFirebaseServiceAccountFile,
});
const runtimeStateStore = persistenceEnabled ? new RuntimeStateStore(stateFilePath) : null;

let persistedRuntimeState: RuntimeStateSnapshot | null = null;
if (runtimeStateStore) {
  try {
    persistedRuntimeState = runtimeStateStore.load();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Unable to load persisted runtime state: ${message}`);
  }
}

const restoredTableStates: TableServiceStateSnapshot[] = (() => {
  if (!persistedRuntimeState) {
    return [];
  }

  if (Array.isArray(persistedRuntimeState.tables) && persistedRuntimeState.tables.length > 0) {
    return persistedRuntimeState.tables;
  }

  return persistedRuntimeState.table ? [persistedRuntimeState.table] : [];
})();

function createFreshTableService(nextTableId: string): TableService {
  return new TableService({
    tableId: nextTableId,
    initialState: createDefaultTableState({
      handId: `${nextTableId}-bootstrap`,
    }),
  });
}

const tableServiceById = new Map<string, TableService>();
for (const restoredTableState of restoredTableStates) {
  if (tableServiceById.has(restoredTableState.tableId)) {
    console.warn(`Duplicate restored table snapshot detected for ${restoredTableState.tableId}; keeping first entry.`);
    continue;
  }

  tableServiceById.set(
    restoredTableState.tableId,
    new TableService({
      tableId: restoredTableState.tableId,
      restoredState: restoredTableState,
    }),
  );
}

if (!tableServiceById.has(tableId)) {
  if (restoredTableStates.length > 0) {
    console.warn(`No persisted snapshot found for configured table id ${tableId}; creating fresh table state.`);
  }
  tableServiceById.set(tableId, createFreshTableService(tableId));
}

const tableService = tableServiceById.get(tableId) as TableService;

function resolveTableService(requestedTableId: string): TableService {
  const existing = tableServiceById.get(requestedTableId);
  if (existing) {
    return existing;
  }

  const created = createFreshTableService(requestedTableId);
  tableServiceById.set(requestedTableId, created);
  return created;
}

function releaseSeatClaimsForUser(userId: number): void {
  for (const scopedTableService of tableServiceById.values()) {
    scopedTableService.releaseSeatForUser(userId);
  }
}

function listTableServices(): TableService[] {
  return Array.from(tableServiceById.values());
}

function exportAllTableStates(): TableServiceStateSnapshot[] {
  return Array.from(tableServiceById.entries())
    .sort(([leftTableId], [rightTableId]) => leftTableId.localeCompare(rightTableId))
    .map(([, scopedTableService]) => scopedTableService.exportState());
}

const tableStreamHub = new TableStreamHub();
const tableStreamCommandIdempotencyStore = new TableStreamCommandIdempotencyStore();

function emitTableSnapshot(scopedTableService: TableService): void {
  tableStreamHub.publishSnapshot(scopedTableService.getSnapshot());
}

const authWalletService = persistedRuntimeState
  ? new AuthWalletService({
    users: persistedRuntimeState.auth.users,
    sessions: persistedRuntimeState.auth.sessions,
    auditLog: persistedRuntimeState.auth.auditLog,
    allowDefaultUsers: authAllowDemoUsers,
    tokenSecret: authTokenSecret,
    sessionTtlMs: authSessionTtlMs,
  })
  : new AuthWalletService({
    users: authBootstrapUsers,
    allowDefaultUsers: authAllowDemoUsers,
    tokenSecret: authTokenSecret,
    sessionTtlMs: authSessionTtlMs,
  });

function persistRuntimeState(): void {
  if (!runtimeStateStore) {
    return;
  }

  try {
    const tableStates = exportAllTableStates();
    const defaultTableState = tableStates.find((snapshot) => snapshot.tableId === tableId) ?? tableStates[0];
    if (!defaultTableState) {
      throw new Error('No table state is available to persist.');
    }
    runtimeStateStore.save({
      version: 1,
      updatedAt: new Date().toISOString(),
      table: defaultTableState,
      tables: tableStates,
      auth: authWalletService.exportState(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Unable to persist runtime state: ${message}`);
  }
}

const server = createServer((request, response) => {
  void handleRequest(
    request,
    response,
    tableService,
    authWalletService,
    {
      persistenceEnabled,
      authAllowDemoUsers,
      allowLegacyWalletRoutes,
      externalAuthEnabled,
      externalAuthMode,
      externalAuthIssuer,
      externalAuthProxySharedSecret,
      externalAuthFirebaseProjectId,
      externalAuthFirebaseAudience,
      externalAuthFirebaseIssuer,
      externalAuthFirebaseCertsUrl,
      externalAuthFirebaseVerifier,
      externalAuthVerificationSecrets,
      tableWsCommandChannelEnabled,
      verifyFirebaseIdTokenFn: firebaseIdTokenVerifier,
    },
    allowLegacyWalletRoutes,
    persistRuntimeState,
    {
      defaultTableId: tableId,
      resolveTableService,
      releaseSeatClaimsForUser,
      listTableServices,
    },
    emitTableSnapshot,
  );
});

server.on('upgrade', (request, socket) => {
  handleTableStreamUpgrade(request, socket, {
    defaultTableId: tableId,
    resolveTableService,
    tableStreamHub,
    host,
    port,
    commandChannel: {
      enabled: tableWsCommandChannelEnabled,
      authWalletService,
      persistRuntimeState,
      emitTableSnapshot,
      idempotencyStore: tableStreamCommandIdempotencyStore,
    },
  });
});

if (process.env.POKER_SERVER_NO_LISTEN !== '1') {
  let shuttingDown = false;
  function beginShutdown(signal: 'SIGINT' | 'SIGTERM'): void {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.info(`Received ${signal}; persisting runtime state and shutting down.`);
    persistRuntimeState();
    tableStreamHub.closeAll();

    const forceExitTimer = setTimeout(() => {
      console.error('Shutdown timeout reached; forcing process exit.');
      process.exit(1);
    }, 10_000);

    server.close((error) => {
      clearTimeout(forceExitTimer);
      if (error) {
        console.error(`Server shutdown encountered an error: ${error.message}`);
        process.exit(1);
        return;
      }

      console.info('Server shutdown complete.');
      process.exit(0);
    });
  }

  process.once('SIGINT', () => beginShutdown('SIGINT'));
  process.once('SIGTERM', () => beginShutdown('SIGTERM'));

  server.listen(port, host, () => {
    const address = `http://${host}:${port}`;
    console.info(`Poker server listening at ${address}`);
    console.info('Endpoints: /health, /api/auth/*, /api/users/me, /api/wallet*, /api/table/*');
    console.info(`Table routing: default=${tableId} activeTables=${tableServiceById.size}`);
    if (runtimeStateStore) {
      console.info(`Runtime persistence: enabled (${runtimeStateStore.getFilePath()})`);
    } else {
      console.info('Runtime persistence: disabled');
    }
    if (!authTokenSecret) {
      console.warn('Auth token secret: using development default. Set POKER_AUTH_TOKEN_SECRET for non-dev environments.');
    }
    console.info(`Auth demo users: ${authAllowDemoUsers ? 'enabled' : 'disabled'}`);
    console.info(`Legacy wallet routes: ${allowLegacyWalletRoutes ? 'enabled' : 'disabled'}`);
    console.info(`Table WS command channel: ${tableWsCommandChannelEnabled ? 'enabled' : 'disabled'}`);
    console.info(
      `External auth: ${externalAuthEnabled ? `enabled (${externalAuthMode}, issuer: ${externalAuthIssuer})` : 'disabled'}`,
    );
    if (externalAuthEnabled && externalAuthMode === 'signed_assertion' && externalAuthVerificationSecrets.length > 1) {
      console.info('External auth secret rotation: previous verification secret is active.');
    }
    if (externalAuthEnabled && externalAuthMode === 'trusted_headers' && externalAuthProxySharedSecret) {
      console.info('External auth trusted proxy mode: proxy shared secret is configured.');
    }
    if (externalAuthEnabled && externalAuthMode === 'firebase_id_token') {
      console.info(
        `External auth Firebase mode: verifier=${externalAuthFirebaseVerifier} project=${externalAuthFirebaseProjectId ?? 'unset'} issuer=${externalAuthFirebaseIssuer ?? 'unset'}`,
      );
    }
    if (isProduction && authAllowDemoUsers) {
      console.warn('Production mode warning: demo users are enabled.');
    }
    if (isProduction && allowLegacyWalletRoutes) {
      console.warn('Production mode warning: legacy wallet compatibility routes are enabled.');
    }
    if (authBootstrapUsersFile) {
      if (persistedRuntimeState) {
        console.info('Auth bootstrap users: file configured but ignored because persisted auth state was restored.');
      } else {
        console.info(`Auth bootstrap users: loaded from ${authBootstrapUsersFile}`);
      }
    }
    if (externalAuthSharedSecretPrevious && !externalAuthEnabled) {
      console.info('External auth previous secret is configured but external auth is currently disabled.');
    }
  });
}
