/**
 * Configurable local storage thresholds (fraction of a soft budget).
 * Soft budget defaults to 200 MB for the app's Documents-area estimate.
 * We cannot increase phone storage — only warn and suggest actions.
 */

export type StorageThresholds = {
  /** Soft budget in bytes used for % calculations. */
  softBudgetBytes: number;
  warningAt: number;
  strongWarningAt: number;
  criticalAt: number;
  /** Days without a successful sync before urging cleanup. */
  stalledSyncDays: number;
};

export const DEFAULT_STORAGE_THRESHOLDS: StorageThresholds = {
  softBudgetBytes: 200 * 1024 * 1024,
  warningAt: 0.8,
  strongWarningAt: 0.9,
  criticalAt: 0.95,
  stalledSyncDays: 30,
};

export type StorageLevel = "ok" | "warning" | "strong" | "critical";

export type StorageReport = {
  freeBytes: number | null;
  estimatedDbBytes: number | null;
  softBudgetBytes: number;
  usageRatio: number | null;
  level: StorageLevel;
  daysSinceSync: number | null;
  stalledSync: boolean;
  message: string | null;
  suggestedActions: string[];
};

async function estimateDbBytes(): Promise<number | null> {
  try {
    const { getDb } = await import("@/db/client");
    const db = await getDb();
    const page = await db.getFirstAsync<{ page_count: number }>(
      "PRAGMA page_count",
    );
    const size = await db.getFirstAsync<{ page_size: number }>(
      "PRAGMA page_size",
    );
    const pages = Number(page?.page_count ?? 0);
    const pageSize = Number(size?.page_size ?? 0);
    if (!pages || !pageSize) return null;
    return pages * pageSize;
  } catch {
    return null;
  }
}

export function levelFromRatio(
  ratio: number,
  thresholds: StorageThresholds = DEFAULT_STORAGE_THRESHOLDS,
): StorageLevel {
  if (ratio >= thresholds.criticalAt) return "critical";
  if (ratio >= thresholds.strongWarningAt) return "strong";
  if (ratio >= thresholds.warningAt) return "warning";
  return "ok";
}

export async function getLocalStorageReport(
  thresholds: StorageThresholds = DEFAULT_STORAGE_THRESHOLDS,
): Promise<StorageReport> {
  const { checkFreeDiskSpace } = await import("./storage-guard");
  const free = await checkFreeDiskSpace(0);
  const estimatedDbBytes = await estimateDbBytes();

  let daysSinceSync: number | null = null;
  let stalledSync = false;
  try {
    const { getDb } = await import("@/db/client");
    const { getMeta, META_KEYS } = await import("@/db/meta");
    const db = await getDb();
    const last = await getMeta(db, META_KEYS.LAST_SYNC_AT);
    if (last) {
      const ms = Date.now() - Date.parse(last);
      if (!Number.isNaN(ms) && ms > 0) {
        daysSinceSync = Math.floor(ms / (24 * 60 * 60 * 1000));
        stalledSync = daysSinceSync >= thresholds.stalledSyncDays;
      }
    } else {
      // Never synced successfully — treat as stalled after first month of use
      // only when the DB already has meaningful size.
      if (
        estimatedDbBytes != null &&
        estimatedDbBytes > 5 * 1024 * 1024
      ) {
        stalledSync = true;
        daysSinceSync = null;
      }
    }
  } catch {
    /* ignore */
  }

  const usageRatio =
    estimatedDbBytes != null && thresholds.softBudgetBytes > 0
      ? estimatedDbBytes / thresholds.softBudgetBytes
      : null;

  let level: StorageLevel =
    usageRatio == null ? "ok" : levelFromRatio(usageRatio, thresholds);

  // Long-stalled sync with growing local DB escalates the warning.
  if (stalledSync && level === "ok") level = "warning";
  if (
    stalledSync &&
    usageRatio != null &&
    usageRatio >= thresholds.warningAt
  ) {
    level = usageRatio >= thresholds.criticalAt ? "critical" : "strong";
  }

  const actions: string[] = [];
  if (level !== "ok" || stalledSync) {
    actions.push("Sync now (when internet is available)");
    actions.push("Export a backup");
    actions.push("Delete old attachments you no longer need");
    actions.push("Free space on this phone (Settings → Storage)");
  }

  let message: string | null = null;
  if (stalledSync && (level === "strong" || level === "critical")) {
    message =
      daysSinceSync != null
        ? `Cloud sync has not succeeded for about ${daysSinceSync} days and on-device storage is filling up. Free some phone storage and sync when the server is available — this app cannot increase your device storage.`
        : "On-device Cash Book data has grown without a successful cloud sync. Free phone storage and sync when possible.";
  } else if (level === "critical") {
    message =
      "On-device Cash Book storage is nearly full. Sync, export a backup, then free device space.";
  } else if (level === "strong") {
    message =
      "On-device storage is high. Export a backup and sync pending changes soon.";
  } else if (level === "warning") {
    message = stalledSync
      ? "Sync has been unavailable for a while. Your data is safe on this phone — free space if storage runs low."
      : "On-device storage is getting full. Consider syncing and backing up.";
  }

  return {
    freeBytes: free.freeBytes,
    estimatedDbBytes,
    softBudgetBytes: thresholds.softBudgetBytes,
    usageRatio,
    level,
    daysSinceSync,
    stalledSync,
    message,
    suggestedActions: [...new Set(actions)],
  };
}
