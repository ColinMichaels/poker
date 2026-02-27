import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { AuthWalletService } from './auth-wallet-service.ts';
import { createExternalAuthAssertion } from './external-auth.ts';
import type { FirebaseExternalIdentity, FirebaseIdTokenVerificationOptions } from './firebase-id-token.ts';
import { TableStreamCommandIdempotencyStore, TableStreamHub, handleRequest, handleTableStreamUpgrade } from './index.ts';
import type { ExternalAuthMode, FirebaseVerifierMode } from './startup-config.ts';
import { TableService, createDefaultTableState } from './table-service.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message} (actual=${String(actual)} expected=${String(expected)})`);
  }
}

type SocketListener = (...args: unknown[]) => void;

class MockUpgradeSocket {
  public writes: Array<string | Buffer> = [];
  public destroyed = false;
  private readonly listeners = new Map<string, SocketListener[]>();

  public write(chunk: string | Buffer): boolean {
    this.writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk));
    return true;
  }

  public end(chunk?: string | Buffer): void {
    if (chunk !== undefined) {
      this.write(chunk);
    }
    this.destroy();
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.emit('close');
  }

  public on(event: string, listener: SocketListener): this {
    const existing = this.listeners.get(event) ?? [];
    existing.push(listener);
    this.listeners.set(event, existing);
    return this;
  }

  public emit(event: string, ...args: unknown[]): void {
    const listeners = this.listeners.get(event) ?? [];
    for (const listener of listeners) {
      listener(...args);
    }
  }
}

function createUpgradeRequest(options: {
  method?: string;
  url: string;
  headers?: Record<string, string>;
}): IncomingMessage {
  return {
    method: options.method ?? 'GET',
    url: options.url,
    headers: options.headers ?? {},
  } as IncomingMessage;
}

function createUpgradeHeaders(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    host: '127.0.0.1:8787',
    connection: 'Upgrade',
    upgrade: 'websocket',
    'sec-websocket-version': '13',
    'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
    ...overrides,
  };
}

function decodeServerTextFrame(frame: Buffer): string {
  assert(frame.length >= 2, 'Expected WebSocket frame to include header bytes.');
  const opcode = frame[0] & 0x0f;
  assertEqual(opcode, 0x1, 'Expected server frame opcode to be text.');
  const masked = (frame[1] & 0x80) !== 0;
  assertEqual(masked, false, 'Expected server WebSocket frame payload to be unmasked.');

  let payloadLength = frame[1] & 0x7f;
  let offset = 2;
  if (payloadLength === 126) {
    assert(frame.length >= 4, 'Expected frame to include extended 16-bit payload length.');
    payloadLength = frame.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    assert(frame.length >= 10, 'Expected frame to include extended 64-bit payload length.');
    payloadLength = Number(frame.readBigUInt64BE(2));
    offset = 10;
  }

  const end = offset + payloadLength;
  assert(frame.length >= end, 'Expected frame payload bytes to be present.');
  return frame.subarray(offset, end).toString('utf8');
}

function extractSocketJsonMessages(socket: MockUpgradeSocket): unknown[] {
  const messages: unknown[] = [];
  for (const chunk of socket.writes) {
    if (!Buffer.isBuffer(chunk)) {
      continue;
    }

    messages.push(JSON.parse(decodeServerTextFrame(chunk)) as unknown);
  }
  return messages;
}

function encodeClientTextFrame(payload: string): Buffer {
  const payloadBuffer = Buffer.from(payload, 'utf8');
  const mask = Buffer.from([0x11, 0x22, 0x33, 0x44]);
  let headerLength = 2 + 4;
  let payloadLengthField = payloadBuffer.length;
  if (payloadBuffer.length >= 126 && payloadBuffer.length < 65_536) {
    headerLength += 2;
    payloadLengthField = 126;
  } else if (payloadBuffer.length >= 65_536) {
    headerLength += 8;
    payloadLengthField = 127;
  }

  const frame = Buffer.alloc(headerLength + payloadBuffer.length);
  frame[0] = 0x81;
  frame[1] = 0x80 | payloadLengthField;
  let offset = 2;
  if (payloadLengthField === 126) {
    frame.writeUInt16BE(payloadBuffer.length, offset);
    offset += 2;
  } else if (payloadLengthField === 127) {
    frame.writeBigUInt64BE(BigInt(payloadBuffer.length), offset);
    offset += 8;
  }

  mask.copy(frame, offset);
  offset += 4;
  for (let index = 0; index < payloadBuffer.length; index += 1) {
    frame[offset + index] = payloadBuffer[index] ^ mask[index % 4];
  }

  return frame;
}

class MockIncomingMessage {
  public readonly method?: string;
  public readonly url?: string;
  public readonly headers: Record<string, string | string[] | undefined>;
  private readonly bodyText: string;

  public constructor(options: {
    method: string;
    url: string;
    headers?: Record<string, string | string[] | undefined>;
    body?: unknown;
  }) {
    this.method = options.method;
    this.url = options.url;
    this.headers = options.headers ?? {};
    this.bodyText = options.body === undefined ? '' : JSON.stringify(options.body);
  }

  public [Symbol.asyncIterator](): AsyncIterator<Uint8Array | string> {
    let yielded = false;
    const payload = this.bodyText;
    return {
      next: async () => {
        if (yielded || payload.length === 0) {
          return {
            value: undefined,
            done: true,
          };
        }
        yielded = true;
        return {
          value: payload,
          done: false,
        };
      },
    };
  }
}

class MockServerResponse {
  public statusCode = 200;
  public headers: Record<string, string> = {};
  public body = '';

  public writeHead(statusCode: number, headers?: Record<string, string>): void {
    this.statusCode = statusCode;
    this.headers = headers ?? {};
  }

  public end(chunk?: string): void {
    this.body = chunk ?? '';
  }

  public json(): unknown {
    if (!this.body) {
      return null;
    }
    return JSON.parse(this.body) as unknown;
  }
}

function createServices(): {
  tableService: TableService;
  authWalletService: AuthWalletService;
} {
  return {
    tableService: new TableService({
      tableId: 'http-test-table',
      initialState: createDefaultTableState({
        handId: 'boot-http-test',
        seed: 777,
      }),
    }),
    authWalletService: new AuthWalletService(),
  };
}

type RouteRuntimeInfo = {
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
};

