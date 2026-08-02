/**
 * SQLite client aligned with Expo SDK 57 docs:
 * https://docs.expo.dev/versions/latest/sdk/sqlite/
 *
 * - openDatabaseAsync
 * - PRAGMA journal_mode = WAL
 * - PRAGMA foreign_keys = ON
 * - Migrations via PRAGMA user_version + execAsync
 * - withExclusiveTransactionAsync for atomic multi-writes
 *
 * Encryption: `useSQLCipher` stays false for Expo Go. Production/dev builds
 * should move to encrypted storage (SQLCipher / OS data-protection) before
 * public cutover — see docs/LOCAL_FIRST_PRODUCTION_PLAN.md Phase 8.
 */
export const USE_SQLCIPHER = false;
import * as SQLite from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import { DB_NAME, LOCAL_SCHEMA_VERSION } from "./types";
import { MIGRATIONS } from "./migrations";

export type Db = SQLiteDatabase;

let dbPromise: Promise<Db> | null = null;

/**
 * Docs pattern: migrate with PRAGMA user_version.
 * @see https://docs.expo.dev/versions/latest/sdk/sqlite/#usesqlitecontext-hook
 */
export async function migrateDbIfNeeded(db: Db): Promise<number> {
  await db.execAsync(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
`);

  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  let current = row?.user_version ?? 0;

  if (current >= LOCAL_SCHEMA_VERSION) {
    return current;
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    // execAsync runs multiple statements in one string (docs-supported).
    await db.execAsync(migration.sql);
    current = migration.version;
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  }

  return current;
}

/**
 * Opens (and migrates) the app database. Safe to call repeatedly.
 */
export async function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await migrateDbIfNeeded(db);
      return db;
    })().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    await db.closeAsync();
  } finally {
    dbPromise = null;
  }
}

export async function wipeLedgerData(
  db: Db,
  organizationId: string | null = null,
): Promise<void> {
  const orgClause =
    organizationId === null
      ? "(organization_id IS NULL OR organization_id = '')"
      : "organization_id = ?";
  const params = organizationId === null ? [] : [organizationId];

  await db.runAsync(`DELETE FROM transfers WHERE ${orgClause}`, ...params);
  await db.runAsync(`DELETE FROM transactions WHERE ${orgClause}`, ...params);
  await db.runAsync(`DELETE FROM parties WHERE ${orgClause}`, ...params);
  await db.runAsync(`DELETE FROM categories WHERE ${orgClause}`, ...params);
  await db.runAsync(`DELETE FROM accounts WHERE ${orgClause}`, ...params);
}

/** Full wipe of all ledger tables (personal + every organization). */
export async function wipeAllLedgerData(db: Db): Promise<void> {
  await db.runAsync(`DELETE FROM transfers`);
  await db.runAsync(`DELETE FROM transactions`);
  await db.runAsync(`DELETE FROM parties`);
  await db.runAsync(`DELETE FROM categories`);
  await db.runAsync(`DELETE FROM accounts`);
}

export async function deleteDatabaseFile(): Promise<void> {
  await closeDb();
  await SQLite.deleteDatabaseAsync(DB_NAME);
}

/**
 * Prefer exclusive transactions for multi-statement writes (docs recommendation).
 * Falls back to withTransactionAsync on web where exclusive is unsupported.
 */
export async function withDbTransaction(
  db: Db,
  task: (txn: Db) => Promise<void>,
): Promise<void> {
  if (typeof db.withExclusiveTransactionAsync === "function") {
    try {
      await db.withExclusiveTransactionAsync(async (txn) => {
        await task(txn as unknown as Db);
      });
      return;
    } catch (e: any) {
      // Web / older runtimes may not support exclusive txns
      if (
        typeof e?.message === "string" &&
        e.message.toLowerCase().includes("not supported")
      ) {
        // fall through
      } else {
        throw e;
      }
    }
  }
  await db.withTransactionAsync(async () => {
    await task(db);
  });
}
