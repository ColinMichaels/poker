import { createExternalAuthAssertion, verifyExternalAuthAssertion } from './external-auth.ts';

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

function testVerifiesValidAssertion(): void {
  const now = 1_700_000_000_000;
  const assertion = createExternalAuthAssertion(
    {
      iss: 'oidc-demo',
      sub: 'subject-1',
      email: 'player@example.com',
      firstName: 'Player',
      lastName: 'One',
      role: 'PLAYER',
      exp: now + 60_000,
    },
    'shared-secret-1234567890',
  );

  const payload = verifyExternalAuthAssertion(assertion, {
    sharedSecret: 'shared-secret-1234567890',
    expectedIssuer: 'oidc-demo',
    nowMs: now,
  });

  assertEqual(payload.iss, 'oidc-demo', 'Expected issuer to round-trip.');
  assertEqual(payload.sub, 'subject-1', 'Expected subject to round-trip.');
  assertEqual(payload.email, 'player@example.com', 'Expected email normalization to round-trip.');
  assertEqual(payload.role, 'PLAYER', 'Expected role to round-trip.');
}

function testRejectsInvalidSignature(): void {
  const assertion = createExternalAuthAssertion(
    {
      iss: 'oidc-demo',
      sub: 'subject-1',
      email: 'player@example.com',
      exp: Date.now() + 30_000,
    },
    'correct-secret-123456',
  );

  assertThrows(
    () =>
      verifyExternalAuthAssertion(assertion, {
        sharedSecret: 'wrong-secret-123456',
        expectedIssuer: 'oidc-demo',
      }),
    /signature is invalid/i,
    'Expected signature mismatch to fail verification.',
  );
}

function testRejectsExpiredAndInvalidIssuerAssertions(): void {
  const now = 1_700_000_000_000;
  const assertion = createExternalAuthAssertion(
    {
      iss: 'oidc-demo',
      sub: 'subject-1',
      email: 'player@example.com',
      exp: now - 1,
    },
    'shared-secret-1234567890',
  );

  assertThrows(
    () =>
      verifyExternalAuthAssertion(assertion, {
        sharedSecret: 'shared-secret-1234567890',
        expectedIssuer: 'oidc-demo',
        nowMs: now,
      }),
    /has expired/i,
    'Expected expired assertion to be rejected.',
  );

  const wrongIssuerAssertion = createExternalAuthAssertion(
    {
      iss: 'oidc-other',
      sub: 'subject-2',
      email: 'player2@example.com',
      exp: now + 10_000,
    },
    'shared-secret-1234567890',
  );

  assertThrows(
    () =>
      verifyExternalAuthAssertion(wrongIssuerAssertion, {
        sharedSecret: 'shared-secret-1234567890',
        expectedIssuer: 'oidc-demo',
        nowMs: now,
      }),
    /issuer is invalid/i,
    'Expected mismatched issuer to be rejected.',
  );
}

function runAll(): void {
  testVerifiesValidAssertion();
  testRejectsInvalidSignature();
  testRejectsExpiredAndInvalidIssuerAssertions();
  console.info('External auth tests passed (signed assertion verification).');
}

runAll();