function createRuntimeInfo(overrides: Partial<RouteRuntimeInfo> = {}): RouteRuntimeInfo {
  return {
    persistenceEnabled: false,
    authAllowDemoUsers: true,
    allowLegacyWalletRoutes: false,
    externalAuthEnabled: false,
    externalAuthMode: 'signed_assertion',
    externalAuthIssuer: 'oidc-route-test',
    externalAuthProxySharedSecret: undefined,
    externalAuthFirebaseProjectId: undefined,
    externalAuthFirebaseAudience: undefined,
    externalAuthFirebaseIssuer: undefined,
    externalAuthFirebaseCertsUrl: 'https://example.test/certs',
    externalAuthFirebaseVerifier: 'jwt',
    externalAuthVerificationSecrets: [],
    tableWsCommandChannelEnabled: false,
    verifyFirebaseIdTokenFn: async () => {
      throw new Error('firebase verifier should not be called in default runtime mode');
    },
    ...overrides,
  };
}

async function invokeRoute(options: {
  request: MockIncomingMessage;
  runtimeInfo: RouteRuntimeInfo;
  allowLegacyWalletRoutes: boolean;
  services?: {
    tableService: TableService;
    authWalletService: AuthWalletService;
  };
  tableRouting?: {
    defaultTableId?: string;
    resolveTableService?: (tableId: string) => TableService;
    releaseSeatClaimsForUser?: (userId: number) => void;
    listTableServices?: () => TableService[];
  };
}): Promise<MockServerResponse> {
  const { tableService, authWalletService } = options.services ?? createServices();
  const response = new MockServerResponse();

  await handleRequest(
    options.request as unknown as IncomingMessage,
    response as unknown as ServerResponse<IncomingMessage>,
    tableService,
    authWalletService,
    options.runtimeInfo,
    options.allowLegacyWalletRoutes,
    () => {},
    options.tableRouting,
  );

  return response;
}

async function testHealthRouteIncludesExternalAuthRotationFlag(): Promise<void> {
  const response = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'GET',
      url: '/health',
      headers: {
        host: '127.0.0.1:8787',
      },
    }),
    runtimeInfo: {
      persistenceEnabled: false,
      authAllowDemoUsers: true,
      allowLegacyWalletRoutes: false,
      externalAuthEnabled: true,
      externalAuthMode: 'signed_assertion',
      externalAuthIssuer: 'oidc-route-test',
      externalAuthProxySharedSecret: undefined,
      externalAuthFirebaseProjectId: undefined,
      externalAuthFirebaseAudience: undefined,
      externalAuthFirebaseIssuer: undefined,
      externalAuthFirebaseCertsUrl: 'https://example.test/certs',
      externalAuthFirebaseVerifier: 'jwt',
      externalAuthVerificationSecrets: ['current-secret-1234567890', 'previous-secret-1234567890'],
      tableWsCommandChannelEnabled: true,
      verifyFirebaseIdTokenFn: async () => {
        throw new Error('firebase verifier should not be called in signed_assertion mode');
      },
    },
    allowLegacyWalletRoutes: false,
  });

  assertEqual(response.statusCode, 200, 'Expected GET /health to return HTTP 200.');
  const payload = response.json() as {
    runtime: {
      externalAuthEnabled: boolean;
      externalAuthMode: string;
      externalAuthIssuer: string;
      externalAuthFirebaseVerifier: string;
      externalAuthSecretRotationEnabled: boolean;
      tableWsCommandChannelEnabled: boolean;
    };
  };
  assertEqual(payload.runtime.externalAuthEnabled, true, 'Expected runtime to report external auth enabled.');
  assertEqual(payload.runtime.externalAuthMode, 'signed_assertion', 'Expected runtime to report auth mode.');
  assertEqual(payload.runtime.externalAuthFirebaseVerifier, 'jwt', 'Expected runtime Firebase verifier flag to report.');
  assertEqual(
    payload.runtime.externalAuthIssuer,
    'oidc-route-test',
    'Expected runtime external auth issuer to match configured issuer.',
  );
  assertEqual(
    payload.runtime.externalAuthSecretRotationEnabled,
    true,
    'Expected health runtime to report rotation enabled when two verification secrets are configured.',
  );
  assertEqual(
    payload.runtime.tableWsCommandChannelEnabled,
    true,
    'Expected health runtime to report websocket command channel enablement.',
  );
}

async function testExternalLoginAcceptsPreviousRotationSecret(): Promise<void> {
  const issuer = 'oidc-route-test';
  const assertion = createExternalAuthAssertion(
    {
      iss: issuer,
      sub: 'route-subject-1',
      email: 'route.player@example.com',
      firstName: 'Route',
      lastName: 'Player',
      role: 'PLAYER',
      exp: Date.now() + 60_000,
    },
    'previous-secret-1234567890',
  );

  const response = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/auth/external/login',
      headers: {
        host: '127.0.0.1:8787',
        'content-type': 'application/json',
      },
      body: {
        assertion,
      },
    }),
    runtimeInfo: {
      persistenceEnabled: false,
      authAllowDemoUsers: true,
      allowLegacyWalletRoutes: false,
      externalAuthEnabled: true,
      externalAuthMode: 'signed_assertion',
      externalAuthIssuer: issuer,
      externalAuthProxySharedSecret: undefined,
      externalAuthFirebaseProjectId: undefined,
      externalAuthFirebaseAudience: undefined,
      externalAuthFirebaseIssuer: undefined,
      externalAuthFirebaseCertsUrl: 'https://example.test/certs',
      externalAuthFirebaseVerifier: 'jwt',
      externalAuthVerificationSecrets: ['current-secret-1234567890', 'previous-secret-1234567890'],
      verifyFirebaseIdTokenFn: async () => {
        throw new Error('firebase verifier should not be called in signed_assertion mode');
      },
    },
    allowLegacyWalletRoutes: false,
  });

  assertEqual(response.statusCode, 200, 'Expected external login route to return HTTP 200.');
  const payload = response.json() as {
    session: {
      token: string;
      user: {
        email: string;
      };
    };
  };

  assert(payload.session.token.length > 0, 'Expected external login response to include a session token.');
  assertEqual(payload.session.user.email, 'route.player@example.com', 'Expected external login user email to match.');
}

