import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
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
import { TableService, createDefaultTableState } from './table-service.ts';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const MAX_LOG_LIMIT = 500;
const ALLOWED_USER_ROLES: readonly UserRole[] = ['PLAYER', 'OPERATOR', 'ADMIN'];

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

function authorizeTableCommandRequest(
  request: IncomingMessage,
  command: TableCommand,
  tableService: TableService,
  authWalletService: AuthWalletService,
): void {
  if (command.type !== 'PLAYER_ACTION') {
    return;
  }

  const seatClaim = tableService.getSeatClaimBySeatId(command.seatId);
  const token = getBearerToken(request);
  if (!token) {
    if (seatClaim) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required to act on a claimed seat.');
    }
    return;
  }

  const authContext = authWalletService.requireAuth(token);
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
    verifyFirebaseIdTokenFn: (
      idToken: string,
      options: FirebaseIdTokenVerificationOptions,
    ) => Promise<FirebaseExternalIdentity>;
  },
  allowLegacyWalletRoutes: boolean,
  persistRuntimeState: () => void,
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
      tableService.releaseSeatForUser(userId);
      authWalletService.logout(token);
      persistRuntimeState();
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

    if (method === 'GET' && pathname === '/api/table/state') {
      sendJson(response, 200, tableService.getSnapshot());
      return;
    }

    if (method === 'GET' && pathname === '/api/table/seat') {
      const { userId } = requireAuthenticatedContext(request, authWalletService);
      sendJson(response, 200, {
        claim: tableService.getSeatClaimForUser(userId),
      });
      return;
    }

    if (method === 'POST' && pathname === '/api/table/seat') {
      const { userId } = requireAuthenticatedContext(request, authWalletService);
      const body = await readJsonBody(request);
      const { seatId } = parseSeatClaimRequest(body);
      const claim = tableService.claimSeat(userId, seatId);
      persistRuntimeState();
      sendJson(response, 200, {
        claim,
      });
      return;
    }

    if (method === 'DELETE' && pathname === '/api/table/seat') {
      const { userId } = requireAuthenticatedContext(request, authWalletService);
      const released = tableService.releaseSeatForUser(userId);
      if (released) {
        persistRuntimeState();
      }
      sendJson(response, 200, {
        released,
      });
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
      authorizeTableCommandRequest(request, command, tableService, authWalletService);
      const result = tableService.applyCommand(command);
      persistRuntimeState();
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

const tableService = (() => {
  if (!persistedRuntimeState) {
    return new TableService({
      tableId,
      initialState: createDefaultTableState(),
    });
  }

  if (persistedRuntimeState.table.tableId !== tableId) {
    console.warn(
      `Ignoring persisted table state for ${persistedRuntimeState.table.tableId}; configured table id is ${tableId}.`,
    );
    return new TableService({
      tableId,
      initialState: createDefaultTableState(),
    });
  }

  return new TableService({
    tableId,
    restoredState: persistedRuntimeState.table,
  });
})();

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
    runtimeStateStore.save({
      version: 1,
      updatedAt: new Date().toISOString(),
      table: tableService.exportState(),
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
      verifyFirebaseIdTokenFn: firebaseIdTokenVerifier,
    },
    allowLegacyWalletRoutes,
    persistRuntimeState,
  );
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
