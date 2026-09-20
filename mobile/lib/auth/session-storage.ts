/**
 * SecureStore layout for the signed-in session.
 *
 * Extracted so the React auth hook (`hooks/use-auth.tsx`) and the **headless**
 * background sync task share one source of truth. The background task runs
 * without React context, so it cannot rely on the in-memory token held by the
 * axios instance — it has to read the session back from SecureStore itself.
 *
 * No React / no JSX imports here on purpose: this module is loaded in the
 * background task's headless JS context.
 */
import * as SecureStore from "expo-secure-store";

/** Legacy single-token key, still written for older builds. */
export const LEGACY_TOKEN_KEY = "debit-credit-token";
/** JSON blob: { accessToken, refreshToken, refreshTokenExpiresAt?, sessionId? } */
export const STORAGE_SESSION_KEY = "cash-book-auth-session";
/** JSON blob of the cached admin/user profile. */
export const STORAGE_USER_KEY = "cash-book-auth-user";

export type StoredAuthSession = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt?: string;
  sessionId?: string;
};

/** Session from SecureStore, or null when absent/unparseable/incomplete. */
export async function readStoredSession(): Promise<StoredAuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuthSession;
    if (!parsed?.accessToken || !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeStoredSession(
  session: StoredAuthSession,
  user?: unknown,
): Promise<void> {
  await SecureStore.setItemAsync(
    STORAGE_SESSION_KEY,
    JSON.stringify(session),
  );
  await SecureStore.setItemAsync(LEGACY_TOKEN_KEY, session.accessToken);
  if (user !== undefined) {
    await SecureStore.setItemAsync(STORAGE_USER_KEY, JSON.stringify(user));
  }
}

export async function clearStoredSession(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_SESSION_KEY);
  await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
  await SecureStore.deleteItemAsync(STORAGE_USER_KEY);
}
