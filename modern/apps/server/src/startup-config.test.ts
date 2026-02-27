import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadStartupConfig } from './startup-config.ts';

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

function assertThrows(fn: () => void, expectedPattern: RegExp, message: string): void {
  try {
    fn();
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    if (!expectedPattern.test(details)) {
      throw new Error(`${message} (unexpected error: ${details})`);
    }
    return;
  }

  throw new Error(message);
}

function testLoadsDevelopmentDefaults(): void {
  const config = loadStartupConfig({});
  assertEqual(config.isProduction, false, 'Expected non-production mode by default.');
  assertEqual(config.port, 8787, 'Expected default port for missing env.');
  assertEqual(config.host, '127.0.0.1', 'Expected default host for missing env.');
  assertEqual(config.tableId, 'table-1', 'Expected default table id for missing env.');
  assertEqual(config.persistenceEnabled, true, 'Expected persistence to default enabled.');
  assert(config.stateFilePath.includes('/.data/runtime-state.json'), 'Expected default state file path suffix.');
  assertEqual(config.authAllowDemoUsers, true, 'Expected demo users enabled by default outside production.');
  assertEqual(config.allowLegacyWalletRoutes, true, 'Expected legacy routes enabled by default outside production.');
  assertEqual(config.tableWsCommandChannelEnabled, false, 'Expected WS command channel disabled by default.');
  assertEqual(config.externalAuthEnabled, false, 'Expected external auth disabled by default.');
  assertEqual(config.externalAuthMode, 'signed_assertion', 'Expected default external auth mode.');
  assertEqual(config.externalAuthIssuer, 'external-idp', 'Expected default external auth issuer.');
  assertEqual(config.externalAuthSharedSecret, undefined, 'Expected no external auth secret by default.');
  assertEqual(config.externalAuthSharedSecretPrevious, undefined, 'Expected no previous external auth secret by default.');
  assertEqual(config.externalAuthProxySharedSecret, undefined, 'Expected no external auth proxy shared secret by default.');
  assertEqual(config.externalAuthFirebaseProjectId, undefined, 'Expected no Firebase project id by default.');
  assertEqual(config.externalAuthFirebaseAudience, undefined, 'Expected no Firebase audience override by default.');
  assertEqual(config.externalAuthFirebaseIssuer, undefined, 'Expected no Firebase issuer override by default.');
  assertEqual(config.externalAuthFirebaseVerifier, 'jwt', 'Expected default Firebase verifier mode.');
  assertEqual(
    config.externalAuthFirebaseServiceAccountFile,
    undefined,
    'Expected no Firebase service account file by default.',
  );
  assertEqual(
    config.externalAuthFirebaseCertsUrl,
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    'Expected default Firebase certs url.',
  );
  assertEqual(config.externalAuthVerificationSecrets.length, 0, 'Expected no external auth verification secrets by default.');
  assertEqual(config.authBootstrapUsers, undefined, 'Expected no bootstrap users by default.');
}

function testProductionDefaultsDisableCompatibilityModes(): void {
  const config = loadStartupConfig({
    NODE_ENV: 'production',
    POKER_AUTH_TOKEN_SECRET: 'prod-secret-value',
  });

  assertEqual(config.isProduction, true, 'Expected production mode for NODE_ENV=production.');
  assertEqual(config.authAllowDemoUsers, false, 'Expected demo users disabled by default in production.');
  assertEqual(config.allowLegacyWalletRoutes, false, 'Expected legacy routes disabled by default in production.');
  assertEqual(config.externalAuthEnabled, false, 'Expected external auth disabled by default in production.');
}

function testProductionRequiresExplicitTokenSecret(): void {
  assertThrows(
    () => loadStartupConfig({ NODE_ENV: 'production' }),
    /POKER_AUTH_TOKEN_SECRET is required when NODE_ENV=production/,
    'Expected production mode without auth token secret to fail.',
  );
}