async function testExternalLoginDisabledReturnsServiceUnavailable(): Promise<void> {
  const response = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/auth/external/login',
      headers: {
        host: '127.0.0.1:8787',
        'content-type': 'application/json',
      },
      body: {
        assertion: 'not-a-valid-assertion',
      },
    }),
    runtimeInfo: {
      persistenceEnabled: false,
      authAllowDemoUsers: true,
      allowLegacyWalletRoutes: false,
      externalAuthEnabled: false,
      externalAuthMode: 'signed_assertion',
      externalAuthIssuer: 'oidc-route-test',
      externalAuthProxySharedSecret: undefined,
      externalAuthFirebaseProjectId: undefined,
      externalAuthFirebaseAudience: undefined,
      externalAuthFirebaseIssuer: undefined,
      externalAuthFirebaseCertsUrl: 'https://example.test/certs',
      externalAuthFirebaseVerifier: 'jwt',
      externalAuthVerificationSecrets: [],
      verifyFirebaseIdTokenFn: async () => {
        throw new Error('firebase verifier should not be called when external auth disabled');
      },
    },
    allowLegacyWalletRoutes: false,
  });

  assertEqual(response.statusCode, 503, 'Expected disabled external login route to return HTTP 503.');
  const payload = response.json() as {
    error: string;
  };
  assertEqual(payload.error, 'EXTERNAL_AUTH_DISABLED', 'Expected external auth disabled error code.');
}

async function testTrustedHeaderModeExternalLoginFlow(): Promise<void> {
  const response = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/auth/external/login',
      headers: {
        host: '127.0.0.1:8787',
        'x-external-auth-proxy-secret': 'trusted-proxy-secret-123456',
        'x-external-auth-issuer': 'trusted-proxy-issuer',
        'x-external-auth-provider': 'trusted-proxy-provider',
        'x-external-auth-subject': 'trusted-subject-1',
        'x-external-auth-email': 'trusted.proxy@example.com',
        'x-external-auth-first-name': 'Trusted',
        'x-external-auth-last-name': 'Proxy',
      },
    }),
    runtimeInfo: {
      persistenceEnabled: false,
      authAllowDemoUsers: true,
      allowLegacyWalletRoutes: false,
      externalAuthEnabled: true,
      externalAuthMode: 'trusted_headers',
      externalAuthIssuer: 'trusted-proxy-issuer',
      externalAuthProxySharedSecret: 'trusted-proxy-secret-123456',
      externalAuthFirebaseProjectId: undefined,
      externalAuthFirebaseAudience: undefined,
      externalAuthFirebaseIssuer: undefined,
      externalAuthFirebaseCertsUrl: 'https://example.test/certs',
      externalAuthFirebaseVerifier: 'jwt',
      externalAuthVerificationSecrets: [],
      verifyFirebaseIdTokenFn: async () => {
        throw new Error('firebase verifier should not be called in trusted_headers mode');
      },
    },
    allowLegacyWalletRoutes: false,
  });

  assertEqual(response.statusCode, 200, 'Expected trusted_headers external login route to return HTTP 200.');
  const payload = response.json() as {
    session: {
      user: {
        email: string;
      };
    };
  };
  assertEqual(
    payload.session.user.email,
    'trusted.proxy@example.com',
    'Expected trusted_headers external login to map trusted email.',
  );
}

async function testTrustedHeaderModeRejectsInvalidProxySecret(): Promise<void> {
  const response = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/auth/external/login',
      headers: {
        host: '127.0.0.1:8787',
        'x-external-auth-proxy-secret': 'wrong-proxy-secret',
        'x-external-auth-provider': 'trusted-proxy-provider',
        'x-external-auth-subject': 'trusted-subject-1',
        'x-external-auth-email': 'trusted.proxy@example.com',
      },
    }),
    runtimeInfo: {
      persistenceEnabled: false,
      authAllowDemoUsers: true,
      allowLegacyWalletRoutes: false,
      externalAuthEnabled: true,
      externalAuthMode: 'trusted_headers',
      externalAuthIssuer: 'trusted-proxy-issuer',
      externalAuthProxySharedSecret: 'trusted-proxy-secret-123456',
      externalAuthFirebaseProjectId: undefined,
      externalAuthFirebaseAudience: undefined,
      externalAuthFirebaseIssuer: undefined,
      externalAuthFirebaseCertsUrl: 'https://example.test/certs',
      externalAuthFirebaseVerifier: 'jwt',
      externalAuthVerificationSecrets: [],
      verifyFirebaseIdTokenFn: async () => {
        throw new Error('firebase verifier should not be called in trusted_headers mode');
      },
    },
    allowLegacyWalletRoutes: false,
  });

  assertEqual(response.statusCode, 401, 'Expected invalid trusted proxy secret to return HTTP 401.');
  const payload = response.json() as {
    error: string;
  };
  assertEqual(payload.error, 'INVALID_EXTERNAL_PROXY_AUTH', 'Expected trusted proxy auth error code.');
}

async function testFirebaseIdTokenModeExternalLoginFlow(): Promise<void> {
  const response = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/auth/external/login',
      headers: {
        host: '127.0.0.1:8787',
        authorization: 'Bearer firebase-token-value',
      },
    }),
    runtimeInfo: {
      persistenceEnabled: false,
      authAllowDemoUsers: true,
      allowLegacyWalletRoutes: false,
      externalAuthEnabled: true,
      externalAuthMode: 'firebase_id_token',
      externalAuthIssuer: 'oidc-unused-in-firebase-mode',
      externalAuthProxySharedSecret: undefined,
      externalAuthFirebaseProjectId: 'firebase-project-dev',
      externalAuthFirebaseAudience: 'firebase-project-dev',
      externalAuthFirebaseIssuer: 'https://securetoken.google.com/firebase-project-dev',
      externalAuthFirebaseCertsUrl: 'https://example.test/firebase-certs',
      externalAuthFirebaseVerifier: 'jwt',
      externalAuthVerificationSecrets: [],
      verifyFirebaseIdTokenFn: async (idToken, options) => {
        assertEqual(idToken, 'firebase-token-value', 'Expected firebase id token to come from Authorization header.');
        assertEqual(options.projectId, 'firebase-project-dev', 'Expected Firebase project id to be passed.');
        return {
          provider: 'firebase',
          subject: 'firebase-user-1',
          email: 'firebase.route@example.com',
          firstName: 'Firebase',
          lastName: 'Route',
          role: 'PLAYER',
        };
      },
    },
    allowLegacyWalletRoutes: false,
  });

  assertEqual(response.statusCode, 200, 'Expected firebase_id_token external login route to return HTTP 200.');
  const payload = response.json() as {
    session: {
      user: {
        email: string;
      };
    };
  };
  assertEqual(
    payload.session.user.email,
    'firebase.route@example.com',
    'Expected firebase_id_token external login to map verified token email.',
  );
}

