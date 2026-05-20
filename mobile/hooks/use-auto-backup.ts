/**
 * Auto-backup hook
 *
 * Lightweight: only manages persistence (AsyncStorage) and the auto-trigger.
 * ALL visual state (progress, status, stats) lives in the component that calls
 * performBackup — this avoids any cross-boundary state-sync issues.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Paths } from "expo-file-system";
import { fetchBackupData } from "@/services/backup";

const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_LOCAL_BACKUPS = 5;

const tsKey = (uid: string) => `auto_backup_last_ts_${uid}`;
const enabledKey = (uid: string) => `auto_backup_enabled_${uid}`;

export interface BackupStats {
  accounts: number;
  categories: number;
  transactions: number;
  transfers: number;
}

/** Write backup data to the document directory and persist timestamp */
export async function writeBackupFile(
  userId: string,
  onProgress?: (step: string, pct: number) => void,
): Promise<BackupStats> {
  onProgress?.("Connecting to server…", 5);
  await new Promise((r) => setTimeout(r, 30)); // let render flush

  onProgress?.("Fetching your account data…", 15);
  await new Promise((r) => setTimeout(r, 30));

  const backupData = await fetchBackupData();

  const stats: BackupStats = {
    accounts: backupData.data.accounts?.length ?? 0,
    categories: backupData.data.categories?.length ?? 0,
    transactions: backupData.data.transactions?.length ?? 0,
    transfers: backupData.data.transfers?.length ?? 0,
  };

  const txCount = stats.transactions;
  onProgress?.(
    `Processing ${txCount} transaction${txCount !== 1 ? "s" : ""}…`,
    60,
  );
  await new Promise((r) => setTimeout(r, 30));

  onProgress?.("Saving backup to device…", 78);
  await new Promise((r) => setTimeout(r, 30));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `auto-backup-${timestamp}.json`;
  const file = new File(Paths.document, filename);
  file.write(JSON.stringify(backupData)); // synchronous write

  onProgress?.("Finishing up…", 92);
  await new Promise((r) => setTimeout(r, 30));

  await AsyncStorage.setItem(tsKey(userId), String(Date.now()));

  // Prune old backups
  try {
    const dir = Paths.document;
    const entries = dir.list() as { name: string }[];
    const autoFiles = entries
      .filter(
        (e) => e.name.startsWith("auto-backup-") && e.name.endsWith(".json"),
      )
      .sort((a, b) => b.name.localeCompare(a.name));
    for (let i = MAX_LOCAL_BACKUPS; i < autoFiles.length; i++) {
      new File(dir, autoFiles[i].name).delete();
    }
  } catch {
    /* prune failures are non-fatal */
  }

  onProgress?.("Done", 100);
  return stats;
}

export function useAutoBackup(userId: string | undefined) {
  const [lastBackupAt, setLastBackupAt] = useState<Date | null>(null);
  const [enabled, setEnabledState] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setEnabled = useCallback(
    async (val: boolean) => {
      setEnabledState(val);
      if (userId)
        await AsyncStorage.setItem(enabledKey(userId), val ? "1" : "0");
    },
    [userId],
  );

  const refreshLastBackupAt = useCallback(async () => {
    if (!userId) return;
    const raw = await AsyncStorage.getItem(tsKey(userId));
    if (raw) setLastBackupAt(new Date(parseInt(raw, 10)));
  }, [userId]);

  // Silent auto-backup (no progress reporting, errors are swallowed)
  const runSilent = useCallback(async () => {
    if (!userId) return;
    try {
      await writeBackupFile(userId);
      const raw = await AsyncStorage.getItem(tsKey(userId));
      if (raw) setLastBackupAt(new Date(parseInt(raw, 10)));
    } catch (e) {
      console.warn("[AutoBackup] silent run failed:", e);
    }
  }, [userId]);

  const checkAndRunIfDue = useCallback(
    async (isEnabled: boolean) => {
      if (!userId || !isEnabled) return;
      const raw = await AsyncStorage.getItem(tsKey(userId));
      const lastTs = raw ? parseInt(raw, 10) : 0;
      if (Date.now() - lastTs >= AUTO_BACKUP_INTERVAL_MS) {
        await runSilent();
      }
    },
    [userId, runSilent],
  );

  useEffect(() => {
    if (!userId) return;

    const init = async () => {
      try {
        const [rawEnabled, rawTs] = await Promise.all([
          AsyncStorage.getItem(enabledKey(userId)),
          AsyncStorage.getItem(tsKey(userId)),
        ]);
        if (rawEnabled !== null) setEnabledState(rawEnabled !== "0");
        if (rawTs) setLastBackupAt(new Date(parseInt(rawTs, 10)));
        await checkAndRunIfDue(rawEnabled !== "0");
      } catch (e) {
        console.warn("[AutoBackup] init failed:", e);
      }
    };

    void init();

    intervalRef.current = setInterval(
      () =>
        AsyncStorage.getItem(enabledKey(userId))
          .then((raw) => checkAndRunIfDue(raw !== "0"))
          .catch(() => {}),
      60 * 60 * 1000,
    );

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId, checkAndRunIfDue]);

  return { enabled, setEnabled, lastBackupAt, refreshLastBackupAt };
}
