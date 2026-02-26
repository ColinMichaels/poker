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

async function runAll(): Promise<void> {
  await testHealthRouteIncludesExternalAuthRotationFlag();
  await testExternalLoginAcceptsPreviousRotationSecret();
  await testExternalLoginDisabledReturnsServiceUnavailable();
  await testTrustedHeaderModeExternalLoginFlow();
  await testTrustedHeaderModeRejectsInvalidProxySecret();
  await testFirebaseIdTokenModeExternalLoginFlow();
  console.info('HTTP route tests passed (external auth login + health runtime diagnostics).');
}

await runAll();
