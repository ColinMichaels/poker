import fs from 'node:fs';
import path from 'node:path';
import type { AuthWalletStateSnapshot } from './auth-wallet-service.ts';
import type { TableServiceStateSnapshot } from './table-service.ts';

export interface RuntimeStateSnapshot {
  version: 1;
  updatedAt: string;
  table?: TableServiceStateSnapshot;
  tables?: TableServiceStateSnapshot[];
  auth: AuthWalletStateSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertSnapshotShape(value: unknown): asserts value is RuntimeStateSnapshot {
  if (!isRecord(value)) {
    throw new Error('Runtime state payload must be an object.');
  }

  if (value.version !== 1) {
    throw new Error('Runtime state payload has unsupported version.');
  }

  if (typeof value.updatedAt !== 'string' || value.updatedAt.length === 0) {
    throw new Error('Runtime state payload is missing updatedAt.');
  }

  const hasLegacyTable = isRecord(value.table) && typeof value.table.tableId === 'string';
  if (
    value.tables !== undefined
    && (!Array.isArray(value.tables)
      || !value.tables.every((tableSnapshot) => isRecord(tableSnapshot) && typeof tableSnapshot.tableId === 'string'))
  ) {
    throw new Error('Runtime state payload tables must be an array of table snapshots when present.');
  }

  const hasTableList = Array.isArray(value.tables) && value.tables.length > 0;
  if (!hasLegacyTable && !hasTableList) {
    throw new Error('Runtime state payload is missing table snapshot(s).');
  }

  if (!isRecord(value.auth) || !Array.isArray(value.auth.users) || !Array.isArray(value.auth.sessions)) {
    throw new Error('Runtime state payload is missing auth snapshot.');
  }

  if (value.auth.auditLog !== undefined && !Array.isArray(value.auth.auditLog)) {
    throw new Error('Runtime state payload auth.auditLog must be an array when present.');
  }
}

export class RuntimeStateStore {
  private readonly filePath: string;

  public constructor(filePath: string) {
    if (filePath.trim().length === 0) {
      throw new Error('Runtime state file path cannot be empty.');
    }

    this.filePath = filePath;
  }

  public load(): RuntimeStateSnapshot | null {
    if (!fs.existsSync(this.filePath)) {
      return null;
    }

    const raw = fs.readFileSync(this.filePath, 'utf8').trim();
    if (raw.length === 0) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse runtime state JSON: ${message}`);
    }

    assertSnapshotShape(parsed);
    return parsed;
  }

  public save(snapshot: RuntimeStateSnapshot): void {
    const payload = `${JSON.stringify(snapshot, null, 2)}\n`;
    const dirPath = path.dirname(this.filePath);
    const tempPath = `${this.filePath}.tmp`;

    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(tempPath, payload, 'utf8');
    fs.renameSync(tempPath, this.filePath);
  }

  public getFilePath(): string {
    return this.filePath;
  }
}
