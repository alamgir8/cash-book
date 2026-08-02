import type { Db } from "./client";
import type { ScopeFilter } from "./types";

export function scopeWhere(
  alias = "",
  scope?: ScopeFilter,
): { sql: string; params: (string | null)[] } {
  const col = alias ? `${alias}.organization_id` : "organization_id";
  const orgId = scope?.organizationId ?? null;
  if (orgId) {
    return { sql: `${col} = ?`, params: [orgId] };
  }
  return { sql: `${col} IS NULL`, params: [] };
}

export async function getMeta(db: Db, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM meta WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

export async function setMeta(
  db: Db,
  key: string,
  value: string | null,
): Promise<void> {
  if (value === null) {
    await db.runAsync("DELETE FROM meta WHERE key = ?", key);
    return;
  }
  await db.runAsync(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}

export const META_KEYS = {
  LAST_SYNC_AT: "last_sync_at",
  LAST_SYNC_CURSOR: "last_sync_cursor",
  LAST_SYNC_ERROR: "last_sync_error",
  SYNC_RUN_ID: "sync_run_id",
  SYNC_STAGE: "sync_stage",
  MIGRATION_COMPLETED_AT: "migration_completed_at",
  LAST_LOCAL_BACKUP_AT: "last_local_backup_at",
  LAST_DRIVE_BACKUP_AT: "last_drive_backup_at",
  OWNER_ADMIN_ID: "owner_admin_id",
} as const;
