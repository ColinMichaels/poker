import { isAuditPrivilegedRole, resolveAuditScopeUserId } from './auth-authorization.ts';

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

function testPrivilegedRoleDetection(): void {
  assertEqual(isAuditPrivilegedRole('PLAYER'), false, 'Expected PLAYER role to be non-privileged.');
  assertEqual(isAuditPrivilegedRole('OPERATOR'), true, 'Expected OPERATOR role to be privileged.');
  assertEqual(isAuditPrivilegedRole('ADMIN'), true, 'Expected ADMIN role to be privileged.');
}

function testAuditScopeForPlayers(): void {
  assertEqual(
    resolveAuditScopeUserId(7, 'PLAYER', undefined),
    7,
    'Expected PLAYER to default to self-scoped audit records.',
  );
  assertEqual(
    resolveAuditScopeUserId(7, 'PLAYER', 7),
    7,
    'Expected PLAYER to access explicitly requested own-user records.',
  );
  assertThrows(
    () => resolveAuditScopeUserId(7, 'PLAYER', 8),
    /Cannot access audit logs for another user/,
    'Expected PLAYER cross-user audit access to be rejected.',
  );
}

function testAuditScopeForPrivilegedRoles(): void {
  assertEqual(
    resolveAuditScopeUserId(3, 'OPERATOR', undefined),
    undefined,
    'Expected OPERATOR to default to unscoped all-user audit records.',
  );
  assertEqual(
    resolveAuditScopeUserId(3, 'ADMIN', 8),
    8,
    'Expected ADMIN to access explicit cross-user audit records.',
  );
}

function runAll(): void {
  testPrivilegedRoleDetection();
  testAuditScopeForPlayers();
  testAuditScopeForPrivilegedRoles();
  assert(true, 'No-op assertion to keep harness consistent.');
  console.info('Auth authorization tests passed (role-based audit scope).');
}

runAll();

