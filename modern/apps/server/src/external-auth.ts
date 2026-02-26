import { createHmac } from 'node:crypto';
import type { UserRole } from '@poker/game-contracts';

const ALLOWED_USER_ROLES: readonly UserRole[] = ['PLAYER', 'OPERATOR', 'ADMIN'];

export interface ExternalAuthAssertionPayload {
  iss: string;
  sub: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  exp: number;
}

export interface ExternalAuthVerificationOptions {
  sharedSecrets: readonly string[];
  expectedIssuer: string;
  nowMs?: number;
}

function toBase64Url(value: string): string {
  return toBase64UrlFromBase64(Buffer.from(value, 'utf8').toString('base64'));
}

function fromBase64Url(value: string): string {
  return Buffer.from(toBase64FromBase64Url(value), 'base64').toString('utf8');
}

function toBase64UrlFromBase64(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function toBase64FromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddingSize = (4 - (normalized.length % 4)) % 4;
  return normalized + '='.repeat(paddingSize);
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function isValidRole(value: unknown): value is UserRole {
  return typeof value === 'string' && ALLOWED_USER_ROLES.includes(value as UserRole);
}

function normalizePayload(rawPayload: unknown): ExternalAuthAssertionPayload {
  if (typeof rawPayload !== 'object' || rawPayload === null) {
    throw new Error('External auth assertion payload must be an object.');
  }

  const payload = rawPayload as Record<string, unknown>;
  const issuer = typeof payload.iss === 'string' ? payload.iss.trim() : '';
  const subject = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const firstName = typeof payload.firstName === 'string' ? payload.firstName.trim() : '';
  const lastName = typeof payload.lastName === 'string' ? payload.lastName.trim() : '';
  const exp = typeof payload.exp === 'number' ? payload.exp : Number.NaN;

  if (!issuer) {
    throw new Error('External auth assertion is missing issuer.');
  }
  if (!subject) {
    throw new Error('External auth assertion is missing subject.');
  }
  if (!email) {
    throw new Error('External auth assertion is missing email.');
  }
  if (!Number.isInteger(exp) || exp <= 0) {
    throw new Error('External auth assertion has invalid exp.');
  }
  if (payload.role !== undefined && !isValidRole(payload.role)) {
    throw new Error(`External auth assertion role is invalid: ${String(payload.role)}.`);
  }

  return {
    iss: issuer,
    sub: subject,
    email,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    role: payload.role as UserRole | undefined,
    exp,
  };
}

function signPayload(encodedPayload: string, sharedSecret: string): string {
  return toBase64UrlFromBase64(createHmac('sha256', sharedSecret).update(encodedPayload).digest('base64'));
}

function normalizeVerificationSecrets(rawSecrets: readonly string[]): string[] {
  const normalized = Array.from(new Set(rawSecrets.map((secret) => secret.trim()).filter(Boolean)));
  if (normalized.length === 0) {
    throw new Error('External auth verification secret is not configured.');
  }

  return normalized;
}

function hasValidSignature(
  encodedPayload: string,
  receivedSignature: string,
  sharedSecrets: readonly string[],
): boolean {
  let isValid = false;
  for (const sharedSecret of sharedSecrets) {
    const expectedSignature = signPayload(encodedPayload, sharedSecret);
    if (constantTimeEqual(receivedSignature, expectedSignature)) {
      isValid = true;
    }
  }

  return isValid;
}

export function createExternalAuthAssertion(
  payload: ExternalAuthAssertionPayload,
  sharedSecret: string,
): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, sharedSecret);
  return `${encodedPayload}.${signature}`;
}

export function verifyExternalAuthAssertion(
  assertion: string,
  options: ExternalAuthVerificationOptions,
): ExternalAuthAssertionPayload {
  const trimmedAssertion = assertion.trim();
  if (!trimmedAssertion) {
    throw new Error('External auth assertion is required.');
  }

  const parts = trimmedAssertion.split('.');
  if (parts.length !== 2) {
    throw new Error('External auth assertion must include payload and signature.');
  }

  const [encodedPayload, receivedSignature] = parts;
  if (!encodedPayload || !receivedSignature) {
    throw new Error('External auth assertion is malformed.');
  }

  const verificationSecrets = normalizeVerificationSecrets(options.sharedSecrets);
  if (!hasValidSignature(encodedPayload, receivedSignature, verificationSecrets)) {
    throw new Error('External auth assertion signature is invalid.');
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(fromBase64Url(encodedPayload)) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`External auth assertion payload parse failed: ${message}`);
  }

  const payload = normalizePayload(rawPayload);
  if (payload.iss !== options.expectedIssuer) {
    throw new Error('External auth assertion issuer is invalid.');
  }

  const nowMs = options.nowMs ?? Date.now();
  if (payload.exp <= nowMs) {
    throw new Error('External auth assertion has expired.');
  }

  return payload;
}
