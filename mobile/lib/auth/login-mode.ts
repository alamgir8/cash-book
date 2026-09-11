import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Device login policy.
 * - single: stay signed in across app launches (default — required for offline).
 * - every_time: require password/PIN/biometric when opening the app IF online.
 *   When offline or backend is down, access is still allowed (no lockout).
 */

export const LOGIN_MODE_KEY = "@auth_login_mode";

export type LoginMode = "single" | "every_time";

const DEFAULT_MODE: LoginMode = "single";

let cache: LoginMode | null = null;
const listeners = new Set<(mode: LoginMode) => void>();

export async function loadLoginMode(): Promise<LoginMode> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(LOGIN_MODE_KEY);
    cache = raw === "every_time" ? "every_time" : DEFAULT_MODE;
  } catch {
    cache = DEFAULT_MODE;
  }
  return cache;
}

export function getLoginModeSync(): LoginMode {
  return cache ?? DEFAULT_MODE;
}

export async function setLoginMode(mode: LoginMode): Promise<LoginMode> {
  cache = mode;
  await AsyncStorage.setItem(LOGIN_MODE_KEY, mode);
  listeners.forEach((l) => l(mode));
  return mode;
}

export function subscribeLoginMode(
  listener: (mode: LoginMode) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** In-memory unlock for the current process (every_time mode). */
let unlockedThisLaunch = false;

export function isSessionUnlocked(): boolean {
  return unlockedThisLaunch;
}

export function markSessionUnlocked(): void {
  unlockedThisLaunch = true;
}

export function resetSessionUnlock(): void {
  unlockedThisLaunch = false;
}

export function __resetLoginModeCacheForTests() {
  cache = null;
  unlockedThisLaunch = false;
}