async function testClaimedSeatRejectsAnonymousPlayerAction(): Promise<void> {
  const services = createServices();
  services.tableService.claimSeat(999, 1);

  const response = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/table/command',
      headers: {
        host: '127.0.0.1:8787',
        'content-type': 'application/json',
      },
      body: {
        type: 'PLAYER_ACTION',
        seatId: 1,
        action: 'FOLD',
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
    services,
  });

  assertEqual(response.statusCode, 401, 'Expected claimed-seat anonymous action to return HTTP 401.');
  const payload = response.json() as {
    error: string;
  };
  assertEqual(payload.error, 'UNAUTHORIZED', 'Expected claimed-seat anonymous action to be unauthorized.');
}

async function testAuthenticatedPlayerActionRequiresSeatClaim(): Promise<void> {
  const services = createServices();
  const session = services.authWalletService.login({ email: 'luna@example.com', password: 'demo' }).session;

  const response = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/table/command',
      headers: {
        host: '127.0.0.1:8787',
        'content-type': 'application/json',
        authorization: `Bearer ${session.token}`,
      },
      body: {
        type: 'PLAYER_ACTION',
        seatId: 1,
        action: 'FOLD',
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
    services,
  });

  assertEqual(response.statusCode, 403, 'Expected unclaimed authenticated seat action to return HTTP 403.');
  const payload = response.json() as {
    error: string;
  };
  assertEqual(payload.error, 'SEAT_UNCLAIMED', 'Expected seat claim requirement error.');
}

async function testSeatClaimRoutesAndOwnershipEnforcement(): Promise<void> {
  const services = createServices();
  const lunaSession = services.authWalletService.login({ email: 'luna@example.com', password: 'demo' }).session;
  const colinSession = services.authWalletService.login({ email: 'colin@example.com', password: 'demo' }).session;

  const claimResponse = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/table/seat',
      headers: {
        host: '127.0.0.1:8787',
        authorization: `Bearer ${lunaSession.token}`,
        'content-type': 'application/json',
      },
      body: {
        seatId: 2,
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
    services,
  });
  assertEqual(claimResponse.statusCode, 200, 'Expected seat claim route to return HTTP 200.');
  const claimPayload = claimResponse.json() as {
    claim: {
      seatId: number;
    };
  };
  assertEqual(claimPayload.claim.seatId, 2, 'Expected claim response to return claimed seat id.');

  const conflictResponse = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/table/seat',
      headers: {
        host: '127.0.0.1:8787',
        authorization: `Bearer ${colinSession.token}`,
        'content-type': 'application/json',
      },
      body: {
        seatId: 2,
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
    services,
  });
  assertEqual(conflictResponse.statusCode, 409, 'Expected conflicting seat claim to return HTTP 409.');
  const conflictPayload = conflictResponse.json() as {
    error: string;
  };
  assertEqual(conflictPayload.error, 'SEAT_CONFLICT', 'Expected seat conflict error code.');

  const forbiddenResponse = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/table/command',
      headers: {
        host: '127.0.0.1:8787',
        'content-type': 'application/json',
        authorization: `Bearer ${lunaSession.token}`,
      },
      body: {
        type: 'PLAYER_ACTION',
        seatId: 1,
        action: 'FOLD',
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
    services,
  });
  assertEqual(forbiddenResponse.statusCode, 403, 'Expected action on non-owned seat to return HTTP 403.');
  const forbiddenPayload = forbiddenResponse.json() as {
    error: string;
  };
  assertEqual(forbiddenPayload.error, 'SEAT_FORBIDDEN', 'Expected seat ownership error code.');
}

async function testPlayerSessionCannotSubmitNonPlayerCommands(): Promise<void> {
  const services = createServices();
  const playerSession = services.authWalletService.login({ email: 'luna@example.com', password: 'demo' }).session;
  const adminSession = services.authWalletService.login({ email: 'colin@example.com', password: 'demo' }).session;

  const playerResponse = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/table/command',
      headers: {
        host: '127.0.0.1:8787',
        authorization: `Bearer ${playerSession.token}`,
        'content-type': 'application/json',
      },
      body: {
        type: 'START_HAND',
        handId: 'player-attempt-hand',
        seed: 321,
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
    services,
  });
  assertEqual(playerResponse.statusCode, 403, 'Expected PLAYER session non-player command to return HTTP 403.');
  const playerPayload = playerResponse.json() as {
    error: string;
  };
  assertEqual(playerPayload.error, 'COMMAND_FORBIDDEN', 'Expected non-player command error code for PLAYER session.');

  const adminResponse = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/table/command',
      headers: {
        host: '127.0.0.1:8787',
        authorization: `Bearer ${adminSession.token}`,
        'content-type': 'application/json',
      },
      body: {
        type: 'START_HAND',
        handId: 'admin-approved-hand',
        seed: 654,
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
    services,
  });
  assertEqual(adminResponse.statusCode, 200, 'Expected ADMIN session non-player command to remain allowed.');
}

async function testLogoutReleasesSeatClaim(): Promise<void> {
  const services = createServices();
  const lunaSession = services.authWalletService.login({ email: 'luna@example.com', password: 'demo' }).session;

  const claimResponse = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/table/seat',
      headers: {
        host: '127.0.0.1:8787',
        authorization: `Bearer ${lunaSession.token}`,
        'content-type': 'application/json',
      },
      body: {
        seatId: 3,
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
    services,
  });
  assertEqual(claimResponse.statusCode, 200, 'Expected seat claim to succeed before logout.');

  const logoutResponse = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        host: '127.0.0.1:8787',
        authorization: `Bearer ${lunaSession.token}`,
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
    services,
  });

  assertEqual(logoutResponse.statusCode, 204, 'Expected logout to return HTTP 204.');
  assertEqual(
    services.tableService.getSeatClaimForUser(lunaSession.user.id),
    null,
    'Expected logout to release the authenticated user seat claim.',
  );
}

