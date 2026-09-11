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
    const { resetLocalLedgerForUserChange } = await import(
      "@/lib/local-first/owner"
    );
    await resetLocalLedgerForUserChange();
  } catch (error) {
    console.warn("Failed to reset local ledger on user change", error);
  }
}
