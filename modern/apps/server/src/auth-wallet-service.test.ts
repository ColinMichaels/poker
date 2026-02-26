import { AuthWalletService } from './auth-wallet-service.ts';

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

function testLoginSessionAndLogoutFlow(): void {
  const service = new AuthWalletService();

  const login = service.login({ email: 'colin@example.com', password: 'demo' });
  assert(login.session.token.length > 0, 'Expected a generated session token.');
  assertEqual(login.session.user.email, 'colin@example.com', 'Expected login user profile email to match.');

  const resolvedSession = service.getSession(login.session.token);
  assertEqual(resolvedSession.user.id, login.session.user.id, 'Expected session lookup to resolve user id.');

  service.logout(login.session.token);
  assertThrows(
    () => service.getSession(login.session.token),
    /Invalid session token/,
    'Expected session token to be invalid after logout.',
  );
}

function testWalletAdjustmentsAndLedger(): void {
  const service = new AuthWalletService();
  const login = service.login({ email: 'colin@example.com', password: 'demo' });
  const userId = login.session.user.id;

  const walletBefore = service.getWallet(userId);
  const addResult = service.adjustWallet(userId, {
    method: 'add',
    amount: 25,
    reason: 'test-add',
  });

  assertEqual(addResult.wallet.balance, walletBefore.balance + 25, 'Expected add method to increase wallet balance.');
  assertEqual(addResult.entry.reason, 'test-add', 'Expected ledger reason to match request reason.');

  const subResult = service.adjustWallet(userId, {
    method: 'sub',
    amount: 10,
    reason: 'test-sub',
  });

  assertEqual(subResult.wallet.balance, walletBefore.balance + 15, 'Expected sub method to reduce wallet balance.');

  const ledger = service.getWalletLedger(userId, 10);
  assertEqual(ledger.length, 2, 'Expected two wallet ledger entries after add and sub.');
  assertEqual(ledger[0]?.method, 'add', 'Expected first ledger method to be add.');
  assertEqual(ledger[1]?.method, 'sub', 'Expected second ledger method to be sub.');
}

function testInsufficientBalanceAndProfileUpdate(): void {
  const service = new AuthWalletService();
  const login = service.login({ email: 'colin@example.com', password: 'demo' });
  const userId = login.session.user.id;

  const wallet = service.getWallet(userId);
  assertThrows(
    () => service.adjustWallet(userId, { method: 'sub', amount: wallet.balance + 1 }),
    /Insufficient wallet balance/,
    'Expected subtraction larger than balance to fail.',
  );

  const updatedProfile = service.updateUserProfile(userId, {
    firstName: 'Colin-Updated',
    lastName: 'Player-Updated',
  });

  assertEqual(updatedProfile.displayName, 'Colin-Updated Player-Updated', 'Expected display name to reflect updates.');
}

function testRejectsTamperedSessionToken(): void {
  const service = new AuthWalletService();
  const login = service.login({ email: 'colin@example.com', password: 'demo' });
  const tamperedToken = `${login.session.token}x`;

  assertThrows(
    () => service.requireAuth(tamperedToken),
    /Invalid session token/,
    'Expected tampered session token to be rejected.',
  );
}

function testRecordsLoginFailuresInAuditLog(): void {
  const service = new AuthWalletService();

  assertThrows(
    () => service.login({ email: 'missing@example.com', password: 'demo' }),
    /Invalid credentials/,
    'Expected login with unknown email to fail.',
  );

  const audit = service.getAuthAuditLog(20);
  assert(audit.some((entry) => entry.event === 'LOGIN_FAILURE'), 'Expected LOGIN_FAILURE entry in audit log.');
}

function testRevokeOtherSessions(): void {
  const service = new AuthWalletService();
  const sessionA = service.login({ email: 'colin@example.com', password: 'demo' }).session;
  const sessionB = service.login({ email: 'colin@example.com', password: 'demo' }).session;

  const revoked = service.revokeOtherSessions(sessionA.user.id, sessionB.token);
  assertEqual(revoked, 1, 'Expected exactly one other session to be revoked.');

  assertThrows(
    () => service.getSession(sessionA.token),
    /Invalid session token/,
    'Expected revoked session token to be invalid.',
  );

  const activeSession = service.getSession(sessionB.token);
  assertEqual(activeSession.user.id, sessionA.user.id, 'Expected current session to remain valid.');

  const audit = service.getAuthAuditLog(20, sessionA.user.id);
  assert(audit.some((entry) => entry.event === 'SESSION_REVOKED'), 'Expected SESSION_REVOKED entry in audit log.');
}

function testSessionExpiry(): void {
  const service = new AuthWalletService({ sessionTtlMs: 1 });
  const login = service.login({ email: 'colin@example.com', password: 'demo' });

  const waitUntil = Date.now() + 5;
  while (Date.now() < waitUntil) {
    // Busy-wait for deterministic expiry in this no-deps test harness.
  }

  assertThrows(
    () => service.getSession(login.session.token),
    /Session expired/,
    'Expected session to expire after configured ttl.',
  );
}