function testLoadsExplicitOverrides(): void {
  const config = loadStartupConfig({
    PORT: '9100',
    HOST: '0.0.0.0',
    TABLE_ID: 'table-x',
    POKER_STATE_PERSIST: '0',
    POKER_STATE_FILE: '/tmp/custom-state.json',
    POKER_AUTH_TOKEN_SECRET: 'secret-value',
    POKER_SESSION_TTL_MS: '60000',
    POKER_AUTH_ALLOW_DEMO_USERS: '1',
    POKER_ENABLE_LEGACY_WALLET_ROUTES: '0',
    POKER_ENABLE_TABLE_WS_COMMANDS: '1',
    POKER_EXTERNAL_AUTH_ENABLED: '1',
    POKER_EXTERNAL_AUTH_ISSUER: 'oidc-demo',
    POKER_EXTERNAL_AUTH_SHARED_SECRET: 'external-secret-123456',
    POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS: 'external-secret-prev-123456',
  });

  assertEqual(config.port, 9100, 'Expected PORT override.');
  assertEqual(config.host, '0.0.0.0', 'Expected HOST override.');
  assertEqual(config.tableId, 'table-x', 'Expected TABLE_ID override.');
  assertEqual(config.persistenceEnabled, false, 'Expected persistence override.');
  assertEqual(config.stateFilePath, '/tmp/custom-state.json', 'Expected state file override.');
  assertEqual(config.authTokenSecret, 'secret-value', 'Expected token secret override.');
  assertEqual(config.authSessionTtlMs, 60000, 'Expected session ttl override.');
  assertEqual(config.authAllowDemoUsers, true, 'Expected explicit demo users override.');
  assertEqual(config.allowLegacyWalletRoutes, false, 'Expected explicit legacy route override.');
  assertEqual(config.tableWsCommandChannelEnabled, true, 'Expected explicit WS command channel override.');
  assertEqual(config.externalAuthEnabled, true, 'Expected explicit external auth enablement.');
  assertEqual(config.externalAuthMode, 'signed_assertion', 'Expected signed assertion mode when unspecified.');
  assertEqual(config.externalAuthIssuer, 'oidc-demo', 'Expected external auth issuer override.');
  assertEqual(config.externalAuthSharedSecret, 'external-secret-123456', 'Expected external auth secret override.');
  assertEqual(
    config.externalAuthSharedSecretPrevious,
    'external-secret-prev-123456',
    'Expected previous external auth secret override.',
  );
  assertEqual(config.externalAuthVerificationSecrets.length, 2, 'Expected both external auth verification secrets.');
  assertEqual(
    config.externalAuthVerificationSecrets[0],
    'external-secret-123456',
    'Expected primary external auth secret to be first.',
  );
  assertEqual(
    config.externalAuthVerificationSecrets[1],
    'external-secret-prev-123456',
    'Expected previous external auth secret to be included.',
  );
}

function testLoadsTrustedHeadersExternalAuthModeOverrides(): void {
  const config = loadStartupConfig({
    POKER_EXTERNAL_AUTH_ENABLED: '1',
    POKER_EXTERNAL_AUTH_MODE: 'trusted_headers',
    POKER_EXTERNAL_AUTH_ISSUER: 'proxy-issuer',
    POKER_EXTERNAL_AUTH_PROXY_SHARED_SECRET: 'proxy-shared-secret-123456',
  });

  assertEqual(config.externalAuthEnabled, true, 'Expected external auth enabled in trusted_headers mode.');
  assertEqual(config.externalAuthMode, 'trusted_headers', 'Expected trusted_headers external auth mode.');
  assertEqual(config.externalAuthIssuer, 'proxy-issuer', 'Expected trusted_headers issuer override.');
  assertEqual(
    config.externalAuthProxySharedSecret,
    'proxy-shared-secret-123456',
    'Expected trusted_headers proxy shared secret override.',
  );
  assertEqual(
    config.externalAuthVerificationSecrets.length,
    0,
    'Expected no assertion verification secrets in trusted_headers mode.',
  );
}

