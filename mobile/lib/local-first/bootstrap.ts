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
