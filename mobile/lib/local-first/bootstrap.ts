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
 * After login: if SQLite is empty, load the full ledger once (Drive → cloud),
 * then work local-first. Daily sync only pushes/pulls deltas afterward.
 *
 * Hard-capped so the splash never spins forever.
 */
export async function bootstrapCloudLedgerIfNeeded(
  onProgress?: (message: string) => void,
): Promise<void> {
  const { bootstrapLedgerIfEmpty } = await import("./bootstrap-ledger");

  const OVERALL_MS = 25_000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      bootstrapLedgerIfEmpty({ onProgress }).then(async (result) => {
        if (result.bootstrapped) {
          try {
            const { queryClient } = await import("@/lib/queryClient");
            await queryClient.invalidateQueries({ refetchType: "active" });
          } catch {
            /* ignore */
          }
        }
        if (result.error) {
          onProgress?.(result.error);
          console.warn("[local-first] ledger bootstrap:", result.error);
        }
      }),
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          onProgress?.(
            "Still downloading — opening app. Use Settings → Migrate or Restore from Drive.",
          );
          console.warn("[local-first] ledger bootstrap overall deadline");
          resolve();
        }, OVERALL_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
