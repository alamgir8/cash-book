import { Alert } from "react-native";

/** Warn when free space drops below this (100 MB). */
export const LOW_FREE_SPACE_BYTES = 100 * 1024 * 1024;

export type FreeSpaceCheck = {
  freeBytes: number | null;
  ok: boolean;
  message?: string;
};

/**
 * Uses expo-file-system legacy API (still the supported free-disk probe).
 */
export async function checkFreeDiskSpace(
  minBytes: number = LOW_FREE_SPACE_BYTES,
): Promise<FreeSpaceCheck> {
  try {
    const { getFreeDiskStorageAsync } = await import(
      "expo-file-system/legacy"
    );
    const freeBytes = await getFreeDiskStorageAsync();
    if (typeof freeBytes !== "number" || !Number.isFinite(freeBytes)) {
      return { freeBytes: null, ok: true };
    }
    if (freeBytes < minBytes) {
      const mb = Math.max(1, Math.round(freeBytes / (1024 * 1024)));
      return {
        freeBytes,
        ok: false,
        message: `Only about ${mb} MB free. Free up space before backing up.`,
      };
    }
    return { freeBytes, ok: true };
  } catch {
    // Unknown — do not block backups
    return { freeBytes: null, ok: true };
  }
}

/**
 * Returns true if the user confirms they want to continue (or space is OK).
 */
export async function confirmBackupIfLowSpace(): Promise<boolean> {
  const check = await checkFreeDiskSpace();
  if (check.ok) return true;

  return new Promise((resolve) => {
    Alert.alert(
      "Low storage",
      check.message ||
        "This device is low on free space. Backup may fail or fill the disk.",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Backup anyway",
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
    );
  });
}
