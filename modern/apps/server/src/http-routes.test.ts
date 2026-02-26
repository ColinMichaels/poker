import type { IncomingMessage, ServerResponse } from 'node:http';
import { AuthWalletService } from './auth-wallet-service.ts';
import { createExternalAuthAssertion } from './external-auth.ts';
import { handleRequest } from './index.ts';
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

class MockIncomingMessage implements IncomingMessage {
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

class MockServerResponse implements ServerResponse {
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

async function invokeRoute(options: {
  request: MockIncomingMessage;
  runtimeInfo: {
    persistenceEnabled: boolean;
    authAllowDemoUsers: boolean;
    allowLegacyWalletRoutes: boolean;
    externalAuthEnabled: boolean;
    externalAuthIssuer: string;
    externalAuthVerificationSecrets: readonly string[];
  };
  allowLegacyWalletRoutes: boolean;
}): Promise<MockServerResponse> {
  const { tableService, authWalletService } = createServices();
  const response = new MockServerResponse();

  await handleRequest(
    options.request,
    response,
    tableService,
    authWalletService,
    options.runtimeInfo,
    options.allowLegacyWalletRoutes,
    () => {},
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
      externalAuthIssuer: 'oidc-route-test',
      externalAuthVerificationSecrets: ['current-secret-1234567890', 'previous-secret-1234567890'],
    },
    allowLegacyWalletRoutes: false,
  });

  assertEqual(response.statusCode, 200, 'Expected GET /health to return HTTP 200.');
  const payload = response.json() as {
    runtime: {
      externalAuthEnabled: boolean;
      externalAuthIssuer: string;
      externalAuthSecretRotationEnabled: boolean;
    };
  };
  assertEqual(payload.runtime.externalAuthEnabled, true, 'Expected runtime to report external auth enabled.');
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
      externalAuthIssuer: issuer,
      externalAuthVerificationSecrets: ['current-secret-1234567890', 'previous-secret-1234567890'],
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
      externalAuthIssuer: 'oidc-route-test',
      externalAuthVerificationSecrets: [],
    },
    allowLegacyWalletRoutes: false,
  });

  assertEqual(response.statusCode, 503, 'Expected disabled external login route to return HTTP 503.');
  const payload = response.json() as {
    error: string;
  };
  assertEqual(payload.error, 'EXTERNAL_AUTH_DISABLED', 'Expected external auth disabled error code.');
}

async function runAll(): Promise<void> {
  await testHealthRouteIncludesExternalAuthRotationFlag();
  await testExternalLoginAcceptsPreviousRotationSecret();
  await testExternalLoginDisabledReturnsServiceUnavailable();
  console.info('HTTP route tests passed (external auth login + health runtime diagnostics).');
}

await runAll();
