import { getDb } from "@/db/client";

const LEDGER_TABLES = [
  "accounts",
  "categories",
  "parties",
  "transactions",
  "transfers",
] as const;

/** Count rows waiting to push (dirty = 1). */
export async function countPendingDirty(): Promise<number> {
  const db = await getDb();
  let total = 0;
  for (const table of LEDGER_TABLES) {
    const row = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) as c FROM ${table} WHERE dirty = 1`,
    );
    total += Number(row?.c ?? 0);
  }
  return total;
}

export type SyncUiState =
  | "offline"
  | "server_unavailable"
  | "syncing"
  | "pending"
  | "failed"
  | "synced"
  | "hidden";

export async function resolveSyncUiState(opts: {
  localFirst: boolean;
  cloudSync: boolean;
  deviceOnline: boolean;
  backendOk: boolean | null;
  syncing: boolean;
}): Promise<{ state: SyncUiState; pending: number; lastError: string | null }> {
  if (!opts.localFirst) {
    return { state: "hidden", pending: 0, lastError: null };
  }

  let pending = 0;
  let lastError: string | null = null;
  try {
    pending = await countPendingDirty();
    const { getSyncStatus } = await import("./engine");
    const status = await getSyncStatus();
    lastError = status.lastError;
  } catch {
    /* db cold */
  }

  if (!opts.deviceOnline) {
    return { state: "offline", pending, lastError };
  }
  if (opts.backendOk === false) {
    return { state: "server_unavailable", pending, lastError };
  }
  if (opts.syncing) {
    return { state: "syncing", pending, lastError };
  }
  // lastError is cleared on successful ack — if present, sync has not recovered yet.
  if (lastError && opts.cloudSync) {
    return { state: "failed", pending, lastError };
  }
  if (pending > 0 && opts.cloudSync) {
    return { state: "pending", pending, lastError };
  }
  if (opts.cloudSync) {
    return { state: "synced", pending: 0, lastError: null };
  }
  return { state: "hidden", pending, lastError };
}
