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

  assertEqual(restoredSession.user.id, userId, 'Expected restored session to resolve original user.');
  assertEqual(restoredWallet.balance, 530, 'Expected restored wallet balance to persist.');
  assertEqual(restoredLedger.length, 1, 'Expected restored wallet ledger to persist.');
  assertEqual(restoredLedger[0]?.reason, 'restore-test', 'Expected restored ledger reason to persist.');
}

function runAll(): void {
  testLoginSessionAndLogoutFlow();
  testWalletAdjustmentsAndLedger();
  testInsufficientBalanceAndProfileUpdate();
  testStateRoundTripRestore();
  console.info('Auth/wallet tests passed (session + wallet + profile flows).');
}

runAll();