async function testTableRoutesResolveByQueryTableId(): Promise<void> {
  const services = createServices();
  const secondaryTable = new TableService({
    tableId: 'blaze-04',
    initialState: createDefaultTableState({
      handId: 'boot-blaze',
      seed: 902,
    }),
  });
  const tableServiceById = new Map<string, TableService>([
    [services.tableService.getSnapshot().tableId, services.tableService],
    [secondaryTable.getSnapshot().tableId, secondaryTable],
  ]);
  const tableRouting = {
    defaultTableId: services.tableService.getSnapshot().tableId,
    resolveTableService: (tableId: string): TableService => {
      const existing = tableServiceById.get(tableId);
      if (existing) {
        return existing;
      }

      const created = new TableService({
        tableId,
        initialState: createDefaultTableState({
          handId: `${tableId}-boot`,
          seed: 903,
        }),
      });
      tableServiceById.set(tableId, created);
      return created;
    },
    releaseSeatClaimsForUser: (userId: number): void => {
      for (const scopedTable of tableServiceById.values()) {
        scopedTable.releaseSeatForUser(userId);
      }
    },
    listTableServices: (): TableService[] => Array.from(tableServiceById.values()),
  };

  const commandResponse = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/table/command?tableId=blaze-04',
      headers: {
        host: '127.0.0.1:8787',
        'content-type': 'application/json',
      },
      body: {
        type: 'START_HAND',
        handId: 'blaze-hand-1',
        seed: 777,
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
    services,
    tableRouting,
  });
  assertEqual(commandResponse.statusCode, 200, 'Expected scoped table command route to return HTTP 200.');

  const defaultStateResponse = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'GET',
      url: '/api/table/state',
      headers: {
        host: '127.0.0.1:8787',
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
    services,
    tableRouting,
  });
  const defaultState = defaultStateResponse.json() as {
    tableId: string;
    state: {
      handId: string;
    };
  };
  assertEqual(defaultState.tableId, 'http-test-table', 'Expected default state route to use default table id.');
  assertEqual(defaultState.state.handId, 'boot-http-test', 'Expected default table hand id to remain unchanged.');

  const secondaryStateResponse = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'GET',
      url: '/api/table/state?tableId=blaze-04',
      headers: {
        host: '127.0.0.1:8787',
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
    services,
    tableRouting,
  });
  const secondaryState = secondaryStateResponse.json() as {
    tableId: string;
    state: {
      handId: string;
    };
  };
  assertEqual(secondaryState.tableId, 'blaze-04', 'Expected scoped state route to resolve target table id.');
  assertEqual(secondaryState.state.handId, 'blaze-hand-1', 'Expected scoped table command to mutate scoped table state.');
}

async function testInvalidTableIdQueryRejected(): Promise<void> {
  const response = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'GET',
      url: '/api/table/state?tableId=bad%20table!',
      headers: {
        host: '127.0.0.1:8787',
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
  });

  assertEqual(response.statusCode, 400, 'Expected invalid table id query to return HTTP 400.');
  const payload = response.json() as {
    error: string;
  };
  assertEqual(payload.error, 'BAD_REQUEST', 'Expected invalid table id query to return BAD_REQUEST.');
}

async function testTableListRouteReturnsServerFedMetadata(): Promise<void> {
  const services = createServices();
  const secondaryTable = new TableService({
    tableId: 'drift-09',
    initialState: createDefaultTableState({
      handId: 'boot-drift',
      seed: 932,
    }),
  });
  secondaryTable.applyCommand({ type: 'START_HAND', handId: 'drift-hand-1', seed: 933 });
  secondaryTable.applyCommand({ type: 'POST_BLINDS' });

  const tableServiceById = new Map<string, TableService>([
    [services.tableService.getSnapshot().tableId, services.tableService],
    [secondaryTable.getSnapshot().tableId, secondaryTable],
  ]);
  const tableRouting = {
    defaultTableId: services.tableService.getSnapshot().tableId,
    resolveTableService: (tableId: string): TableService => {
      const existing = tableServiceById.get(tableId);
      if (existing) {
        return existing;
      }
      return services.tableService;
    },
    releaseSeatClaimsForUser: (userId: number): void => {
      for (const scopedTable of tableServiceById.values()) {
        scopedTable.releaseSeatForUser(userId);
      }
    },
    listTableServices: (): TableService[] => Array.from(tableServiceById.values()),
  };

  const response = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'GET',
      url: '/api/table/list',
      headers: {
        host: '127.0.0.1:8787',
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
    services,
    tableRouting,
  });

  assertEqual(response.statusCode, 200, 'Expected table list route to return HTTP 200.');
  const payload = response.json() as {
    records: Array<{
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
    }>;
  };
  assertEqual(payload.records.length, 2, 'Expected table list to return all routed table services.');
  const driftRecord = payload.records.find((record) => record.tableId === 'drift-09');
  assert(driftRecord !== undefined, 'Expected list route to include secondary table record.');
  assertEqual(driftRecord.name, 'Drift 09', 'Expected list route to expose formatted table name.');
  assertEqual(driftRecord.stakesLabel, '5 / 10', 'Expected stakes label to derive from table blind config.');
  assertEqual(driftRecord.phase, 'BLINDS_POSTED', 'Expected phase field to mirror scoped table snapshot phase.');
}

async function testLogoutReleasesClaimsAcrossScopedTables(): Promise<void> {
  const services = createServices();
  const secondaryTable = new TableService({
    tableId: 'atlas-01',
    initialState: createDefaultTableState({
      handId: 'boot-atlas',
      seed: 910,
    }),
  });
  const tableServiceById = new Map<string, TableService>([
    [services.tableService.getSnapshot().tableId, services.tableService],
    [secondaryTable.getSnapshot().tableId, secondaryTable],
  ]);
  const tableRouting = {
    defaultTableId: services.tableService.getSnapshot().tableId,
    resolveTableService: (tableId: string): TableService => {
      const existing = tableServiceById.get(tableId);
      if (existing) {
        return existing;
      }

      const created = new TableService({
        tableId,
        initialState: createDefaultTableState({
          handId: `${tableId}-boot`,
          seed: 911,
        }),
      });
      tableServiceById.set(tableId, created);
      return created;
    },
    releaseSeatClaimsForUser: (userId: number): void => {
      for (const scopedTable of tableServiceById.values()) {
        scopedTable.releaseSeatForUser(userId);
      }
    },
    listTableServices: (): TableService[] => Array.from(tableServiceById.values()),
  };
  const session = services.authWalletService.login({ email: 'luna@example.com', password: 'demo' }).session;

  const defaultClaim = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/table/seat',
      headers: {
        host: '127.0.0.1:8787',
        authorization: `Bearer ${session.token}`,
        'content-type': 'application/json',
      },
      body: {
        seatId: 1,
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
    services,
    tableRouting,
  });
  assertEqual(defaultClaim.statusCode, 200, 'Expected default table seat claim to succeed.');

  const scopedClaim = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/table/seat?tableId=atlas-01',
      headers: {
        host: '127.0.0.1:8787',
        authorization: `Bearer ${session.token}`,
        'content-type': 'application/json',
      },
      body: {
        seatId: 2,
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
    services,
    tableRouting,
  });
  assertEqual(scopedClaim.statusCode, 200, 'Expected scoped table seat claim to succeed.');

  const logoutResponse = await invokeRoute({
    request: new MockIncomingMessage({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        host: '127.0.0.1:8787',
        authorization: `Bearer ${session.token}`,
      },
    }),
    runtimeInfo: createRuntimeInfo(),
    allowLegacyWalletRoutes: false,
    services,
    tableRouting,
  });
  assertEqual(logoutResponse.statusCode, 204, 'Expected logout to succeed with scoped table routing.');
  assertEqual(services.tableService.getSeatClaimForUser(session.user.id), null, 'Expected default table claim to clear on logout.');
  assertEqual(secondaryTable.getSeatClaimForUser(session.user.id), null, 'Expected scoped table claim to clear on logout.');
}

