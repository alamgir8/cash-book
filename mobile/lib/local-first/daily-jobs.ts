import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  isCloudSyncEnabled,
  isDriveBackupEnabled,
  isLocalFirstEnabled,
  subscribeLocalFirstFlags,
} from "@/lib/local-first/flags";
import { localDayKey } from "@/lib/local-first/day-key";
import {
  DAILY_SYNC_HOURS,
  nextDueSyncHour,
} from "@/lib/local-first/daily-schedule";

export { localDayKey, DAILY_SYNC_HOURS, nextDueSyncHour };

const SLOTS_KEY = "@lf_daily_sync_slots_v1";
const DRIVE_DAY_KEY = "@lf_daily_drive_ymd";

type SlotState = { ymd: string; done: number[] };

async function readSlotState(): Promise<SlotState> {
  const ymd = localDayKey();
  try {
    const raw = await AsyncStorage.getItem(SLOTS_KEY);
    if (!raw) return { ymd, done: [] };
    const parsed = JSON.parse(raw) as SlotState;
    if (parsed?.ymd !== ymd || !Array.isArray(parsed.done)) {
      return { ymd, done: [] };
    }
    return {
      ymd,
      done: parsed.done.map(Number).filter((n) => Number.isFinite(n)),
    };
  } catch {
    return { ymd, done: [] };
  }
}

async function markSlotAttempted(hour: number): Promise<void> {
  const state = await readSlotState();
  if (!state.done.includes(hour)) state.done.push(hour);
  await AsyncStorage.setItem(
    SLOTS_KEY,
    JSON.stringify({ ymd: localDayKey(), done: state.done }),
  );
}

async function driveDoneToday(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DRIVE_DAY_KEY)) === localDayKey();
  } catch {
    return false;
  }
}

async function markDriveDoneToday(): Promise<void> {
  await AsyncStorage.setItem(DRIVE_DAY_KEY, localDayKey());
}

let started = false;
let appStateSub: { remove: () => void } | null = null;
let flagsUnsub: (() => void) | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Scheduled local-first maintenance while the app is active:
 * 1) Cloud sync at DAILY_SYNC_HOURS (if Cloud sync ON)
 * 2) Drive dated backup once/day (if Drive backups ON)
 *
 * Rules (product):
 * - App works offline by default; backend may be down for days/weeks.
 * - Each slot is attempted once per local day (success OR fail), then we
 *   wait for the next slot or the same slots tomorrow — forever.
 * - Manual banner Sync is independent and never clears/skips this schedule.
 *
 * iOS/Android do not guarantee background midnight wakes — this runs on
 * foreground + a short poll while the app is open.
 */
export async function runDailyLocalFirstJobs(
  reason: string,
): Promise<{ ran: boolean; sync?: boolean; drive?: boolean; slot?: number }> {
  if (running) return { ran: false };
  if (!isLocalFirstEnabled()) return { ran: false };

  running = true;
  let synced = false;
  let drove = false;
  let slot: number | undefined;
  try {
    if (isCloudSyncEnabled()) {
      const state = await readSlotState();
      const due = nextDueSyncHour(new Date(), state.done);
      if (due != null) {
        slot = due;
        try {
          // Goes through the scheduler so we share in-flight with manual Sync
          // (wait, don't skip) without touching daily slot bookkeeping from
          // the manual path.
          const { requestDailySync } = await import("@/sync/scheduler");
          const result = await requestDailySync();
          synced = result.ok;
          if (!result.ok && __DEV__) {
            console.warn(
              `[daily-jobs] sync slot ${due}h (${reason}):`,
              result.error,
            );
          }
        } catch (e) {
          if (__DEV__) console.warn(`[daily-jobs] sync slot ${due}h`, e);
        }
        // Always consume the slot — fail today ≠ skip tomorrow's same hour.
        await markSlotAttempted(due);
      }
    }

    if (isDriveBackupEnabled() && !(await driveDoneToday())) {
      try {
        const { maybeUploadDriveBackup } = await import(
          "@/services/drive-scheduler"
        );
        const result = await maybeUploadDriveBackup("daily");
        drove = result.ok;
        // Record the day either way so we don't loop Drive all day; next try tomorrow.
        await markDriveDoneToday();
        if (!result.ok && result.error !== "skipped" && __DEV__) {
          console.warn(`[daily-jobs] drive ${reason}`, result.error);
        }
      } catch (e) {
        await markDriveDoneToday();
        if (__DEV__) console.warn(`[daily-jobs] drive ${reason}`, e);
      }
    }

    return {
      ran: slot != null || drove,
      sync: synced,
      drive: drove,
      slot,
    };
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
  // Poll while open so we hit 08/14/20 without needing a relaunch at that minute.
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
