import { AppState, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import {
  isDriveBackupEnabled,
  isLocalFirstEnabled,
  subscribeLocalFirstFlags,
} from "@/lib/local-first/flags";
import { getValidDriveAccessToken } from "@/services/drive-auth";
import { uploadDatedDriveBackup } from "@/services/drive-backup";
import { getDb } from "@/db/client";
import { META_KEYS, getMeta } from "@/db/meta";

/** At most one automatic Drive upload per 24h. */
export const DRIVE_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

let started = false;
let appStateSub: { remove: () => void } | null = null;
let flagsUnsub: (() => void) | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let userKeyProvider: (() => string) | null = null;

export function setDriveBackupUserKeyProvider(fn: () => string) {
  userKeyProvider = fn;
}

async function shouldRun(): Promise<boolean> {
  if (!isLocalFirstEnabled() || !isDriveBackupEnabled()) return false;
  if (!(await getValidDriveAccessToken())) return false;
  const net = await NetInfo.fetch();
  if (net.isConnected === false || net.isInternetReachable === false) {
    return false;
  }
  try {
    const db = await getDb();
    const last = await getMeta(db, META_KEYS.LAST_DRIVE_BACKUP_AT);
    if (!last) return true;
    const t = Date.parse(last);
    if (Number.isNaN(t)) return true;
    return Date.now() - t >= DRIVE_BACKUP_INTERVAL_MS;
  } catch {
    return false;
  }
}

export async function maybeUploadDriveBackup(
  reason: string,
): Promise<{ ok: boolean; error?: string; path?: string }> {
  if (running) return { ok: false, error: "already running" };
  if (!(await shouldRun()) && reason !== "manual" && reason !== "post-migrate") {
    return { ok: false, error: "skipped" };
  }
  // manual / post-migrate still need flags + token + network
  if (reason === "manual" || reason === "post-migrate") {
    if (!isLocalFirstEnabled() || !isDriveBackupEnabled()) {
      return { ok: false, error: "Drive backup disabled" };
    }
    if (!(await getValidDriveAccessToken())) {
      return { ok: false, error: "not connected" };
    }
  }

  const userKey = userKeyProvider?.() || "user";
  running = true;
  try {
    const result = await uploadDatedDriveBackup(userKey);
    return { ok: true, path: result.path };
  } catch (e: any) {
    console.warn(`[drive/scheduler] ${reason}`, e?.message || e);
    return { ok: false, error: e?.message || "upload failed" };
  } finally {
    running = false;
  }
}

function onAppState(next: AppStateStatus) {
  if (next === "active") {
    void maybeUploadDriveBackup("foreground");
  }
}

export function startDriveBackupScheduler(): () => void {
  if (started) return stopDriveBackupScheduler;
  started = true;

  appStateSub = AppState.addEventListener("change", onAppState);
  timer = setInterval(() => {
    if (AppState.currentState === "active") {
      void maybeUploadDriveBackup("interval");
    }
  }, DRIVE_BACKUP_INTERVAL_MS);

  flagsUnsub = subscribeLocalFirstFlags((flags) => {
    if (flags.localFirstEnabled && flags.driveBackupEnabled) {
      void maybeUploadDriveBackup("flags-enabled");
    }
  });

  setTimeout(() => {
    void maybeUploadDriveBackup("startup");
  }, 12_000);

  return stopDriveBackupScheduler;
}

export function stopDriveBackupScheduler(): void {
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
