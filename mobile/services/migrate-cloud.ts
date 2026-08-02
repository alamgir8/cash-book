import { partiesApi } from "@/services/parties";
import { api } from "@/lib/api";
import { getDb } from "@/db/client";
import { META_KEYS, setMeta } from "@/db/meta";
import { importLocalBackup } from "@/services/local-backup";
import {
  getLocalFirstFlagsSync,
  setLocalFirstFlags,
} from "@/lib/local-first/flags";
import {
  errorCodeFromUnknown,
  trackLfEvent,
} from "@/lib/local-first/telemetry";
import type { BackupData } from "@/services/backup";

/**
 * One-shot cloud → local migration (Phase 5).
 * Uses existing /backup/export (v2) and maps into local SQLite.
 */
export async function migrateCloudToLocal(opts?: {
  force?: boolean;
}): Promise<{ migrated: boolean; summary?: Record<string, number> }> {
  const flags = getLocalFirstFlagsSync();
  if (flags.migrationCompletedAt && !opts?.force) {
    return { migrated: false };
  }

  try {
    const { data } = await api.get<BackupData>("/backup/export");

    try {
      const listed = await partiesApi.list({
        scope: "personal",
        limit: 10000,
        page: 1,
      });
      if (Array.isArray(listed.parties)) {
        (data as any).data.parties = listed.parties;
      }
    } catch {
      // Backup may already include parties from server export
    }

    const summary = await importLocalBackup(data, { mode: "replace" });
    const completedAt = new Date().toISOString();
    const db = await getDb();
    await setMeta(db, META_KEYS.MIGRATION_COMPLETED_AT, completedAt);
    await setLocalFirstFlags({
      localFirstEnabled: true,
      migrationCompletedAt: completedAt,
    });

    void trackLfEvent("migration_success", {
      count: summary.transactionsCount,
    });

    return {
      migrated: true,
      summary: {
        accountsCount: summary.accountsCount,
        categoriesCount: summary.categoriesCount,
        partiesCount: summary.partiesCount,
        transactionsCount: summary.transactionsCount,
        transfersCount: summary.transfersCount,
      },
    };
  } catch (e) {
    void trackLfEvent("migration_fail", { code: errorCodeFromUnknown(e) });
    throw e;
  }
}
