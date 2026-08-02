import { getDb } from "@/db/client";
import { META_KEYS, getMeta, setMeta } from "@/db/meta";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Periodic VACUUM + ANALYZE to reclaim WAL/freelist space after heavy
 * restore/migrate churn. Safe to call often — no-ops inside the weekly window.
 */
export async function maybeVacuumLocalDb(force = false): Promise<boolean> {
  const db = await getDb();
  if (!force) {
    const last = await getMeta(db, META_KEYS.LAST_VACUUM_AT);
    if (last) {
      const t = Date.parse(last);
      if (!Number.isNaN(t) && Date.now() - t < WEEK_MS) {
        return false;
      }
    }
  }

  // VACUUM cannot run inside an open write transaction.
  await db.execAsync("VACUUM;");
  try {
    await db.execAsync("ANALYZE;");
  } catch {
    /* ANALYZE is best-effort on some builds */
  }
  await setMeta(db, META_KEYS.LAST_VACUUM_AT, new Date().toISOString());
  return true;
}