async function testTableStreamUpgradeReturnsScopedSnapshot(): Promise<void> {
  const primaryTable = new TableService({
    tableId: 'http-test-table',
    initialState: createDefaultTableState({
      handId: 'boot-http-test',
      seed: 401,
    }),
  });
  const scopedTable = new TableService({
    tableId: 'blaze-04',
    initialState: createDefaultTableState({
      handId: 'boot-blaze',
      seed: 402,
    }),
  });
  const tableServiceById = new Map<string, TableService>([
    [primaryTable.getSnapshot().tableId, primaryTable],
    [scopedTable.getSnapshot().tableId, scopedTable],
  ]);
  const tableStreamHub = new TableStreamHub({ heartbeatIntervalMs: 60_000 });
  const socket = new MockUpgradeSocket();

  try {
    handleTableStreamUpgrade(
      createUpgradeRequest({
        url: '/api/table/ws?tableId=blaze-04',
        headers: createUpgradeHeaders(),
      }),
      socket as unknown as Duplex,
      {
        defaultTableId: primaryTable.getSnapshot().tableId,
        resolveTableService: (tableId: string) => tableServiceById.get(tableId) ?? primaryTable,
        tableStreamHub,
        host: '127.0.0.1',
        port: 8787,
      },
    );

    assert(socket.writes.length >= 2, 'Expected successful upgrade to write handshake and initial snapshot frame.');
    const handshake = socket.writes[0];
    assert(typeof handshake === 'string', 'Expected first websocket write to be HTTP upgrade handshake text.');
    assert(
      handshake.includes('HTTP/1.1 101 Switching Protocols'),
      'Expected websocket upgrade handshake to return HTTP 101.',
    );

    const messages = extractSocketJsonMessages(socket);
    const snapshotMessage = messages.find((message) =>
      typeof message === 'object'
        && message !== null
        && !Array.isArray(message)
        && (message as Record<string, unknown>).type === 'TABLE_SNAPSHOT');
    assert(snapshotMessage, 'Expected websocket upgrade to emit initial TABLE_SNAPSHOT message.');
    const snapshotRecord = snapshotMessage as Record<string, unknown>;
    assertEqual(snapshotRecord.tableId, 'blaze-04', 'Expected initial stream snapshot to match scoped table id.');
    assert(
      typeof snapshotRecord.snapshot === 'object'
      && snapshotRecord.snapshot !== null
      && (snapshotRecord.snapshot as Record<string, unknown>).tableId === 'blaze-04',
      'Expected initial stream payload snapshot to be scoped to requested table.',
    );
  } finally {
    tableStreamHub.closeAll();
  }
}

async function testTableStreamUpgradeRejectsInvalidVersion(): Promise<void> {
  const primaryTable = new TableService({
    tableId: 'http-test-table',
    initialState: createDefaultTableState({
      handId: 'boot-http-test',
      seed: 403,
    }),
  });
  const tableStreamHub = new TableStreamHub({ heartbeatIntervalMs: 60_000 });
  const socket = new MockUpgradeSocket();

  try {
    handleTableStreamUpgrade(
      createUpgradeRequest({
        url: '/api/table/ws',
        headers: createUpgradeHeaders({
          'sec-websocket-version': '12',
        }),
      }),
      socket as unknown as Duplex,
      {
        defaultTableId: primaryTable.getSnapshot().tableId,
        resolveTableService: () => primaryTable,
        tableStreamHub,
        host: '127.0.0.1',
        port: 8787,
      },
    );

    assert(socket.writes.length >= 1, 'Expected invalid websocket version request to receive an HTTP rejection response.');
    const responseText = socket.writes[0];
    assert(typeof responseText === 'string', 'Expected upgrade rejection response to be plain HTTP text.');
    assert(
      responseText.startsWith('HTTP/1.1 426 Upgrade Required'),
      'Expected unsupported websocket version to return HTTP 426.',
    );
    assertEqual(socket.destroyed, true, 'Expected upgrade rejection to destroy the socket.');
  } finally {
    tableStreamHub.closeAll();
  }
}

