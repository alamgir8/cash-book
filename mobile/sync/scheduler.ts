import { AppState, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import {
  isCloudSyncEnabled,
  isLocalFirstEnabled,
  subscribeLocalFirstFlags,
} from "@/lib/local-first/flags";
import { getSyncStatus, runSync } from "./engine";

/** Default: sync at most every 6 hours when app returns to foreground. */
export const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

let started = false;
let appStateSub: { remove: () => void } | null = null;
let flagsUnsub: (() => void) | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function shouldRun(): Promise<boolean> {
  if (!isLocalFirstEnabled() || !isCloudSyncEnabled()) return false;
  const net = await NetInfo.fetch();
  if (net.isConnected === false || net.isInternetReachable === false) {
    return false;
  }
  try {
    const status = await getSyncStatus();
    if (!status.lastSyncAt) return true;
    const last = Date.parse(status.lastSyncAt);
    if (Number.isNaN(last)) return true;
    return Date.now() - last >= SYNC_INTERVAL_MS;
  } catch {
    return false;
  }
}

let lastHardFailAt = 0;

async function maybeSync(reason: string): Promise<void> {
  if (running) return;
  // Avoid spamming a missing /sync deploy every few seconds.
  if (Date.now() - lastHardFailAt < 30 * 60 * 1000 && reason !== "manual") {
    return;
  }
  if (!(await shouldRun())) return;
  running = true;
  try {
    const result = await runSync();
    if (!result.ok) {
      if (/not on this server|resource not found/i.test(result.error || "")) {
        lastHardFailAt = Date.now();
      }
      console.warn(`[sync/scheduler] ${reason} failed:`, result.error);
    }
  } catch (e) {
    console.warn(`[sync/scheduler] ${reason} error`, e);
  } finally {
    running = false;
  }
}

function onAppState(next: AppStateStatus) {
  if (next === "active") {
    void maybeSync("foreground");
  }
}

/**
 * Start foreground + interval sync. Safe to call once from root layout.
 */
export function startSyncScheduler(): () => void {
  if (started) {
    return stopSyncScheduler;
  }
  started = true;

  appStateSub = AppState.addEventListener("change", onAppState);
  timer = setInterval(() => {
    if (AppState.currentState === "active") {
      void maybeSync("interval");
    }
  }, SYNC_INTERVAL_MS);

  flagsUnsub = subscribeLocalFirstFlags((flags) => {
    if (flags.localFirstEnabled && flags.cloudSyncEnabled) {
      void maybeSync("flags-enabled");
    }
  });

  // Kick once shortly after start (lets bootstrap + auth settle).
  setTimeout(() => {
    void maybeSync("startup");
  }, 4000);

  return stopSyncScheduler;
}

export function stopSyncScheduler(): void {
  appStateSub?.remove();
  appStateSub = null;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  flagsUnsub?.();
  flagsUnsub = null;
  started = false;
}
