import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  isCloudSyncEnabled,
  isDriveBackupEnabled,
  isLocalFirstEnabled,
  subscribeLocalFirstFlags,
} from "@/lib/local-first/flags";
import { localDayKey } from "@/lib/local-first/day-key";

export { localDayKey };

const LAST_DAILY_KEY = "@lf_last_daily_job_ymd";
const DAILY_SYNC_ATTEMPTS_KEY = "@lf_daily_sync_attempts_ymd";

/** Cap automatic sync attempts per local day (manual Sync remains unlimited). */
const MAX_DAILY_SYNC_ATTEMPTS = 8;

/** True after local midnight until we've recorded today's successful job. */
export async function isDailyJobDue(): Promise<boolean> {
  try {
    const last = await AsyncStorage.getItem(LAST_DAILY_KEY);
    return last !== localDayKey();
  } catch {
    return true;
  }
}

export async function markDailyJobDone(): Promise<void> {
  await AsyncStorage.setItem(LAST_DAILY_KEY, localDayKey());
  await AsyncStorage.removeItem(DAILY_SYNC_ATTEMPTS_KEY);
}

async function dailySyncAttempts(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_SYNC_ATTEMPTS_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { ymd?: string; n?: number };
    if (parsed.ymd !== localDayKey()) return 0;
    return Number(parsed.n) || 0;
  } catch {
    return 0;
  }
}

async function bumpDailySyncAttempt(): Promise<number> {
  const n = (await dailySyncAttempts()) + 1;
  await AsyncStorage.setItem(
    DAILY_SYNC_ATTEMPTS_KEY,
    JSON.stringify({ ymd: localDayKey(), n }),
  );
  return n;
}

let started = false;
let appStateSub: { remove: () => void } | null = null;
let flagsUnsub: (() => void) | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Once per local day (after midnight), when the app is active:
 * 1) Mongo sync (if Cloud sync ON) — retries several times if it fails
 * 2) Drive dated backup (if Drive backups ON)
 *
 * iOS/Android do not guarantee true background midnight wakes without
 * push/BGTask — this runs on foreground + a 15‑minute poll while active.
 *
 * Sync failure does NOT mark the day done, so pending local data keeps
 * retrying (up to MAX_DAILY_SYNC_ATTEMPTS). Manual banner Sync is separate.
 */
export async function runDailyLocalFirstJobs(
  reason: string,
): Promise<{ ran: boolean; sync?: boolean; drive?: boolean }> {
  if (running) return { ran: false };
  if (!isLocalFirstEnabled()) return { ran: false };
  if (!(await isDailyJobDue())) return { ran: false };

  running = true;
  let synced = false;
  let drove = false;
  try {
    let syncFailed = false;

    if (isCloudSyncEnabled()) {
      const attempts = await dailySyncAttempts();
      if (attempts >= MAX_DAILY_SYNC_ATTEMPTS) {
        console.warn(
          `[daily-jobs] sync ${reason}: hit ${MAX_DAILY_SYNC_ATTEMPTS} attempts — will try again tomorrow`,
        );
        // Cap reached: finish the day (manual Sync still works).
      } else {
        try {
          await bumpDailySyncAttempt();
          const { runSync } = await import("@/sync/engine");
          const result = await runSync();
          synced = result.ok;
          if (!result.ok) {
            console.warn(`[daily-jobs] sync ${reason}`, result.error);
            syncFailed = true;
          } else if (result.pulled > 0 || result.pushed > 0) {
            const { queryClient } = await import("@/lib/queryClient");
            await queryClient.invalidateQueries({ refetchType: "active" });
          }
        } catch (e) {
          console.warn(`[daily-jobs] sync ${reason}`, e);
          syncFailed = true;
        }
      }
    }

    if (isDriveBackupEnabled()) {
      try {
        const { maybeUploadDriveBackup } = await import(
          "@/services/drive-scheduler"
        );
        const result = await maybeUploadDriveBackup("daily");
        drove = result.ok;
        if (!result.ok && result.error !== "skipped") {
          console.warn(`[daily-jobs] drive ${reason}`, result.error);
        }
      } catch (e) {
        console.warn(`[daily-jobs] drive ${reason}`, e);
      }
    }

    // Keep the day open so the 15‑min poll retries while sync is still failing.
    if (syncFailed) {
      return { ran: true, sync: false, drive: drove };
    }

    await markDailyJobDone();

    return { ran: true, sync: synced, drive: drove };
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
  if (next === "active") {
    foregroundTimer = setTimeout(() => {
      foregroundTimer = null;
      void runDailyLocalFirstJobs("foreground");
    }, 3500);
  }
}

export function startDailyLocalFirstJobs(): () => void {
  if (started) return stopDailyLocalFirstJobs;
  started = true;

  appStateSub = AppState.addEventListener("change", onAppState);
  // Poll while app is open so we catch midnight without requiring a relaunch.
  timer = setInterval(() => {
    if (AppState.currentState === "active") {
      void runDailyLocalFirstJobs("poll");
    }
  }, 15 * 60 * 1000);

  flagsUnsub = subscribeLocalFirstFlags(() => {
    void runDailyLocalFirstJobs("flags");
  });

  setTimeout(() => {
    void runDailyLocalFirstJobs("startup");
  }, 8_000);

  return stopDailyLocalFirstJobs;
}

export function stopDailyLocalFirstJobs(): void {
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