async function testTableStreamPublishSnapshotIsTableScoped(): Promise<void> {
  const primaryTable = new TableService({
    tableId: 'http-test-table',
    initialState: createDefaultTableState({
      handId: 'boot-http-test',
      seed: 404,
    }),
  });
  const scopedTable = new TableService({
    tableId: 'drift-09',
    initialState: createDefaultTableState({
      handId: 'boot-drift',
      seed: 405,
    }),
  });
  const tableServiceById = new Map<string, TableService>([
    [primaryTable.getSnapshot().tableId, primaryTable],
    [scopedTable.getSnapshot().tableId, scopedTable],
  ]);
  const tableStreamHub = new TableStreamHub({ heartbeatIntervalMs: 60_000 });
  const primarySocket = new MockUpgradeSocket();
  const scopedSocket = new MockUpgradeSocket();

  try {
    handleTableStreamUpgrade(
      createUpgradeRequest({
        url: '/api/table/ws',
        headers: createUpgradeHeaders(),
      }),
      primarySocket as unknown as Duplex,
      {
        defaultTableId: primaryTable.getSnapshot().tableId,
        resolveTableService: (tableId: string) => tableServiceById.get(tableId) ?? primaryTable,
        tableStreamHub,
        host: '127.0.0.1',
        port: 8787,
      },
    );

    handleTableStreamUpgrade(
      createUpgradeRequest({
        url: '/api/table/ws?tableId=drift-09',
        headers: createUpgradeHeaders(),
      }),
      scopedSocket as unknown as Duplex,
      {
        defaultTableId: primaryTable.getSnapshot().tableId,
        resolveTableService: (tableId: string) => tableServiceById.get(tableId) ?? primaryTable,
        tableStreamHub,
        host: '127.0.0.1',
        port: 8787,
      },
    );

    primarySocket.writes = [];
    scopedSocket.writes = [];

    scopedTable.applyCommand({
      type: 'START_HAND',
      handId: 'drift-hand-2',
      seed: 406,
    });
    tableStreamHub.publishSnapshot(scopedTable.getSnapshot());

    assertEqual(
      extractSocketJsonMessages(primarySocket).length,
      0,
      'Expected default table stream to ignore snapshots from other tables.',
    );
    const scopedMessages = extractSocketJsonMessages(scopedSocket);
    assertEqual(scopedMessages.length, 1, 'Expected scoped table stream to receive published snapshot.');
    const scopedSnapshotMessage = scopedMessages[0] as Record<string, unknown>;
    assertEqual(scopedSnapshotMessage.type, 'TABLE_SNAPSHOT', 'Expected published stream message type to be TABLE_SNAPSHOT.');
    assertEqual(scopedSnapshotMessage.tableId, 'drift-09', 'Expected published snapshot message to preserve scoped table id.');
  } finally {
    tableStreamHub.closeAll();
  }
}

async function testTableStreamSocketCloseRemovesConnection(): Promise<void> {
  const primaryTable = new TableService({
    tableId: 'http-test-table',
    initialState: createDefaultTableState({
      handId: 'boot-http-test',
      seed: 407,
    }),
  });
  const tableStreamHub = new TableStreamHub({ heartbeatIntervalMs: 60_000 });
  const socket = new MockUpgradeSocket();

  try {
    handleTableStreamUpgrade(
      createUpgradeRequest({
        url: '/api/table/ws',
        headers: createUpgradeHeaders(),
      }),
      socket as unknown as Duplex,
      {
        defaultTableId: primaryTable.getSnapshot().tableId,
        resolveTableService: () => primaryTable,
        tableStreamHub,
        host: '127.0.0.1',
        port: 8787,
      },
    );

    socket.writes = [];
    socket.emit('close');
    tableStreamHub.publishSnapshot(primaryTable.getSnapshot());

    assertEqual(
      extractSocketJsonMessages(socket).length,
      0,
      'Expected closed websocket stream to stop receiving table snapshot broadcasts.',
    );
  } finally {
    tableStreamHub.closeAll();
  }
}

async function testTableStreamHubEmitsHeartbeats(): Promise<void> {
  const primaryTable = new TableService({
    tableId: 'http-test-table',
    initialState: createDefaultTableState({
      handId: 'boot-http-test',
      seed: 408,
    }),
  });
  const tableStreamHub = new TableStreamHub({ heartbeatIntervalMs: 15 });
  const socket = new MockUpgradeSocket();

  try {
    handleTableStreamUpgrade(
      createUpgradeRequest({
        url: '/api/table/ws',
        headers: createUpgradeHeaders(),
      }),
      socket as unknown as Duplex,
      {
        defaultTableId: primaryTable.getSnapshot().tableId,
        resolveTableService: () => primaryTable,
        tableStreamHub,
        host: '127.0.0.1',
        port: 8787,
      },
    );

    socket.writes = [];
    await new Promise((resolve) => {
      setTimeout(resolve, 35);
    });

    const hasHeartbeat = extractSocketJsonMessages(socket).some((message) =>
      typeof message === 'object'
      && message !== null
      && !Array.isArray(message)
      && (message as Record<string, unknown>).type === 'TABLE_HEARTBEAT');
    assertEqual(hasHeartbeat, true, 'Expected active websocket streams to receive heartbeat frames.');
  } finally {
    tableStreamHub.closeAll();
  }
}

async function testTableStreamApplyCommandDisabledReturnsError(): Promise<void> {
  const tableService = new TableService({
    tableId: 'http-test-table',
    initialState: createDefaultTableState({
      handId: 'boot-http-test',
      seed: 409,
    }),
  });
  const tableStreamHub = new TableStreamHub({ heartbeatIntervalMs: 60_000 });
  const idempotencyStore = new TableStreamCommandIdempotencyStore();
  const authWalletService = new AuthWalletService();
  const socket = new MockUpgradeSocket();

  try {
    handleTableStreamUpgrade(
      createUpgradeRequest({
        url: '/api/table/ws',
        headers: createUpgradeHeaders(),
      }),
      socket as unknown as Duplex,
      {
        defaultTableId: tableService.getSnapshot().tableId,
        resolveTableService: () => tableService,
        tableStreamHub,
        host: '127.0.0.1',
        port: 8787,
        commandChannel: {
          enabled: false,
          authWalletService,
          persistRuntimeState: () => {},
          emitTableSnapshot: () => {},
          idempotencyStore,
        },
      },
    );

    socket.writes = [];
    socket.emit(
      'data',
      encodeClientTextFrame(JSON.stringify({
        type: 'APPLY_COMMAND',
        commandId: 'cmd-disabled-1',
        command: {
          type: 'START_HAND',
          handId: 'ws-disabled-hand',
          seed: 999,
        },
      })),
    );

    const messages = extractSocketJsonMessages(socket);
    assertEqual(messages.length, 1, 'Expected disabled command channel request to emit exactly one response message.');
    const errorPayload = messages[0] as Record<string, unknown>;
    assertEqual(errorPayload.type, 'COMMAND_ERROR', 'Expected disabled channel to emit COMMAND_ERROR.');
    assertEqual(
      errorPayload.code,
      'COMMAND_CHANNEL_DISABLED',
      'Expected disabled command channel error code.',
    );
  } finally {
    tableStreamHub.closeAll();
  }
}

