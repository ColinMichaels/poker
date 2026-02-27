import type { IncomingMessage, ServerResponse } from 'node:http';
import { AuthWalletService } from './auth-wallet-service.ts';
import { createExternalAuthAssertion } from './external-auth.ts';
import type { FirebaseExternalIdentity, FirebaseIdTokenVerificationOptions } from './firebase-id-token.ts';
import { handleRequest } from './index.ts';
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
  console.info('HTTP route tests passed (external auth login + health diagnostics + seat auth + table routing).');
}

await runAll();
