import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AuthWalletService } from './auth-wallet-service.ts';
import { RuntimeStateStore } from './runtime-state-store.ts';
import { TableService, createDefaultTableState } from './table-service.ts';

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

function testLoadReturnsNullWhenStateFileMissing(): void {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poker-runtime-state-missing-'));

  try {
    const stateFilePath = path.join(tempDir, 'runtime-state.json');
    const store = new RuntimeStateStore(stateFilePath);
    const loaded = store.load();
    assertEqual(loaded, null, 'Expected load() to return null for missing file.');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testSaveAndRestoreRoundTrip(): void {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poker-runtime-state-roundtrip-'));

  try {
    const stateFilePath = path.join(tempDir, 'runtime-state.json');
    const store = new RuntimeStateStore(stateFilePath);

    const tableService = new TableService({
      tableId: 'table-test',
      initialState: createDefaultTableState({ handId: 'boot-hand', seed: 500 }),
    });
    const secondaryTableService = new TableService({
      tableId: 'table-secondary',
      initialState: createDefaultTableState({ handId: 'boot-secondary', seed: 700 }),
    });
    const authWalletService = new AuthWalletService();

    const login = authWalletService.login({ email: 'colin@example.com', password: 'demo' });
    const userId = login.session.user.id;
    authWalletService.adjustWallet(userId, { method: 'add', amount: 40, reason: 'persisted-adjustment' });
    tableService.claimSeat(userId, 2);

    tableService.applyCommand({ type: 'START_HAND', handId: 'hand-1000', seed: 501 });
    tableService.applyCommand({ type: 'POST_BLINDS' });
    tableService.applyCommand({ type: 'DEAL_HOLE' });
    secondaryTableService.applyCommand({ type: 'START_HAND', handId: 'secondary-1000', seed: 701 });

    store.save({
      version: 1,
      updatedAt: new Date().toISOString(),
      table: tableService.exportState(),
      tables: [tableService.exportState(), secondaryTableService.exportState()],
      auth: authWalletService.exportState(),
    });

    const loaded = store.load();
    assert(loaded !== null, 'Expected persisted state to load.');
    assert(loaded.table !== undefined, 'Expected persisted legacy table snapshot to be present.');
    const secondaryTableSnapshot = (loaded.tables ?? []).find((snapshot) => snapshot.tableId === 'table-secondary');
    assert(secondaryTableSnapshot !== undefined, 'Expected persisted table list to include secondary table.');

    const restoredTableService = new TableService({
      tableId: 'table-test',
      restoredState: loaded.table,
    });
    const restoredSecondaryTableService = new TableService({
      tableId: 'table-secondary',
      restoredState: secondaryTableSnapshot,
    });
    const restoredAuthService = new AuthWalletService(loaded.auth);

    const restoredWallet = restoredAuthService.getWallet(userId);
    const restoredSession = restoredAuthService.getSession(login.session.token);
    const restoredAudit = restoredAuthService.getAuthAuditLog(20, userId);
    const restoredTableSnapshot = restoredTableService.getSnapshot();
    const restoredSecondarySnapshot = restoredSecondaryTableService.getSnapshot();
    const restoredSeatClaim = restoredTableService.getSeatClaimForUser(userId);

    assertEqual(restoredWallet.balance, 540, 'Expected restored wallet balance to match persisted value.');
    assertEqual(restoredSession.user.id, userId, 'Expected restored session user id to match.');
    assert(restoredAudit.length > 0, 'Expected restored auth audit log to contain entries.');
    assertEqual(restoredSeatClaim?.seatId, 2, 'Expected restored seat claim to match persisted seat id.');
    assertEqual(
      restoredTableSnapshot.commandSequence,
      3,
      'Expected restored table command sequence to match persisted commands.',
    );
    assertEqual(restoredTableSnapshot.state.handId, 'hand-1000', 'Expected restored hand id to match persisted state.');
    assertEqual(restoredSecondarySnapshot.state.handId, 'secondary-1000', 'Expected restored secondary table hand id to match.');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function runAll(): void {
  testLoadReturnsNullWhenStateFileMissing();
  testSaveAndRestoreRoundTrip();
  console.info('Runtime state store tests passed (load/save/restore).');
}

runAll();
