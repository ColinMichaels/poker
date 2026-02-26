import { createVerify } from 'node:crypto';
import type { UserRole } from '@poker/game-contracts';

const DEFAULT_FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const ALLOWED_USER_ROLES: readonly UserRole[] = ['PLAYER', 'OPERATOR', 'ADMIN'];

interface FirebaseJwtHeader {
  alg: string;
  kid?: string;
  typ?: string;
}

interface FirebaseJwtPayload {
  aud?: unknown;
  iss?: unknown;
  sub?: unknown;
  exp?: unknown;
  iat?: unknown;
  email?: unknown;
  name?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  role?: unknown;
}

export interface FirebaseExternalIdentity {
  provider: 'firebase';
  subject: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
}

export interface FirebaseIdTokenVerificationOptions {
  projectId: string;
  audience?: string;
  issuer?: string;
  certsUrl?: string;
  nowMs?: number;
  fetchCerts?: (certsUrl: string) => Promise<Record<string, string>>;
}

function toBase64FromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddingSize = (4 - (normalized.length % 4)) % 4;
  return normalized + '='.repeat(paddingSize);
}

function fromBase64Url(value: string): string {
  return Buffer.from(toBase64FromBase64Url(value), 'base64').toString('utf8');
}

function parseJsonSegment<T>(segment: string, label: string): T {
  try {
    return JSON.parse(fromBase64Url(segment)) as T;
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`Firebase ID token ${label} parse failed: ${details}`);
  }
}

function toUnixTimeMs(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Firebase ID token ${label} claim is invalid.`);
  }

  return Math.trunc(value * 1000);
}

function normalizeRole(value: unknown): UserRole | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string' && ALLOWED_USER_ROLES.includes(value as UserRole)) {
    return value as UserRole;
  }

  throw new Error(`Firebase ID token role claim is invalid: ${String(value)}.`);
}

function defaultNameParts(fullName: string): { firstName?: string; lastName?: string } {
  const normalized = fullName.trim();
  if (!normalized) {
    return {};
  }

  const parts = normalized.split(/\s+/g);
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

async function defaultFetchCerts(certsUrl: string): Promise<Record<string, string>> {
  const response = await fetch(certsUrl);
  if (!response.ok) {
    throw new Error(`Firebase cert fetch failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Firebase cert payload is not an object.');
  }

  const certs: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      certs[key] = value;
    }
  }

  if (Object.keys(certs).length === 0) {
    throw new Error('Firebase cert payload did not include any signing keys.');
  }

  return certs;
}

function verifySignature(jwt: string, kid: string, signatureSegment: string, certs: Record<string, string>): void {
  const signingKey = certs[kid];
  if (!signingKey) {
    throw new Error(`Firebase ID token signing key was not found for kid: ${kid}`);
  }

  const message = jwt.split('.').slice(0, 2).join('.');
  const verifier = createVerify('RSA-SHA256');
  verifier.update(message);
  const signature = Buffer.from(toBase64FromBase64Url(signatureSegment), 'base64');
  const valid = verifier.verify(signingKey, signature);
  if (!valid) {
    throw new Error('Firebase ID token signature is invalid.');
  }
}

function validatePayload(
  payload: FirebaseJwtPayload,
  options: FirebaseIdTokenVerificationOptions,
): FirebaseExternalIdentity {
  const projectId = options.projectId.trim();
  if (!projectId) {
    throw new Error('Firebase project id is required for ID token verification.');
  }

  const expectedAudience = options.audience?.trim() || projectId;
  const expectedIssuer = options.issuer?.trim() || `https://securetoken.google.com/${projectId}`;
  const nowMs = options.nowMs ?? Date.now();

  const issuer = typeof payload.iss === 'string' ? payload.iss : '';
  if (issuer !== expectedIssuer) {
    throw new Error('Firebase ID token issuer is invalid.');
  }

  const audience = typeof payload.aud === 'string' ? payload.aud : '';
  if (audience !== expectedAudience) {
    throw new Error('Firebase ID token audience is invalid.');
  }

  const subject = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  if (!subject || subject.length > 128) {
    throw new Error('Firebase ID token subject is invalid.');
  }

  const expMs = toUnixTimeMs(payload.exp, 'exp');
  if (expMs <= nowMs) {
    throw new Error('Firebase ID token has expired.');
  }

  const issuedAtMs = toUnixTimeMs(payload.iat, 'iat');
  if (issuedAtMs > nowMs + 60_000) {
    throw new Error('Firebase ID token issued-at time is invalid.');
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!email) {
    throw new Error('Firebase ID token email claim is required.');
  }

  const explicitFirstName = typeof payload.given_name === 'string' ? payload.given_name.trim() : '';
  const explicitLastName = typeof payload.family_name === 'string' ? payload.family_name.trim() : '';
  const fullName = typeof payload.name === 'string' ? payload.name : '';
  const defaultNames = defaultNameParts(fullName);
  const firstName = explicitFirstName || defaultNames.firstName;
  const lastName = explicitLastName || defaultNames.lastName;

  return {
    provider: 'firebase',
    subject,
    email,
    firstName,
    lastName,
    role: normalizeRole(payload.role),
  };
}

export async function verifyFirebaseIdToken(
  idToken: string,
  options: FirebaseIdTokenVerificationOptions,
): Promise<FirebaseExternalIdentity> {
  const trimmedToken = idToken.trim();
  if (!trimmedToken) {
    throw new Error('Firebase ID token is required.');
  }

  const parts = trimmedToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Firebase ID token must include header, payload, and signature.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJsonSegment<FirebaseJwtHeader>(encodedHeader, 'header');
  if (header.alg !== 'RS256') {
    throw new Error('Firebase ID token must use RS256 signature algorithm.');
  }

  const kid = typeof header.kid === 'string' ? header.kid.trim() : '';
  if (!kid) {
    throw new Error('Firebase ID token header is missing kid.');
  }

  const certsUrl = options.certsUrl?.trim() || DEFAULT_FIREBASE_CERTS_URL;
  const fetchCerts = options.fetchCerts ?? defaultFetchCerts;
  const certs = await fetchCerts(certsUrl);
  verifySignature(trimmedToken, kid, encodedSignature, certs);

  const payload = parseJsonSegment<FirebaseJwtPayload>(encodedPayload, 'payload');
  return validatePayload(payload, options);
}
