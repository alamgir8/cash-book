import { loadLocalFirstFlags } from "./flags";

/**
 * Load feature flags. If local-first is already enabled, warm SQLite so
 * the first screen does not wait on a cold dynamic import.
 */
export async function bootstrapLocalFirst(): Promise<void> {
  try {
    const flags = await loadLocalFirstFlags();
    if (flags.localFirstEnabled) {
      const { warmLocalFirstRuntime } = await import("./warm");
      await warmLocalFirstRuntime().catch((error) => {
        console.warn("[local-first] warm failed", error);
      });
    }
  } catch (error) {
    console.warn("[local-first] bootstrap failed", error);
  }
}

/**
 * After login: if SQLite has no ledger yet, download cloud → local once.
 * Hard-capped so the splash can never spin forever.
 */
export async function bootstrapCloudLedgerIfNeeded(
  onProgress?: (message: string) => void,
): Promise<void> {
  const { ensureInitialCloudMigration } = await import(
    "@/services/migrate-cloud"
  );

  const OVERALL_MS = 45_000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      ensureInitialCloudMigration({ onProgress }).then(async (result) => {
        if (result.migrated) {
          try {
            const { queryClient } = await import("@/lib/queryClient");
            await queryClient.invalidateQueries({ refetchType: "active" });
          } catch {
            /* ignore */
          }
        }
        if (result.error) {
          console.warn("[local-first] initial migrate:", result.error);
        }
      }),
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          onProgress?.(
            "Download is slow — opening app. Use Settings → Migrate or Drive restore.",
          );
          console.warn("[local-first] initial migrate overall deadline");
          resolve();
        }, OVERALL_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
