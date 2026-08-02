/**
 * Open SQLite + preload DAL chunks so the first Home/Accounts paint
 * does not wait on Metro dynamic imports after enabling local-first.
 */
export async function warmLocalFirstRuntime(): Promise<void> {
  const { getDb } = await import("@/db/client");
  const { getMeta, META_KEYS } = await import("@/db/meta");
  const { setClockOffsetMs } = await import("./clock");
  const db = await getDb();

  // Restore last known clock offset so writes stay sane before next sync.
  try {
    const offsetRaw = await getMeta(db, META_KEYS.CLOCK_OFFSET_MS);
    if (offsetRaw != null) {
      const ms = Number(offsetRaw);
      if (Number.isFinite(ms)) setClockOffsetMs(ms);
    }
  } catch {
    /* ignore */
  }

  await Promise.all([
    import("@/data/accounts.local"),
    import("@/data/categories.local"),
    import("@/data/transactions.local"),
    import("@/data/parties.local"),
  ]);

  // Weekly maintenance — never block warm on failure.
  void import("./maintenance")
    .then((m) => m.maybeVacuumLocalDb())
    .catch(() => {});
}
