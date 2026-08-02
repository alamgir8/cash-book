import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Local-first feature flags (Phase 0).
 * Defaults stay OFF in production until cutover so existing API behavior is unchanged.
 */

export const FLAG_KEYS = {
  LOCAL_FIRST_ENABLED: "@lf_local_first_enabled",
  CLOUD_SYNC_ENABLED: "@lf_cloud_sync_enabled",
  DRIVE_BACKUP_ENABLED: "@lf_drive_backup_enabled",
  DUAL_WRITE_ENABLED: "@lf_dual_write_enabled",
  MIGRATION_COMPLETED_AT: "@lf_migration_completed_at",
} as const;

export type LocalFirstFlags = {
  localFirstEnabled: boolean;
  cloudSyncEnabled: boolean;
  driveBackupEnabled: boolean;
  /** Dogfood only: after local write, also POST to API */
  dualWriteEnabled: boolean;
  migrationCompletedAt: string | null;
};

const DEFAULTS: LocalFirstFlags = {
  localFirstEnabled: false,
  cloudSyncEnabled: false,
  driveBackupEnabled: false,
  dualWriteEnabled: false,
  migrationCompletedAt: null,
};

let cache: LocalFirstFlags | null = null;
const listeners = new Set<(flags: LocalFirstFlags) => void>();

async function readBool(key: string, fallback: boolean): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "1" || raw === "true";
  } catch {
    return fallback;
  }
}

let loadPromise: Promise<LocalFirstFlags> | null = null;

export async function loadLocalFirstFlags(): Promise<LocalFirstFlags> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const [
      localFirstEnabled,
      cloudSyncEnabled,
      driveBackupEnabled,
      dualWriteEnabled,
      migrationCompletedAt,
    ] = await Promise.all([
      readBool(FLAG_KEYS.LOCAL_FIRST_ENABLED, DEFAULTS.localFirstEnabled),
      readBool(FLAG_KEYS.CLOUD_SYNC_ENABLED, DEFAULTS.cloudSyncEnabled),
      readBool(FLAG_KEYS.DRIVE_BACKUP_ENABLED, DEFAULTS.driveBackupEnabled),
      readBool(FLAG_KEYS.DUAL_WRITE_ENABLED, DEFAULTS.dualWriteEnabled),
      AsyncStorage.getItem(FLAG_KEYS.MIGRATION_COMPLETED_AT).catch(() => null),
    ]);

    cache = {
      localFirstEnabled,
      cloudSyncEnabled,
      driveBackupEnabled,
      dualWriteEnabled,
      migrationCompletedAt,
    };
    // Wake subscribers that mounted before AsyncStorage finished (avoids Mongo empty reads).
    listeners.forEach((l) => l(cache!));
    return cache;
  })().finally(() => {
    loadPromise = null;
  });

  return loadPromise;
}

/** Await before any DAL read so Metro remounts don't race with defaults. */
export async function ensureLocalFirstFlags(): Promise<LocalFirstFlags> {
  if (cache) return cache;
  return loadLocalFirstFlags();
}

export function getLocalFirstFlagsSync(): LocalFirstFlags {
  return cache ?? { ...DEFAULTS };
}

export function isLocalFirstEnabled(): boolean {
  return getLocalFirstFlagsSync().localFirstEnabled;
}

export function areLocalFirstFlagsReady(): boolean {
  return cache !== null;
}

export function isCloudSyncEnabled(): boolean {
  const f = getLocalFirstFlagsSync();
  return f.localFirstEnabled && f.cloudSyncEnabled;
}

export function isDriveBackupEnabled(): boolean {
  const f = getLocalFirstFlagsSync();
  return f.localFirstEnabled && f.driveBackupEnabled;
}

export function isDualWriteEnabled(): boolean {
  const f = getLocalFirstFlagsSync();
  return f.localFirstEnabled && f.dualWriteEnabled;
}

async function writeBool(key: string, value: boolean) {
  await AsyncStorage.setItem(key, value ? "1" : "0");
}

export async function setLocalFirstFlags(
  patch: Partial<LocalFirstFlags>,
): Promise<LocalFirstFlags> {
  const current = cache ?? (await loadLocalFirstFlags());
  const next: LocalFirstFlags = { ...current, ...patch };

  const ops: Promise<void>[] = [];
  if (patch.localFirstEnabled !== undefined) {
    ops.push(writeBool(FLAG_KEYS.LOCAL_FIRST_ENABLED, next.localFirstEnabled));
  }
  if (patch.cloudSyncEnabled !== undefined) {
    ops.push(writeBool(FLAG_KEYS.CLOUD_SYNC_ENABLED, next.cloudSyncEnabled));
  }
  if (patch.driveBackupEnabled !== undefined) {
    ops.push(writeBool(FLAG_KEYS.DRIVE_BACKUP_ENABLED, next.driveBackupEnabled));
  }
  if (patch.dualWriteEnabled !== undefined) {
    ops.push(writeBool(FLAG_KEYS.DUAL_WRITE_ENABLED, next.dualWriteEnabled));
  }
  if (patch.migrationCompletedAt !== undefined) {
    if (patch.migrationCompletedAt === null) {
      ops.push(
        AsyncStorage.removeItem(FLAG_KEYS.MIGRATION_COMPLETED_AT).then(() => {}),
      );
    } else {
      ops.push(
        AsyncStorage.setItem(
          FLAG_KEYS.MIGRATION_COMPLETED_AT,
          patch.migrationCompletedAt,
        ).then(() => {}),
      );
    }
  }

  await Promise.all(ops);
  cache = next;
  listeners.forEach((l) => l(next));
  return next;
}

export function subscribeLocalFirstFlags(
  listener: (flags: LocalFirstFlags) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Dev/test helper — clears flag cache (does not wipe AsyncStorage). */
export function __resetLocalFirstFlagsCacheForTests() {
  cache = null;
}
