import type { Db } from "./client";
import type { ScopeFilter } from "./types";

export function scopeWhere(
  alias = "",
  scope?: ScopeFilter,
): { sql: string; params: (string | null)[] } {
  const col = alias ? `${alias}.organization_id` : "organization_id";
  // Entire device ledger (personal + every org) — used when org list isn't
  // available but SQLite already has org-scoped rows from migrate/restore.
  if (scope?.allOrganizations) {
    return { sql: "1=1", params: [] };
  }
  const orgId = scope?.organizationId ?? null;
  if (orgId) {
    // Active org + orphan personal rows from pre-org migrate/restore.
    if (scope?.includePersonal) {
      return {
        sql: `(${col} = ? OR ${col} IS NULL OR ${col} = '')`,
        params: [orgId],
      };
    }
    return { sql: `${col} = ?`, params: [orgId] };
  }
  // Personal scope: NULL or legacy empty string (never drop rows on refresh).
  return { sql: `(${col} IS NULL OR ${col} = '')`, params: [] };
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
  /** Bump when repairLocalLedgerSemantics logic changes so devices re-run it. */
  LEDGER_REPAIR_VERSION: "ledger_repair_version",
  LAST_LOCAL_BACKUP_AT: "last_local_backup_at",
  LAST_DRIVE_BACKUP_AT: "last_drive_backup_at",
  LAST_DRIVE_PATH: "last_drive_path",
  LAST_DRIVE_FILE_ID: "last_drive_file_id",
  LAST_DRIVE_CHECKSUM: "last_drive_checksum",
  LAST_DRIVE_ERROR: "last_drive_error",
  OWNER_ADMIN_ID: "owner_admin_id",
  LAST_VACUUM_AT: "last_vacuum_at",
  CLOCK_OFFSET_MS: "clock_offset_ms",
} as const;
