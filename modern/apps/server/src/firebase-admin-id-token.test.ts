import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFirebaseAdminIdTokenVerifier } from './firebase-admin-id-token.ts';

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message} (actual=${String(actual)} expected=${String(expected)})`);
  }
}

async function assertThrowsAsync(
  fn: () => Promise<unknown>,
  expectedPattern: RegExp,
  message: string,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    if (!expectedPattern.test(details)) {
      throw new Error(`${message} (unexpected error: ${details})`);
    }
    return;
  }

  throw new Error(message);
}

async function testVerifiesFirebaseTokenWithAdminSdkAdapter(): Promise<void> {
  let initializeCallCount = 0;
  const verifier = createFirebaseAdminIdTokenVerifier({
    importModule: async (moduleName) => {
      if (moduleName === 'firebase-admin/app') {
        return {
          getApps: () => [],
          initializeApp: () => {
            initializeCallCount += 1;
            return { app: 'firebase-test-app' };
          },
          cert: () => ({ cert: 'ok' }),
        };
      }

      if (moduleName === 'firebase-admin/auth') {
        return {
          getAuth: () => ({
            verifyIdToken: async () => ({
              uid: 'firebase-admin-user-1',
              aud: 'firebase-admin-project',
              iss: 'https://securetoken.google.com/firebase-admin-project',
              exp: 1_700_000_000 + 300,
              iat: 1_700_000_000 - 10,
              email: 'admin.adapter@example.com',
              given_name: 'Admin',
              family_name: 'Adapter',
              role: 'PLAYER',
            }),
          }),
        };
      }

      throw new Error(`Unexpected module import request: ${moduleName}`);
    },
  });

  const nowMs = 1_700_000_000_000;
  const identity = await verifier('firebase-admin-token', {
    projectId: 'firebase-admin-project',
    nowMs,
  });

  assertEqual(initializeCallCount, 1, 'Expected Firebase app initialization to run exactly once.');
  assertEqual(identity.provider, 'firebase', 'Expected Firebase provider mapping.');
  assertEqual(identity.subject, 'firebase-admin-user-1', 'Expected Firebase uid mapping.');
  assertEqual(identity.email, 'admin.adapter@example.com', 'Expected Firebase email mapping.');
  assertEqual(identity.firstName, 'Admin', 'Expected Firebase first name mapping.');
  assertEqual(identity.lastName, 'Adapter', 'Expected Firebase last name mapping.');
  assertEqual(identity.role, 'PLAYER', 'Expected Firebase role mapping.');
}

async function testRejectsMissingFirebaseAdminSdkModules(): Promise<void> {
  const verifier = createFirebaseAdminIdTokenVerifier({
    importModule: async () => {
      throw new Error('module not found');
    },
  });

  await assertThrowsAsync(
    () =>
      verifier('firebase-admin-token', {
        projectId: 'firebase-admin-project',
      }),
    /Firebase Admin SDK module load failed/i,
    'Expected missing Firebase Admin SDK modules to fail.',
  );
}

async function testUsesServiceAccountFileWhenConfigured(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poker-firebase-admin-adapter-'));
  try {
    const serviceAccountFile = path.join(tempDir, 'service-account.json');
    fs.writeFileSync(
      serviceAccountFile,
      JSON.stringify({
        type: 'service_account',
        project_id: 'firebase-admin-project',
      }),
      'utf8',
    );

    let certCallCount = 0;
    const verifier = createFirebaseAdminIdTokenVerifier({
      serviceAccountFile,
      importModule: async (moduleName) => {
        if (moduleName === 'firebase-admin/app') {
          return {
            getApps: () => [],
            initializeApp: () => ({ app: 'firebase-test-app' }),
            cert: () => {
              certCallCount += 1;
              return { cert: 'ok' };
            },
          };
        }

        if (moduleName === 'firebase-admin/auth') {
          return {
            getAuth: () => ({
              verifyIdToken: async () => ({
                uid: 'firebase-admin-user-2',
                aud: 'firebase-admin-project',
                iss: 'https://securetoken.google.com/firebase-admin-project',
                exp: 1_700_000_000 + 300,
                iat: 1_700_000_000 - 10,
                email: 'service.account@example.com',
              }),
            }),
          };
        }

        throw new Error(`Unexpected module import request: ${moduleName}`);
      },
    });

    await verifier('firebase-admin-token', {
      projectId: 'firebase-admin-project',
      nowMs: 1_700_000_000_000,
    });

    assertEqual(certCallCount, 1, 'Expected Firebase app cert() to be used with service account file.');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function runAll(): Promise<void> {
  await testVerifiesFirebaseTokenWithAdminSdkAdapter();
  await testRejectsMissingFirebaseAdminSdkModules();
  await testUsesServiceAccountFileWhenConfigured();
  console.info('Firebase Admin ID token adapter tests passed (SDK loading + mapping + service-account path).');
}

await runAll();
