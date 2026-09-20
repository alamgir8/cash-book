/**
 * Real background sync — the piece that lets the 08/14/20 daily slots fire
 * while the app is **closed**, not just while it is open.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every other sync trigger in this app (`sync/scheduler.ts`,
 * `lib/local-first/daily-jobs.ts`) is driven by `AppState` + `setInterval`, so it
 * only runs while the app is in the foreground. That meant "syncs three times a
 * day" was really "syncs three times a day *if you open the app that day*".
 *
 * This registers an OS-scheduled task (iOS `BGProcessingTask` via
 * `BGTaskScheduler`, Android `WorkManager`) that runs `runDailyLocalFirstJobs()`
 * headlessly. The daily slot bookkeeping in `daily-jobs.ts` is unchanged and
 * still decides whether anything actually syncs — this only adds more
 * opportunities to reach those slots.
 *
 * HONEST LIMITATIONS (do not oversell this to users)
 * -------------------------------------------------
 * - The OS owns the schedule. `minimumInterval` is a *minimum*, not a promise.
 *   iOS typically batches these into windows (often overnight) and may skip days
 *   entirely based on battery, charging state and how often the app is used. A
 *   device that is rarely opened can go a long time without a background wake.
 * - It is a **supplement** to the foreground paths, never a replacement. Manual
 *   Sync and the in-app poll remain the reliable triggers.
 * - Low Power Mode / Background App Refresh disabled → no wakes at all. We can
 *   only detect `getStatusAsync() === Restricted` and skip registering.
 *
 * Correctness is unaffected by all of the above: nothing is lost, and any missed
 * slot is still caught by `nextDueSyncHour` the next time the app opens.
 */
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import {
  setAuthToken,
  setTokenRefreshHandler,
  setUnauthorizedHandler,
} from "../api";
import {
  ensureLocalFirstFlags,
  isCloudSyncEnabled,
  isDriveBackupEnabled,
} from "./flags";
import { readStoredSession, writeStoredSession } from "../auth/session-storage";

/** Registered with the OS; persisted across launches by expo-task-manager. */
export const BACKGROUND_SYNC_TASK = "hisab-boi-background-sync";

/**
 * Wall-clock ceiling for one background run.
 *
 * The sync engine's own budget is 90s, but iOS grants a background task far less
 * than that and can suspend the process without warning. Stopping early is safe:
 * partial work is already committed row-by-row, and the remainder is picked up by
 * the next wake or by the in-app scheduler.
 */
export const BACKGROUND_SYNC_BUDGET_MS = 25_000;

/** Advisory only — the OS decides when (and whether) to run. 15 is the floor. */
export const BACKGROUND_MINIMUM_INTERVAL_MINUTES = 30;

/**
 * Rebuild just enough auth state for the sync engine to work without React.
 *
 * The axios instance holds its token in a module variable that only
 * `hooks/use-auth.tsx` populates, so in a fresh headless JS context there is no
 * token at all and every push would 401. Restoring it here is what makes
 * background sync actually able to reach the server.
 *
 * Deliberately conservative: a background 401 must never sign the user out.
 * There is no UI to explain it, and the in-app session is still valid — the
 * foreground code owns that decision.
 */
async function restoreHeadlessSession(): Promise<boolean> {
  const session = await readStoredSession();
  if (!session) return false;

  setAuthToken(session.accessToken);

  setTokenRefreshHandler(async () => {
    const current = await readStoredSession();
    if (!current) return null;
    try {
      const { refreshSession } = await import("../../services/auth");
      const refreshed = await refreshSession(current.refreshToken);
      setAuthToken(refreshed.tokens.accessToken);
      await writeStoredSession(refreshed.tokens, refreshed.admin);
      return refreshed.tokens.accessToken;
    } catch (error) {
      if (__DEV__) console.warn("[bg-sync] token refresh failed", error);
      return null;
    }
  });

  setUnauthorizedHandler(() => {
    // Never sign out from the background — see the note above.
    if (__DEV__) {
      console.warn("[bg-sync] server rejected the session; keeping it for now");
    }
  });

  return true;
}

