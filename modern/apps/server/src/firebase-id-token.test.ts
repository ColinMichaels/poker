import { createSign, generateKeyPairSync } from 'node:crypto';
import { verifyFirebaseIdToken } from './firebase-id-token.ts';

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message} (actual=${String(actual)} expected=${String(expected)})`);
  }
}

function assertThrowsAsync(
  fn: () => Promise<unknown>,
  expectedPattern: RegExp,
  message: string,
): Promise<void> {
  return fn()
    .then(() => {
      throw new Error(message);
    })
    .catch((error) => {
      const details = error instanceof Error ? error.message : String(error);
      if (!expectedPattern.test(details)) {
        throw new Error(`${message} (unexpected error: ${details})`);
      }
    });
}

function toBase64UrlFromBase64(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeJson(value: unknown): string {
  return toBase64UrlFromBase64(Buffer.from(JSON.stringify(value), 'utf8').toString('base64'));
}

function createJwt(payload: Record<string, unknown>, privateKeyPem: string): string {
  const encodedHeader = encodeJson({
    alg: 'RS256',
    kid: 'firebase-test-kid',
    typ: 'JWT',
  });
  const encodedPayload = encodeJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(privateKeyPem, 'base64');
  const encodedSignature = toBase64UrlFromBase64(signature);
  return `${signingInput}.${encodedSignature}`;
}

function createSigningFixture(nowMs: number): {
  token: string;
  certs: Record<string, string>;
} {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  const token = createJwt(
    {
      iss: 'https://securetoken.google.com/firebase-project-test',
      aud: 'firebase-project-test',
      sub: 'firebase-user-1',
      iat: Math.floor(nowMs / 1000) - 10,
      exp: Math.floor(nowMs / 1000) + 300,
      email: 'firebase.user@example.com',
      name: 'Firebase User',
      given_name: 'Firebase',
      family_name: 'User',
      role: 'PLAYER',
    },
    privateKey,
  );

  return {
    token,
    certs: {
      'firebase-test-kid': publicKey,
    },
  };
}

async function testVerifiesValidFirebaseIdToken(): Promise<void> {
  const nowMs = 1_700_000_000_000;
  const fixture = createSigningFixture(nowMs);
  const identity = await verifyFirebaseIdToken(fixture.token, {
    projectId: 'firebase-project-test',
    nowMs,
    fetchCerts: async () => fixture.certs,
  });

  assertEqual(identity.provider, 'firebase', 'Expected firebase identity provider.');
  assertEqual(identity.subject, 'firebase-user-1', 'Expected Firebase subject claim to map.');
  assertEqual(identity.email, 'firebase.user@example.com', 'Expected Firebase email claim to map.');
  assertEqual(identity.firstName, 'Firebase', 'Expected Firebase first name claim to map.');
  assertEqual(identity.lastName, 'User', 'Expected Firebase last name claim to map.');
  assertEqual(identity.role, 'PLAYER', 'Expected Firebase role claim to map.');
}

async function testRejectsInvalidIssuerAndExpiredToken(): Promise<void> {
  const nowMs = 1_700_000_000_000;
  const fixture = createSigningFixture(nowMs);

  await assertThrowsAsync(
    () =>
      verifyFirebaseIdToken(fixture.token, {
        projectId: 'firebase-project-test',
        issuer: 'https://securetoken.google.com/wrong-project',
        nowMs,
        fetchCerts: async () => fixture.certs,
      }),
    /issuer is invalid/i,
    'Expected invalid issuer to be rejected.',
  );

  await assertThrowsAsync(
    () =>
      verifyFirebaseIdToken(fixture.token, {
        projectId: 'firebase-project-test',
        nowMs: nowMs + 1_000_000,
        fetchCerts: async () => fixture.certs,
      }),
    /has expired/i,
    'Expected expired Firebase ID token to be rejected.',
  );
}

async function testRejectsInvalidSignature(): Promise<void> {
  const nowMs = 1_700_000_000_000;
  const fixture = createSigningFixture(nowMs);
  const { publicKey: wrongPublicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  await assertThrowsAsync(
    () =>
      verifyFirebaseIdToken(fixture.token, {
        projectId: 'firebase-project-test',
        nowMs,
        fetchCerts: async () => ({
          'firebase-test-kid': wrongPublicKey,
        }),
      }),
    /signature is invalid/i,
    'Expected mismatched Firebase signing key to fail verification.',
  );
}

async function runAll(): Promise<void> {
  await testVerifiesValidFirebaseIdToken();
  await testRejectsInvalidIssuerAndExpiredToken();
  await testRejectsInvalidSignature();
  console.info('Firebase ID token tests passed (verification + claim validation).');
}

await runAll();