function testCanDisableDefaultUsers(): void {
  assertThrows(
    () => new AuthWalletService({ allowDefaultUsers: false }),
    /No auth users configured/,
    'Expected service construction to fail when default users are disabled without bootstrap users.',
  );
}

function testBootstrapsUsersFromSeedRecords(): void {
  const service = new AuthWalletService({
    allowDefaultUsers: false,
    users: [
      {
        email: 'alex.smith@example.com',
        password: 'alpha',
      },
      {
        id: 10,
        email: 'sam@example.com',
        password: 'bravo',
        firstName: 'Sam',
        lastName: 'Seeder',
        walletBalance: 650,
        wins: 3,
        gamesPlayed: 7,
      },
    ],
  });

  const alexLogin = service.login({ email: 'alex.smith@example.com', password: 'alpha' });
  const samLogin = service.login({ email: 'sam@example.com', password: 'bravo' });

  assertEqual(alexLogin.session.user.id, 1, 'Expected first bootstrap user without id to get fallback id 1.');
  assertEqual(alexLogin.session.user.displayName, 'Alex Smith', 'Expected default display name to derive from email.');
  assertEqual(samLogin.session.user.id, 10, 'Expected explicit bootstrap user id to be preserved.');

  const alexWallet = service.getWallet(alexLogin.session.user.id);
  const samWallet = service.getWallet(samLogin.session.user.id);
  assertEqual(alexWallet.balance, 500, 'Expected bootstrap wallet default balance for omitted value.');
  assertEqual(samWallet.balance, 650, 'Expected explicit bootstrap wallet balance to be preserved.');

  const snapshot = service.exportState();
  const alexSnapshot = snapshot.users.find((user) => user.id === 1);
  assert(alexSnapshot !== undefined, 'Expected bootstrap snapshot to include fallback-id user.');
  assert(
    alexSnapshot.passwordHash.startsWith('scrypt$'),
    'Expected bootstrap plaintext password to be persisted as scrypt hash.',
  );
}

function testRestoresLegacyPlaintextUserRecords(): void {
  const createdAt = new Date().toISOString();
  const legacyUserRecord = {
    id: 99,
    email: 'legacy@example.com',
    password: 'demo',
    firstName: 'Legacy',
    lastName: 'User',
    walletBalance: 250,
    wins: 0,
    gamesPlayed: 0,
    walletUpdatedAt: createdAt,
    walletLedger: [],
  };

  const service = new AuthWalletService({
    users: [legacyUserRecord],
  });

  const login = service.login({ email: 'legacy@example.com', password: 'demo' });
  const snapshot = service.exportState();

  assertEqual(login.session.user.id, 99, 'Expected login to work for restored legacy user record.');
  assert(
    snapshot.users[0]?.passwordHash.startsWith('scrypt$') === true,
    'Expected legacy plaintext password to be migrated to scrypt hash.',
  );
}

function testStateRoundTripRestore(): void {
  const service = new AuthWalletService();
  const login = service.login({ email: 'colin@example.com', password: 'demo' });
  const userId = login.session.user.id;

  service.adjustWallet(userId, {
    method: 'add',
    amount: 30,
    reason: 'restore-test',
  });

  const restored = new AuthWalletService(service.exportState());
  const restoredSession = restored.getSession(login.session.token);
  const restoredWallet = restored.getWallet(userId);
  const restoredLedger = restored.getWalletLedger(userId, 10);
  const restoredAudit = restored.getAuthAuditLog(20, userId);

  assertEqual(restoredSession.user.id, userId, 'Expected restored session to resolve original user.');
  assertEqual(restoredWallet.balance, 530, 'Expected restored wallet balance to persist.');
  assertEqual(restoredLedger.length, 1, 'Expected restored wallet ledger to persist.');
  assertEqual(restoredLedger[0]?.reason, 'restore-test', 'Expected restored ledger reason to persist.');
  assert(restoredAudit.length > 0, 'Expected auth audit log to persist through restore.');
}

function testRestoreWithoutAuditLogField(): void {
  const service = new AuthWalletService();
  const snapshot = service.exportState();
  delete snapshot.auditLog;

  const restored = new AuthWalletService(snapshot);
  const login = restored.login({ email: 'colin@example.com', password: 'demo' });
  assert(login.session.token.length > 0, 'Expected login to succeed when restoring state without audit log field.');
}

function runAll(): void {
  testLoginSessionAndLogoutFlow();
  testWalletAdjustmentsAndLedger();
  testInsufficientBalanceAndProfileUpdate();
  testRejectsTamperedSessionToken();
  testRecordsLoginFailuresInAuditLog();
  testRevokeOtherSessions();
  testSessionExpiry();
  testCanDisableDefaultUsers();
  testBootstrapsUsersFromSeedRecords();
  testRestoresLegacyPlaintextUserRecords();
  testStateRoundTripRestore();
  testRestoreWithoutAuditLogField();
  console.info('Auth/wallet tests passed (session + wallet + profile flows).');
}

runAll();