async function runBackgroundSync(): Promise<BackgroundTask.BackgroundTaskResult> {
  try {
    // The flag cache is empty in a headless context, and the sync guards read it.
    await ensureLocalFirstFlags();

    if (__DEV__) console.log("[bg-sync] headless run started");

    if (!isCloudSyncEnabled() && !isDriveBackupEnabled()) {
      if (__DEV__) console.log("[bg-sync] nothing to do (flags off)");
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const restored = await restoreHeadlessSession();
    if (__DEV__) console.log("[bg-sync] session restored:", restored);
    if (!restored && isCloudSyncEnabled()) {
      // Cloud sync needs auth; Drive backup can still run off its own token.
      // Nothing to do without a session unless Drive is configured.
      if (!isDriveBackupEnabled()) {
        return BackgroundTask.BackgroundTaskResult.Success;
      }
    }

    // Imported lazily so a no-op wake (flags off / nothing due) stays cheap.
    const { runDailyLocalFirstJobs } = await import("./daily-jobs");

    await Promise.race([
      runDailyLocalFirstJobs("background"),
      new Promise((resolve) =>
        setTimeout(resolve, BACKGROUND_SYNC_BUDGET_MS),
      ),
    ]);

    if (__DEV__) console.log("[bg-sync] headless run finished");
    // Success even on timeout / partial drain: the work resumes next wake, and
    // reporting Failed makes the OS deprioritise future runs.
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    if (__DEV__) console.warn("[bg-sync] run failed", error);
    // Failed lets the OS retry sooner — appropriate for a real error.
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
}

// Must be defined in the global scope of the bundle: the OS spins up the JS
// runtime with no views mounted and looks the executor up by name.
if (!TaskManager.isTaskDefined(BACKGROUND_SYNC_TASK)) {
  TaskManager.defineTask(BACKGROUND_SYNC_TASK, runBackgroundSync);
}

export type BackgroundSyncRegistration = {
  registered: boolean;
  /** False when the OS forbids background work (Background App Refresh off, Low Power Mode, simulator). */
  available: boolean;
};

/**
 * Align the OS registration with the current flags.
 *
 * Register when cloud sync or Drive backup is on, unregister when both are off so
 * we stop consuming background wake budget. Safe to call repeatedly (app start,
 * flag changes) and from any state.
 *
 * @param opts.authenticated Pass false when signed out — a background wake would
 *   have no session to push with, so there is no point asking the OS to wake us.
 */
export async function syncBackgroundTaskRegistration(
  opts: { authenticated?: boolean } = {},
): Promise<BackgroundSyncRegistration> {
  try {
    await ensureLocalFirstFlags();
    const authenticated = opts.authenticated !== false;
    const wanted =
      authenticated && (isCloudSyncEnabled() || isDriveBackupEnabled());

    const status = await BackgroundTask.getStatusAsync();
    const available = status === BackgroundTask.BackgroundTaskStatus.Available;

    const registered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_SYNC_TASK,
    );

    if (!wanted || !available) {
      if (registered) {
        await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
      }
      if (__DEV__) {
        // Distinguishing these two matters: "not available" is an OS/user
        // setting (Background App Refresh off, Low Power Mode, simulator) and
        // cannot be fixed in code — the foreground schedulers still work.
        console.log(
          available
            ? `[bg-sync] not registered (cloud sync ${isCloudSyncEnabled() ? "on" : "off"}, ` +
                `drive backup ${isDriveBackupEnabled() ? "on" : "off"}, authenticated ${authenticated})`
            : "[bg-sync] background tasks are RESTRICTED on this device — enable " +
                "Settings → General → Background App Refresh (and disable Low Power Mode). " +
                "Foreground sync is unaffected.",
        );
      }
      return { registered: false, available };
    }

    if (!registered) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: BACKGROUND_MINIMUM_INTERVAL_MINUTES,
      });
      if (__DEV__) {
        console.log(
          `[bg-sync] registered "${BACKGROUND_SYNC_TASK}" with the OS ` +
            `(minimumInterval ${BACKGROUND_MINIMUM_INTERVAL_MINUTES}m — the OS decides the real cadence)`,
        );
      }
    }

    return { registered: true, available };
  } catch (error) {
    if (__DEV__) console.warn("[bg-sync] registration failed", error);
    return { registered: false, available: false };
  }
}
