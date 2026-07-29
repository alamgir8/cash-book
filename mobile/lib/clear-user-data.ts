import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearQueryCache } from "./queryClient";

/** Must match keys used in organization / preferences hooks. */
export const ACTIVE_ORG_STORAGE_KEY = "@active_organization";
/** Keep in sync with `hooks/use-preferences.tsx`. */
export const PREFERENCES_STORAGE_KEY = "user_preferences";

/**
 * Clears in-memory React Query cache and device storage that belongs to the
 * signed-in user. Call on sign-out / switch-account so the next login cannot
 * see the previous user's ledger, org, or preference data.
 */
export async function clearUserScopedData() {
  clearQueryCache();
  try {
    await AsyncStorage.multiRemove([
      ACTIVE_ORG_STORAGE_KEY,
      PREFERENCES_STORAGE_KEY,
    ]);
  } catch (error) {
    console.warn("Failed to clear user-scoped storage", error);
  }
}
