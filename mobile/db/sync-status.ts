/**
 * Per-row sync status for local-first ledger entities.
 * Complements the existing `dirty` flag with retry/error metadata.
 */

export type SyncStatus =
  | "pending_create"
  | "pending_update"
  | "pending_delete"
  | "synced"
  | "failed";

export function syncStatusForMutation(opts: {
  isCreate?: boolean;
  deleted?: boolean;
}): SyncStatus {
  if (opts.deleted) return "pending_delete";
  if (opts.isCreate) return "pending_create";
  return "pending_update";
}

/** SQL fragment used when a local mutation marks a row dirty. */
export function dirtyPendingUpdateSql(
  status: SyncStatus = "pending_update",
): string {
  return `dirty = 1, sync_status = '${status}', retry_count = 0, last_sync_error = NULL`;
}

/** SQL fragment used when sync successfully pushes a row. */
export function cleanSyncedSql(): string {
  return `dirty = 0, sync_status = 'synced', retry_count = 0, last_sync_error = NULL`;
}
