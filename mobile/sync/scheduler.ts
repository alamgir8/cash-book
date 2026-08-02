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
      const missingApi = /not on this server|resource not found/i.test(
        result.error || "",
      );
      if (missingApi) {
        lastHardFailAt = Date.now();
        // Expected on Vercel until /sync is deployed — one quiet skip, no warn spam.
      } else {
        console.warn(`[sync/scheduler] ${reason} failed:`, result.error);
      }
    } else if (result.pulled > 0 || result.pushed > 0) {
      // Multi-device: refresh UI from SQLite after sync applied remote rows.
      const { queryClient } = await import("@/lib/queryClient");
      await queryClient.invalidateQueries({ refetchType: "active" });
    }
  } catch (e) {
    console.warn(`[sync/scheduler] ${reason} error`, e);
  } finally {
    running = false;
  }
}

let foregroundTimer: ReturnType<typeof setTimeout> | null = null;

function onAppState(next: AppStateStatus) {
  if (foregroundTimer) {
    clearTimeout(foregroundTimer);
    foregroundTimer = null;
  }
  // Defer so open modals / keyboard recovery aren't fighting SQLite + network.
  if (next === "active") {
    foregroundTimer = setTimeout(() => {
      foregroundTimer = null;
      void maybeSync("foreground");
    }, 2500);
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
  if (foregroundTimer) {
    clearTimeout(foregroundTimer);
    foregroundTimer = null;
  }
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  flagsUnsub?.();
  flagsUnsub = null;
  started = false;
}
