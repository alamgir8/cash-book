import { AppState, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import {
  isCloudSyncEnabled,
  isLocalFirstEnabled,
  subscribeLocalFirstFlags,
} from "@/lib/local-first/flags";
import { getSyncStatus, runSync, type SyncResult } from "./engine";

/** Background safety interval (not the primary sync trigger). */
export const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** While dirty rows exist, try more often than the 6h safety tick. */
const PENDING_RETRY_MS = 30 * 60 * 1000;

/** Debounce after local mutations before attempting push. */
const MUTATION_DEBOUNCE_MS = 1500;

/** Exponential backoff after failed sync (capped). */
const BACKOFF_STEPS_MS = [
  5_000,
  15_000,
  30_000,
  60_000,
  5 * 60_000,
  15 * 60_000,
];

let started = false;
let appStateSub: { remove: () => void } | null = null;
let flagsUnsub: (() => void) | null = null;
let netUnsub: (() => void) | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let pendingTimer: ReturnType<typeof setInterval> | null = null;
let mutationTimer: ReturnType<typeof setTimeout> | null = null;
let foregroundTimer: ReturnType<typeof setTimeout> | null = null;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let failStreak = 0;
let lastHardFailAt = 0;
let lastKnownOnline: boolean | null = null;
/** Shared in-flight sync so manual retry waits instead of no-op. */
let inFlight: Promise<SyncResult> | null = null;

type SyncReason =
  | "startup"
  | "foreground"
  | "interval"
  | "pending"
  | "daily"
  | "mutation"
  | "reconnect"
  | "flags-enabled"
  | "manual"
  | "backoff";

function nextBackoffMs(): number {
  const idx = Math.min(failStreak, BACKOFF_STEPS_MS.length - 1);
  return BACKOFF_STEPS_MS[idx];
}

function clearBackoffTimer() {
  if (backoffTimer) {
    clearTimeout(backoffTimer);
    backoffTimer = null;
  }
}

function scheduleBackoffRetry() {
  clearBackoffTimer();
  const delay = nextBackoffMs();
  backoffTimer = setTimeout(() => {
    backoffTimer = null;
    void maybeSync("backoff");
  }, delay);
}

async function networkUsable(): Promise<boolean> {
  const net = await NetInfo.fetch();
  if (net.isConnected === false) return false;
  // null reachability = unknown; allow attempt (backend health will decide)
  if (net.isInternetReachable === false) return false;
  return true;
}

/**
 * Lightweight backend probe — distinct from "device has internet".
 * Uses /health (unauthenticated). Does not hammer: callers gate frequency.
 */
export async function probeBackendAvailable(
  timeoutMs = 4000,
): Promise<boolean> {
  try {
    const { baseURL } = await import("@/lib/api");
    const root = String(baseURL).replace(/\/api\/?$/, "");
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${root}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

function disabledResult(error: string): SyncResult {
  return { ok: false, pushed: 0, pulled: 0, error };
}

async function maybeSync(reason: SyncReason): Promise<SyncResult> {
  // Manual (and any caller) should wait for the current cycle, not silently skip.
  if (inFlight) {
    return inFlight;
  }

  if (!isLocalFirstEnabled() || !isCloudSyncEnabled()) {
    return disabledResult("Cloud sync disabled");
  }

  // Hard fail (missing /sync): quiet for 30m unless manual.
  if (
    reason !== "manual" &&
    Date.now() - lastHardFailAt < 30 * 60 * 1000
  ) {
    return disabledResult("Sync paused after API hard-fail");
  }

  if (!(await networkUsable())) {
    return disabledResult("Device offline");
  }

  // Interval/foreground respect the 6h safety window unless never synced
  // or there is still pending dirty work. "daily" always runs when asked —
  // the daily job owns once-per-slot bookkeeping separately.
  if (reason === "interval" || reason === "foreground") {
    try {
      const status = await getSyncStatus();
      if (status.lastSyncAt) {
        const last = Date.parse(status.lastSyncAt);
        if (!Number.isNaN(last) && Date.now() - last < SYNC_INTERVAL_MS) {
          const { countPendingDirty } = await import("./pending");
          const pending = await countPendingDirty();
          if (pending === 0 && !status.lastError) return disabledResult("Up to date");
        }
      }
    } catch {
      /* proceed */
    }
  }

  // Pending poll: only run when there is work (or a sticky last error).
  if (reason === "pending") {
    try {
      const { countPendingDirty } = await import("./pending");
      const pending = await countPendingDirty();
      const status = await getSyncStatus();
      if (pending === 0 && !status.lastError) {
        return disabledResult("Nothing pending");
      }
    } catch {
      /* proceed */
    }
  }

  inFlight = (async (): Promise<SyncResult> => {
    try {
      const result = await runSync();
      if (!result.ok) {
        const missingApi = /not on this server|resource not found/i.test(
          result.error || "",
        );
        // "already running" inside engine should be rare now that we share inFlight.
        if (result.error === "Sync already running") {
          return result;
        }
        if (missingApi) {
          lastHardFailAt = Date.now();
          failStreak = 0;
        } else {
          failStreak += 1;
          console.warn(`[sync/scheduler] ${reason} failed:`, result.error);
          if (reason !== "manual") scheduleBackoffRetry();
        }
      } else {
        failStreak = 0;
        clearBackoffTimer();
        if (result.pulled > 0 || result.pushed > 0) {
          const { queryClient } = await import("@/lib/queryClient");
          await queryClient.invalidateQueries({ refetchType: "active" });
        }
      }
      return result;
    } catch (e) {
      failStreak += 1;
      console.warn(`[sync/scheduler] ${reason} error`, e);
      if (reason !== "manual") scheduleBackoffRetry();
      return {
        ok: false,
        pushed: 0,
        pulled: 0,
        error: e instanceof Error ? e.message : "Sync failed",
      };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * After a local ledger mutation: save already happened; try sync soon.
 * Debounced so burst creates (e.g. import) become one push.
 */
export function requestSyncSoon(reason: SyncReason = "mutation"): void {
  if (!isLocalFirstEnabled() || !isCloudSyncEnabled()) return;
  if (mutationTimer) clearTimeout(mutationTimer);
  mutationTimer = setTimeout(() => {
    mutationTimer = null;
    void maybeSync(reason);
  }, MUTATION_DEBOUNCE_MS);
}

/**
 * Manual Sync Now (banner / settings). Always attempts when online+cloud on;
 * returns the engine result so UI can show success or the real error.
 *
 * Does NOT touch daily slot bookkeeping — tomorrow's 08/14/20 attempts still run.
 */
export function requestSyncNow(): Promise<SyncResult> {
  failStreak = 0;
  lastHardFailAt = 0;
  clearBackoffTimer();
  return maybeSync("manual");
}

/**
 * Scheduled daily-slot sync. Shares in-flight with manual Sync (waits, never
 * cancels it) but does not reset hard-fail / streak like a user tap does.
 */
export function requestDailySync(): Promise<SyncResult> {
  return maybeSync("daily");
}

function onAppState(next: AppStateStatus) {
  if (foregroundTimer) {
    clearTimeout(foregroundTimer);
    foregroundTimer = null;
  }
  if (next === "active") {
    foregroundTimer = setTimeout(() => {
      foregroundTimer = null;
      void maybeSync("foreground");
    }, 2500);
  }
}

/**
 * Start foreground + interval + reconnect sync. Safe to call once from root.
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

  // Extra pass while there may be dirty rows / sticky errors (several times/day).
  pendingTimer = setInterval(() => {
    if (AppState.currentState === "active") {
      void maybeSync("pending");
    }
  }, PENDING_RETRY_MS);

  flagsUnsub = subscribeLocalFirstFlags((flags) => {
    if (flags.localFirstEnabled && flags.cloudSyncEnabled) {
      void maybeSync("flags-enabled");
    }
  });

  netUnsub = NetInfo.addEventListener((state) => {
    const online =
      state.isConnected === true && state.isInternetReachable !== false;
    if (lastKnownOnline === false && online) {
      failStreak = 0;
      void maybeSync("reconnect");
    }
    lastKnownOnline = online;
  });

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
  if (mutationTimer) {
    clearTimeout(mutationTimer);
    mutationTimer = null;
  }
  clearBackoffTimer();
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (pendingTimer) {
    clearInterval(pendingTimer);
    pendingTimer = null;
  }
  flagsUnsub?.();
  flagsUnsub = null;
  netUnsub?.();
  netUnsub = null;
  started = false;
}
