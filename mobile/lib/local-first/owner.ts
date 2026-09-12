import { Directory, Paths } from "expo-file-system";
import { deleteDatabaseFile, getDb } from "@/db/client";
import { META_KEYS, getMeta, setMeta } from "@/db/meta";

/**
 * Local ledger ownership helpers.
 *
 * SQLite is a single device file (`hisabboi_local.db`). We bind it to the
 * signed-in admin id so logout / switch-account / crash-without-logout cannot
 * leak one user's cash book to another account on the same phone.
 */

/** Remove on-device receipt files under Documents/attachments. */
export async function clearLocalAttachmentFiles(): Promise<void> {
  try {
    const dir = new Directory(Paths.document, "attachments");
    if (dir.exists) {
      dir.delete();
    }
  } catch (error) {
    console.warn("[local-first] failed to clear attachments", error);
  }
}

/**
 * Wipe the local ledger file + attachments.
 * Prefer file delete over table wipe so meta / sync_conflicts cannot leak.
 */
export async function resetLocalLedgerStorage(): Promise<void> {
  try {
    const { resetBootstrapLedgerInFlight } = await import("./bootstrap-ledger");
    resetBootstrapLedgerInFlight();
  } catch {
    /* ignore */
  }
  try {
    const { resetInitialMigrateInFlight } = await import(
      "@/services/migrate-cloud"
    );
    resetInitialMigrateInFlight();
  } catch {
    /* ignore */
  }
  try {
    await deleteDatabaseFile();
  } catch (error) {
    console.warn("[local-first] deleteDatabaseFile failed", error);
  }
  await clearLocalAttachmentFiles();
}

/**
 * Call on logout / switch-account so the next user never sees this ledger.
 * Does NOT clear local-first feature flags (device preference).
 */
export async function resetLocalLedgerForUserChange(): Promise<void> {
  await resetLocalLedgerStorage();
}

/**
 * Bind the open DB to `adminId`, or wipe and rebind if another user owns it.
 * Safe to call on every successful session apply / bootstrap.
 */
export async function ensureLocalLedgerOwner(adminId: string): Promise<{
  wiped: boolean;
  ownerId: string;
}> {
  if (!adminId) {
    return { wiped: false, ownerId: "" };
  }

  const db = await getDb();
  const existing = await getMeta(db, META_KEYS.OWNER_ADMIN_ID);

  if (!existing) {
    await setMeta(db, META_KEYS.OWNER_ADMIN_ID, adminId);
    return { wiped: false, ownerId: adminId };
  }

  if (existing === adminId) {
    return { wiped: false, ownerId: adminId };
  }

  console.warn(
    "[local-first] owner mismatch — wiping local ledger",
    existing,
    "→",
    adminId,
  );
  await resetLocalLedgerStorage();
  const fresh = await getDb();
  await setMeta(fresh, META_KEYS.OWNER_ADMIN_ID, adminId);
  return { wiped: true, ownerId: adminId };
}
