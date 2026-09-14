import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearQueryCache } from "./queryClient";

/** Must match keys used in organization / preferences hooks. */
export const ACTIVE_ORG_STORAGE_KEY = "@active_organization";
/** Keep in sync with `hooks/use-preferences.tsx`. */
export const PREFERENCES_STORAGE_KEY = "user_preferences";

export type ClearUserScopedOptions = {
  /**
   * When true (explicit Sign out / Switch account), wipe the local SQLite
   * ledger so the next account cannot see this user's cash book.
   * When false (token expiry while staying on-device), keep the ledger.
   */
  wipeLedger?: boolean;
};

/**
 * Clears in-memory React Query cache and org/prefs storage.
 * Ledger wipe is opt-in — never wipe on soft/session expiry.
 * Wipe is hard-capped so logout cannot hang on SQLite close/delete.
 */
export async function clearUserScopedData(
  options: ClearUserScopedOptions = {},
) {
  const { wipeLedger = false } = options;
  clearQueryCache();
  try {
    await AsyncStorage.multiRemove([
      ACTIVE_ORG_STORAGE_KEY,
      PREFERENCES_STORAGE_KEY,
    ]);
  } catch (error) {
    console.warn("Failed to clear user-scoped storage", error);
  }

  if (!wipeLedger) return;

  try {
    // Stop background sync so closeDb is not blocked by an in-flight cycle.
    try {
      const { stopSyncScheduler } = await import("@/sync/scheduler");
      stopSyncScheduler();
    } catch {
      /* ignore */
    }
    try {
      const { setSyncPaused } = await import("@/sync/engine");
      setSyncPaused(true);
    } catch {
      /* ignore */
    }

    const { resetLocalLedgerForUserChange } = await import(
      "@/lib/local-first/owner"
    );
    await Promise.race([
      resetLocalLedgerForUserChange(),
      new Promise<void>((resolve) =>
        setTimeout(() => {
          console.warn(
            "[clear-user-data] ledger wipe deadline — continuing logout",
          );
          resolve();
        }, 8_000),
      ),
    ]);
  } catch (error) {
    console.warn("Failed to reset local ledger on user change", error);
  } finally {
    try {
      const { setSyncPaused } = await import("@/sync/engine");
      setSyncPaused(false);
    } catch {
      /* ignore */
    }
  }
}
