/**
 * Open SQLite + preload DAL chunks so the first Home/Accounts paint
 * does not wait on Metro dynamic imports after enabling local-first.
 */
export async function warmLocalFirstRuntime(): Promise<void> {
  const { getDb } = await import("@/db/client");
  await getDb();
  await Promise.all([
    import("@/data/accounts.local"),
    import("@/data/categories.local"),
    import("@/data/transactions.local"),
    import("@/data/parties.local"),
  ]);
}
