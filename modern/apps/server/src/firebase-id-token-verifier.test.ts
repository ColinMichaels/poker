import { createFirebaseIdTokenVerifier } from './firebase-id-token-verifier.ts';

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

async function testJwtVerifierSelection(): Promise<void> {
  const verifier = createFirebaseIdTokenVerifier({
    verifierMode: 'jwt',
  });

  await Promise.resolve();
  assert(typeof verifier === 'function', 'Expected JWT verifier factory to return a callable function.');
}

async function testAdminSdkVerifierSelection(): Promise<void> {
  const verifier = createFirebaseIdTokenVerifier({
    verifierMode: 'admin_sdk',
  });

  await Promise.resolve();
  assert(typeof verifier === 'function', 'Expected Admin SDK verifier factory to return a callable function.');
}

async function testAdminSdkVerifierPropagatesMissingSdkError(): Promise<void> {
  const verifier = createFirebaseIdTokenVerifier({
    verifierMode: 'admin_sdk',
  });

  try {
    await verifier('fake-token', {
      projectId: 'firebase-project-test',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(
      /Firebase Admin SDK module load failed|Firebase ID token verification failed/i.test(message),
      'Expected admin verifier missing-SDK error message.',
    );
    return;
  }

  throw new Error('Expected admin SDK verifier call to fail when SDK is not available.');
}

async function testJwtVerifierRejectsNonJwtToken(): Promise<void> {
  const verifier = createFirebaseIdTokenVerifier({
    verifierMode: 'jwt',
  });

  try {
    await verifier('not-a-jwt', {
      projectId: 'firebase-project-test',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assertEqual(
      /must include header, payload, and signature/i.test(message),
      true,
      'Expected JWT verifier to reject malformed tokens.',
    );
    return;
  }

  throw new Error('Expected JWT verifier call to fail for malformed tokens.');
}

async function runAll(): Promise<void> {
  await testJwtVerifierSelection();
  await testAdminSdkVerifierSelection();
  await testAdminSdkVerifierPropagatesMissingSdkError();
  await testJwtVerifierRejectsNonJwtToken();
  console.info('Firebase verifier factory tests passed (mode selection + failure propagation).');
}

await runAll();