async function testTableStreamApplyCommandAuthChecksMatchHttpRouteRules(): Promise<void> {
  const tableService = new TableService({
    tableId: 'http-test-table',
    initialState: createDefaultTableState({
      handId: 'boot-http-test',
      seed: 410,
    }),
  });
  tableService.claimSeat(999, 1);

  const tableStreamHub = new TableStreamHub({ heartbeatIntervalMs: 60_000 });
  const idempotencyStore = new TableStreamCommandIdempotencyStore();
  const authWalletService = new AuthWalletService();
  const playerSession = authWalletService.login({ email: 'luna@example.com', password: 'demo' }).session;
  const socket = new MockUpgradeSocket();

  try {
    handleTableStreamUpgrade(
      createUpgradeRequest({
        url: '/api/table/ws',
        headers: createUpgradeHeaders(),
      }),
      socket as unknown as Duplex,
      {
        defaultTableId: tableService.getSnapshot().tableId,
        resolveTableService: () => tableService,
        tableStreamHub,
        host: '127.0.0.1',
        port: 8787,
        commandChannel: {
          enabled: true,
          authWalletService,
          persistRuntimeState: () => {},
          emitTableSnapshot: () => {},
          idempotencyStore,
        },
      },
    );

    socket.writes = [];
    socket.emit(
      'data',
      encodeClientTextFrame(JSON.stringify({
        type: 'APPLY_COMMAND',
        commandId: 'cmd-auth-1',
        command: {
          type: 'PLAYER_ACTION',
          seatId: 1,
          action: 'FOLD',
        },
      })),
    );

    socket.emit(
      'data',
      encodeClientTextFrame(JSON.stringify({
        type: 'APPLY_COMMAND',
        commandId: 'cmd-auth-2',
        authToken: playerSession.token,
        command: {
          type: 'START_HAND',
          handId: 'player-forbidden',
          seed: 111,
        },
      })),
    );

    const messages = extractSocketJsonMessages(socket);
    const firstError = messages[0] as Record<string, unknown>;
    const secondError = messages[1] as Record<string, unknown>;
    assertEqual(firstError.type, 'COMMAND_ERROR', 'Expected claimed-seat unauthenticated action to return COMMAND_ERROR.');
    assertEqual(firstError.code, 'UNAUTHORIZED', 'Expected claimed-seat unauthenticated action to be unauthorized.');
    assertEqual(secondError.type, 'COMMAND_ERROR', 'Expected player non-player command to return COMMAND_ERROR.');
    assertEqual(secondError.code, 'COMMAND_FORBIDDEN', 'Expected player non-player command to be forbidden.');
  } finally {
    tableStreamHub.closeAll();
  }
}

async function testTableStreamApplyCommandIdempotencyReplaysAckWithoutReapplying(): Promise<void> {
  const tableService = new TableService({
    tableId: 'http-test-table',
    initialState: createDefaultTableState({
      handId: 'boot-http-test',
      seed: 411,
    }),
  });
  const tableStreamHub = new TableStreamHub({ heartbeatIntervalMs: 60_000 });
  const idempotencyStore = new TableStreamCommandIdempotencyStore();
  const authWalletService = new AuthWalletService();
  const socket = new MockUpgradeSocket();

  try {
    handleTableStreamUpgrade(
      createUpgradeRequest({
        url: '/api/table/ws',
        headers: createUpgradeHeaders(),
      }),
      socket as unknown as Duplex,
      {
        defaultTableId: tableService.getSnapshot().tableId,
        resolveTableService: () => tableService,
        tableStreamHub,
        host: '127.0.0.1',
        port: 8787,
        commandChannel: {
          enabled: true,
          authWalletService,
          persistRuntimeState: () => {},
          emitTableSnapshot: () => {},
          idempotencyStore,
        },
      },
    );

    socket.writes = [];
    const commandPayload = JSON.stringify({
      type: 'APPLY_COMMAND',
      commandId: 'cmd-idempotent-1',
      command: {
        type: 'START_HAND',
        handId: 'ws-hand-1',
        seed: 222,
      },
    });
    socket.emit('data', encodeClientTextFrame(commandPayload));
    socket.emit('data', encodeClientTextFrame(commandPayload));

    const messages = extractSocketJsonMessages(socket)
      .filter((message) =>
        typeof message === 'object'
        && message !== null
        && !Array.isArray(message)
        && (message as Record<string, unknown>).type === 'COMMAND_ACK');
    assertEqual(messages.length, 2, 'Expected duplicate commandId submissions to return replayed COMMAND_ACK responses.');
    const firstAck = messages[0] as Record<string, unknown>;
    const secondAck = messages[1] as Record<string, unknown>;
    assertEqual(firstAck.commandId, 'cmd-idempotent-1', 'Expected first ACK to include command id.');
    assertEqual(secondAck.commandId, 'cmd-idempotent-1', 'Expected duplicate ACK to include command id.');
    assertEqual(
      JSON.stringify(firstAck.result),
      JSON.stringify(secondAck.result),
      'Expected duplicate commandId to replay the original result payload.',
    );
    assertEqual(tableService.getSnapshot().commandSequence, 1, 'Expected duplicate commandId to apply only once.');
  } finally {
    tableStreamHub.closeAll();
  }
}

async function runAll(): Promise<void> {
  await testHealthRouteIncludesExternalAuthRotationFlag();
  await testExternalLoginAcceptsPreviousRotationSecret();
  await testExternalLoginDisabledReturnsServiceUnavailable();
  await testTrustedHeaderModeExternalLoginFlow();
  await testTrustedHeaderModeRejectsInvalidProxySecret();
  await testFirebaseIdTokenModeExternalLoginFlow();
  await testClaimedSeatRejectsAnonymousPlayerAction();
  await testAuthenticatedPlayerActionRequiresSeatClaim();
  await testSeatClaimRoutesAndOwnershipEnforcement();
  await testPlayerSessionCannotSubmitNonPlayerCommands();
  await testLogoutReleasesSeatClaim();
  await testTableRoutesResolveByQueryTableId();
  await testInvalidTableIdQueryRejected();
  await testTableListRouteReturnsServerFedMetadata();
  await testLogoutReleasesClaimsAcrossScopedTables();
  await testTableStreamUpgradeReturnsScopedSnapshot();
  await testTableStreamUpgradeRejectsInvalidVersion();
  await testTableStreamPublishSnapshotIsTableScoped();
  await testTableStreamSocketCloseRemovesConnection();
  await testTableStreamHubEmitsHeartbeats();
  await testTableStreamApplyCommandDisabledReturnsError();
  await testTableStreamApplyCommandAuthChecksMatchHttpRouteRules();
  await testTableStreamApplyCommandIdempotencyReplaysAckWithoutReapplying();
  console.info('HTTP route tests passed (external auth login + health diagnostics + seat auth + table routing + stream upgrade + stream commands).');
}

await runAll();