function testLoadsFirebaseIdTokenExternalAuthModeOverrides(): void {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poker-firebase-admin-sa-'));
  try {
    const serviceAccountFile = path.join(tempDir, 'firebase-service-account.json');
    fs.writeFileSync(
      serviceAccountFile,
      JSON.stringify({
        type: 'service_account',
        project_id: 'poker-firebase-dev',
        private_key_id: 'test-key-id',
        private_key: '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n',
        client_email: 'firebase-adminsdk@test.iam.gserviceaccount.com',
        client_id: '1234567890',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/test',
      }),
      'utf8',
    );

    const config = loadStartupConfig({
      POKER_EXTERNAL_AUTH_ENABLED: '1',
      POKER_EXTERNAL_AUTH_MODE: 'firebase_id_token',
      POKER_EXTERNAL_AUTH_FIREBASE_PROJECT_ID: 'poker-firebase-dev',
      POKER_EXTERNAL_AUTH_FIREBASE_AUDIENCE: 'poker-firebase-audience',
      POKER_EXTERNAL_AUTH_FIREBASE_ISSUER: 'https://securetoken.google.com/poker-firebase-dev',
      POKER_EXTERNAL_AUTH_FIREBASE_CERTS_URL: 'https://example.test/firebase-certs',
      POKER_EXTERNAL_AUTH_FIREBASE_VERIFIER: 'admin_sdk',
      POKER_EXTERNAL_AUTH_FIREBASE_SERVICE_ACCOUNT_FILE: serviceAccountFile,
    });

    assertEqual(config.externalAuthEnabled, true, 'Expected external auth enabled in firebase_id_token mode.');
    assertEqual(config.externalAuthMode, 'firebase_id_token', 'Expected firebase_id_token external auth mode.');
    assertEqual(config.externalAuthFirebaseProjectId, 'poker-firebase-dev', 'Expected Firebase project id override.');
    assertEqual(config.externalAuthFirebaseAudience, 'poker-firebase-audience', 'Expected Firebase audience override.');
    assertEqual(
      config.externalAuthFirebaseIssuer,
      'https://securetoken.google.com/poker-firebase-dev',
      'Expected Firebase issuer override.',
    );
    assertEqual(
      config.externalAuthFirebaseCertsUrl,
      'https://example.test/firebase-certs',
      'Expected Firebase certs url override.',
    );
    assertEqual(config.externalAuthFirebaseVerifier, 'admin_sdk', 'Expected Firebase verifier override.');
    assertEqual(
      config.externalAuthFirebaseServiceAccountFile,
      serviceAccountFile,
      'Expected Firebase service account file override.',
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testLoadsBootstrapUsersFromArrayAndWrapper(): void {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poker-startup-config-'));

  try {
    const arrayFilePath = path.join(tempDir, 'users-array.json');
    fs.writeFileSync(
      arrayFilePath,
      JSON.stringify([
        {
          email: 'array@example.com',
          password: 'demo',
        },
      ]),
      'utf8',
    );

    const wrappedFilePath = path.join(tempDir, 'users-wrapped.json');
    fs.writeFileSync(
      wrappedFilePath,
      JSON.stringify({
        users: [
          {
            email: 'wrapped@example.com',
            password: 'demo',
          },
        ],
      }),
      'utf8',
    );

    const arrayConfig = loadStartupConfig({
      POKER_AUTH_BOOTSTRAP_USERS_FILE: arrayFilePath,
    });
    assertEqual(arrayConfig.authBootstrapUsers?.length, 1, 'Expected one bootstrap user from array file.');

    const wrappedConfig = loadStartupConfig({
      POKER_AUTH_BOOTSTRAP_USERS_FILE: wrappedFilePath,
    });
    assertEqual(wrappedConfig.authBootstrapUsers?.length, 1, 'Expected one bootstrap user from wrapped users file.');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testRejectsInvalidBootstrapUsersAndEnvValues(): void {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poker-startup-config-invalid-'));

  try {
    const invalidUsersPath = path.join(tempDir, 'users-invalid.json');
    fs.writeFileSync(
      invalidUsersPath,
      JSON.stringify({
        users: [
          {
            email: 'missing-password@example.com',
          },
        ],
      }),
      'utf8',
    );

    const invalidRoleUsersPath = path.join(tempDir, 'users-invalid-role.json');
    fs.writeFileSync(
      invalidRoleUsersPath,
      JSON.stringify({
        users: [
          {
            email: 'invalid-role@example.com',
            password: 'demo',
            role: 'INVALID',
          },
        ],
      }),
      'utf8',
    );

    assertThrows(
      () => loadStartupConfig({ PORT: '0' }),
      /Invalid PORT value/,
      'Expected invalid port values to fail.',
    );

    assertThrows(
      () => loadStartupConfig({ POKER_ENABLE_LEGACY_WALLET_ROUTES: 'maybe' }),
      /Invalid POKER_ENABLE_LEGACY_WALLET_ROUTES value/,
      'Expected invalid boolean env values to fail.',
    );

    assertThrows(
      () => loadStartupConfig({ POKER_ENABLE_TABLE_WS_COMMANDS: 'maybe' }),
      /Invalid POKER_ENABLE_TABLE_WS_COMMANDS value/,
      'Expected invalid WS command channel toggle values to fail.',
    );

    assertThrows(
      () => loadStartupConfig({ POKER_EXTERNAL_AUTH_ENABLED: 'maybe' }),
      /Invalid POKER_EXTERNAL_AUTH_ENABLED value/,
      'Expected invalid external auth toggle value to fail.',
    );

    assertThrows(
      () => loadStartupConfig({ POKER_EXTERNAL_AUTH_MODE: 'unknown-mode' }),
      /Invalid POKER_EXTERNAL_AUTH_MODE value/i,
      'Expected invalid external auth mode values to fail.',
    );

    assertThrows(
      () => loadStartupConfig({ POKER_EXTERNAL_AUTH_FIREBASE_VERIFIER: 'unknown' }),
      /Invalid POKER_EXTERNAL_AUTH_FIREBASE_VERIFIER value/i,
      'Expected invalid Firebase verifier mode values to fail.',
    );

    assertThrows(
      () => loadStartupConfig({ POKER_EXTERNAL_AUTH_ENABLED: '1' }),
      /POKER_EXTERNAL_AUTH_SHARED_SECRET is required/,
      'Expected enabled external auth without shared secret to fail.',
    );

    assertThrows(
      () =>
        loadStartupConfig({
          POKER_EXTERNAL_AUTH_SHARED_SECRET: 'short-secret',
        }),
      /must be at least 16 characters/,
      'Expected short external auth shared secret values to fail.',
    );

    assertThrows(
      () =>
        loadStartupConfig({
          POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS: 'external-prev-123456',
        }),
      /requires POKER_EXTERNAL_AUTH_SHARED_SECRET/i,
      'Expected previous external auth secret without primary secret to fail.',
    );

    assertThrows(
      () =>
        loadStartupConfig({
          POKER_EXTERNAL_AUTH_SHARED_SECRET: 'external-secret-123456',
          POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS: 'short-prev',
        }),
      /POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS must be at least 16 characters/i,
      'Expected short previous external auth secret values to fail.',
    );

    assertThrows(
      () =>
        loadStartupConfig({
          POKER_EXTERNAL_AUTH_SHARED_SECRET: 'external-secret-123456',
          POKER_EXTERNAL_AUTH_SHARED_SECRET_PREVIOUS: 'external-secret-123456',
        }),
      /must differ from POKER_EXTERNAL_AUTH_SHARED_SECRET/i,
      'Expected duplicate primary/previous external auth secrets to fail.',
    );

    assertThrows(
      () =>
        loadStartupConfig({
          POKER_EXTERNAL_AUTH_ENABLED: '1',
          POKER_EXTERNAL_AUTH_MODE: 'trusted_headers',
        }),
      /POKER_EXTERNAL_AUTH_PROXY_SHARED_SECRET is required in trusted_headers mode/i,
      'Expected trusted_headers mode to require proxy shared secret.',
    );

    assertThrows(
      () =>
        loadStartupConfig({
          POKER_EXTERNAL_AUTH_MODE: 'trusted_headers',
          POKER_EXTERNAL_AUTH_PROXY_SHARED_SECRET: 'short-proxy',
        }),
      /POKER_EXTERNAL_AUTH_PROXY_SHARED_SECRET must be at least 16 characters/i,
      'Expected short external auth proxy shared secret values to fail.',
    );

    assertThrows(
      () =>
        loadStartupConfig({
          POKER_EXTERNAL_AUTH_ENABLED: '1',
          POKER_EXTERNAL_AUTH_MODE: 'firebase_id_token',
        }),
      /POKER_EXTERNAL_AUTH_FIREBASE_PROJECT_ID is required in firebase_id_token mode/i,
      'Expected firebase_id_token mode to require Firebase project id.',
    );

    assertThrows(
      () =>
        loadStartupConfig({
          POKER_EXTERNAL_AUTH_ENABLED: '1',
          POKER_EXTERNAL_AUTH_MODE: 'firebase_id_token',
          POKER_EXTERNAL_AUTH_FIREBASE_PROJECT_ID: 'poker-firebase-dev',
          POKER_EXTERNAL_AUTH_FIREBASE_VERIFIER: 'admin_sdk',
          POKER_EXTERNAL_AUTH_FIREBASE_SERVICE_ACCOUNT_FILE: '/tmp/missing-firebase-service-account.json',
        }),
      /POKER_EXTERNAL_AUTH_FIREBASE_SERVICE_ACCOUNT_FILE does not exist/i,
      'Expected missing Firebase admin service account files to fail validation.',
    );

    assertThrows(
      () => loadStartupConfig({ POKER_AUTH_BOOTSTRAP_USERS_FILE: invalidUsersPath }),
      /must include password or passwordHash/,
      'Expected invalid bootstrap users to fail validation.',
    );

    assertThrows(
      () => loadStartupConfig({ POKER_AUTH_BOOTSTRAP_USERS_FILE: invalidRoleUsersPath }),
      /must use role PLAYER, OPERATOR, or ADMIN/i,
      'Expected invalid bootstrap role values to fail validation.',
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function runAll(): void {
  testLoadsDevelopmentDefaults();
  testProductionDefaultsDisableCompatibilityModes();
  testProductionRequiresExplicitTokenSecret();
  testLoadsExplicitOverrides();
  testLoadsTrustedHeadersExternalAuthModeOverrides();
  testLoadsFirebaseIdTokenExternalAuthModeOverrides();
  testLoadsBootstrapUsersFromArrayAndWrapper();
  testRejectsInvalidBootstrapUsersAndEnvValues();
  console.info('Startup config tests passed (env parsing + bootstrap user validation).');
}

runAll();
