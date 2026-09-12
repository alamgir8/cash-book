import { getDb } from "@/db/client";
import { META_KEYS, setMeta } from "@/db/meta";
import {
  getLocalFirstFlagsSync,
  loadLocalFirstFlags,
  setLocalFirstFlags,
} from "@/lib/local-first/flags";
import { baseURL } from "@/lib/api";

export type BootstrapLedgerResult = {
  /** True when SQLite was empty and we filled it. */
  bootstrapped: boolean;
  skipped?: boolean;
  source?: "local" | "drive" | "cloud" | "none";
  summary?: Record<string, number>;
  error?: string;
};

let inFlight: Promise<BootstrapLedgerResult> | null = null;

export function resetBootstrapLedgerInFlight(): void {
  inFlight = null;
}

async function localLedgerStats() {
  const db = await getDb();
  const tx = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) as n FROM transactions WHERE deleted_at IS NULL`,
  );
  const ac = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) as n FROM accounts WHERE deleted_at IS NULL`,
  );
  return {
    transactions: Number(tx?.n ?? 0),
    accounts: Number(ac?.n ?? 0),
  };
}

async function markBootstrapped(): Promise<string> {
  const completedAt = new Date().toISOString();
  const db = await getDb();
  await setMeta(db, META_KEYS.MIGRATION_COMPLETED_AT, completedAt);
  // Cursor = now so daily sync only pulls changes after this bootstrap.
  await setMeta(db, META_KEYS.LAST_SYNC_CURSOR, completedAt);
  await setMeta(db, META_KEYS.SYNC_SCOPE_VERSION, "2");
  await setMeta(db, META_KEYS.LAST_SYNC_ERROR, null);
  await setLocalFirstFlags({
    localFirstEnabled: true,
    migrationCompletedAt: completedAt,
  });
  return completedAt;
}

function isServerlessApiHost(): boolean {
  return /vercel\.app|netlify\.app/i.test(String(baseURL || ""));
}

/**
 * Product rule:
 * - If SQLite already has a ledger → do nothing (work local; daily dirty sync later).
 * - If SQLite is empty → load full book once (Drive dump preferred, else cloud APIs),
 *   then stop downloading and work local-first until the next daily sync.
 */
export async function bootstrapLedgerIfEmpty(opts?: {
  onProgress?: (message: string) => void;
}): Promise<BootstrapLedgerResult> {
  if (inFlight) return inFlight;

  inFlight = (async (): Promise<BootstrapLedgerResult> => {
    const progress = (msg: string) => {
      try {
        opts?.onProgress?.(msg);
      } catch {
        /* ignore */
      }
    };

    try {
      await loadLocalFirstFlags();
      const flags = getLocalFirstFlagsSync();
      if (!flags.localFirstEnabled) {
        return { bootstrapped: false, skipped: true, source: "none" };
      }

      progress("Checking on-device ledger…");
      const stats = await localLedgerStats();

      // Already populated — stay local; daily sync handles deltas.
      if (stats.accounts > 0 && stats.transactions > 0) {
        if (!flags.migrationCompletedAt) {
          await markBootstrapped();
        }
        return { bootstrapped: false, skipped: true, source: "local" };
      }

      const { pauseSyncForMaintenance, setSyncPaused } = await import(
        "@/sync/engine"
      );
      await pauseSyncForMaintenance(10_000);
      let paused = true;

      try {
        // ── 1) Google Drive full backup (best for large books / Vercel limits)
        progress("Looking for Google Drive backup…");
        try {
          const {
            getValidDriveAccessToken,
            listDriveBackupDates,
            restoreFromDriveFile,
          } = await import("@/services/drive-backup");
          const token = await getValidDriveAccessToken();
          if (token) {
            const entries = await listDriveBackupDates();
            const latest = entries[0];
            if (latest?.fileId) {
              progress(
                `Restoring Drive backup ${latest.fileName || latest.date}…`,
              );
              await restoreFromDriveFile(latest.fileId);
              await markBootstrapped();
              const after = await localLedgerStats();
              if (after.transactions > 0) {
                progress(`Ready — ${after.transactions} transactions on device`);
                return {
                  bootstrapped: true,
                  source: "drive",
                  summary: {
                    transactionsCount: after.transactions,
                    accountsCount: after.accounts,
                  },
                };
              }
            } else {
              progress("No Drive backup found — trying cloud…");
            }
          } else {
            progress("Drive not connected — downloading from cloud…");
          }
        } catch (e) {
          console.warn("[bootstrap-ledger] Drive path failed", e);
          progress("Drive restore failed — downloading from cloud…");
        }

        // ── 2) Cloud → SQLite (lean APIs / backup export on LAN)
        progress(
          isServerlessApiHost()
            ? "Downloading from cloud (paginated)…"
            : "Downloading full cloud export…",
        );
        const { migrateCloudToLocal } = await import(
          "@/services/migrate-cloud"
        );
        const migrated = await migrateCloudToLocal({
          force: true,
          onProgress: progress,
        });
        if (migrated.migrated) {
          const after = await localLedgerStats();
          progress(`Ready — ${after.transactions} transactions on device`);
          return {
            bootstrapped: true,
            source: "cloud",
            summary: migrated.summary,
          };
        }

        const after = await localLedgerStats();
        if (after.transactions > 0 || after.accounts > 0) {
          await markBootstrapped();
          return {
            bootstrapped: true,
            source: "cloud",
            summary: {
              transactionsCount: after.transactions,
              accountsCount: after.accounts,
            },
          };
        }

        return {
          bootstrapped: false,
          source: "none",
          error:
            "Could not load ledger. Connect Drive with a backup, or check API / Wi‑Fi, then try again.",
        };
      } finally {
        if (paused) setSyncPaused(false);
      }
    } catch (e: any) {
      const error =
        e?.response?.data?.message || e?.message || "Bootstrap failed";
      console.warn("[bootstrap-ledger]", error);
      return { bootstrapped: false, source: "none", error: String(error) };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
