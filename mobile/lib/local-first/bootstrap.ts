import { loadLocalFirstFlags } from "./flags";

/**
 * Load feature flags only. Does not open SQLite on launch —
 * DB opens lazily via getDb() when local-first features are used.
 * expo-sqlite is included in Expo Go (SDK 57).
 */
export async function bootstrapLocalFirst(): Promise<void> {
  try {
    await loadLocalFirstFlags();
  } catch (error) {
    console.warn("[local-first] bootstrap failed", error);
  }
}
