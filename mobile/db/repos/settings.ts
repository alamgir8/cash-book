import type { Db } from "../client";
import type { LocalPendingOp, LocalSettingsCache } from "../types";
import { createLocalId, nowIso } from "@/lib/local-first/ids";

// ── Settings cache (profile / preferences) ──────────────────────────────────

export const SETTINGS_KEYS = {
  PROFILE: "profile",
  PREFERENCES: "preferences",
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

export async function getSettingsValue<T>(
  db: Db,
  key: SettingsKey,
): Promise<{ value: T; dirty: boolean } | null> {
  const row = await db.getFirstAsync<LocalSettingsCache>(
    "SELECT * FROM settings_cache WHERE key = ?",
    key,
  );
  if (!row) return null;
  try {
    return { value: JSON.parse(row.value_json) as T, dirty: row.dirty === 1 };
  } catch {
    return null;
  }
}

/** Merge-write so concurrent field edits (e.g. PIN vs currency) don't clobber. */
export async function putSettingsValue(
  db: Db,
  key: SettingsKey,
  patch: Record<string, unknown>,
  opts?: { dirty?: boolean },
): Promise<void> {
  const existing = await getSettingsValue<Record<string, unknown>>(db, key);
  const merged = { ...(existing?.value ?? {}), ...patch };
  const ts = nowIso();
  await db.runAsync(
    `INSERT INTO settings_cache (key, value_json, updated_at, dirty, last_sync_error)
     VALUES (?, ?, ?, ?, NULL)
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = excluded.updated_at,
       dirty = excluded.dirty,
       last_sync_error = NULL`,
    key,
    JSON.stringify(merged),
    ts,
    opts?.dirty === false ? 0 : 1,
  );
}

export async function markSettingsSynced(
  db: Db,
  key: SettingsKey,
): Promise<void> {
  await db.runAsync(
    `UPDATE settings_cache SET dirty = 0, last_sync_error = NULL WHERE key = ?`,
    key,
  );
}

export async function markSettingsSyncError(
  db: Db,
  key: SettingsKey,
  message: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE settings_cache SET last_sync_error = ? WHERE key = ?`,
    message,
    key,
  );
}

export async function listDirtySettingsKeys(db: Db): Promise<SettingsKey[]> {
  const rows = await db.getAllAsync<{ key: string }>(
    "SELECT key FROM settings_cache WHERE dirty = 1",
  );
  return rows
    .map((r) => r.key)
    .filter((k): k is SettingsKey =>
      (Object.values(SETTINGS_KEYS) as string[]).includes(k),
    );
}

// ── Outbox (pending ops) ────────────────────────────────────────────────────

export type PendingOpInput = {
  entity: LocalPendingOp["entity"];
  entity_id?: string | null;
  payload: Record<string, unknown>;
};

/**
 * Enqueue a settings write that the sync entity enum cannot carry.
 * Re-enqueuing the same entity upserts, so rapid edits collapse to one op.
 */
export async function enqueuePendingOp(
  db: Db,
  input: PendingOpInput,
): Promise<string> {
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM pending_ops
     WHERE entity = ? AND COALESCE(entity_id, '') = COALESCE(?, '')
     ORDER BY created_at LIMIT 1`,
    input.entity,
    input.entity_id ?? null,
  );

  if (existing) {
    // Merge payloads so two edits to different fields both survive.
    const row = await db.getFirstAsync<LocalPendingOp>(
      "SELECT * FROM pending_ops WHERE id = ?",
      existing.id,
    );
    let merged: Record<string, unknown> = {};
    try {
      merged = row?.payload_json ? JSON.parse(row.payload_json) : {};
    } catch {
      merged = {};
    }
    const next = { ...merged, ...input.payload };
    await db.runAsync(
      `UPDATE pending_ops SET payload_json = ?, attempts = 0, last_error = NULL
       WHERE id = ?`,
      JSON.stringify(next),
      existing.id,
    );
    return existing.id;
  }

  const id = await createLocalId();
  await db.runAsync(
    `INSERT INTO pending_ops (id, entity, entity_id, payload_json, created_at, attempts, last_error)
     VALUES (?, ?, ?, ?, ?, 0, NULL)`,
    id,
    input.entity,
    input.entity_id ?? null,
    JSON.stringify(input.payload),
    nowIso(),
  );
  return id;
}

export async function listPendingOps(db: Db): Promise<LocalPendingOp[]> {
  return db.getAllAsync<LocalPendingOp>(
    "SELECT * FROM pending_ops ORDER BY created_at ASC",
  );
}

export async function countPendingOps(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM pending_ops",
  );
  return Number(row?.c ?? 0);
}

export async function deletePendingOp(db: Db, id: string): Promise<void> {
  await db.runAsync("DELETE FROM pending_ops WHERE id = ?", id);
}

export async function markPendingOpFailed(
  db: Db,
  id: string,
  message: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE pending_ops SET attempts = attempts + 1, last_error = ? WHERE id = ?`,
    message,
    id,
  );
}
