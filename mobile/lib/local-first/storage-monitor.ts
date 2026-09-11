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
};

export const DEFAULT_STORAGE_THRESHOLDS: StorageThresholds = {
  softBudgetBytes: 200 * 1024 * 1024,
  warningAt: 0.8,
  strongWarningAt: 0.9,
  criticalAt: 0.95,
};

export type StorageLevel = "ok" | "warning" | "strong" | "critical";

export type StorageReport = {
  freeBytes: number | null;
  estimatedDbBytes: number | null;
  softBudgetBytes: number;
  usageRatio: number | null;
  level: StorageLevel;
  message: string | null;
  suggestedActions: string[];
};

async function estimateDbBytes(): Promise<number | null> {
  try {
    const { getDb } = await import("@/db/client");
    const db = await getDb();
    // Approximate: sum page_count * page_size from PRAGMA
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

  const usageRatio =
    estimatedDbBytes != null && thresholds.softBudgetBytes > 0
      ? estimatedDbBytes / thresholds.softBudgetBytes
      : null;

  const level =
    usageRatio == null ? "ok" : levelFromRatio(usageRatio, thresholds);

  const actions: string[] = [];
  if (level !== "ok") {
    actions.push("Sync now");
    actions.push("Export backup");
    actions.push("Clear removable cache");
    actions.push("Clean old synced tombstones where safe");
  }
  if (free.freeBytes != null && free.freeBytes < 100 * 1024 * 1024) {
    actions.push("Free space on this device (Settings → Storage)");
  }

  let message: string | null = null;
  if (level === "critical") {
    message =
      "On-device Cash Book storage is nearly full. Sync, export a backup, then free device space.";
  } else if (level === "strong") {
    message =
      "On-device storage is high. Export a backup and sync pending changes soon.";
  } else if (level === "warning") {
    message = "On-device storage is getting full. Consider syncing and backing up.";
  }

  return {
    freeBytes: free.freeBytes,
    estimatedDbBytes,
    softBudgetBytes: thresholds.softBudgetBytes,
    usageRatio,
    level,
    message,
    suggestedActions: [...new Set(actions)],
  };
}
