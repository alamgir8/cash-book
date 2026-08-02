import * as SecureStore from "expo-secure-store";
import { File, Paths } from "expo-file-system";
import {
  exportLocalBackup,
  writeBackupToDocumentDir,
  importLocalBackup,
  type BackupManifest,
  type BackupV3,
} from "@/services/local-backup";
import { getDb } from "@/db/client";
import { META_KEYS, setMeta } from "@/db/meta";
import { isDriveBackupEnabled } from "@/lib/local-first/flags";
import { verifyChecksum } from "@/lib/local-first/checksum";
import {
  clearDriveSession,
  getValidDriveAccessToken,
  persistDriveAccessToken,
  setDriveTokenBundle,
} from "@/services/drive-auth";

const DRIVE_ROOT_FOLDER = "HisabBoi";
/** Keep this many dated backup JSON files on Drive (oldest deleted). */
export const DRIVE_RETENTION_COUNT = 30;

export type DriveBackupEntry = {
  date: string;
  fileId: string;
  fileName: string;
  createdTime?: string;
  manifest?: BackupManifest;
};

/** @deprecated prefer getValidDriveAccessToken — kept for Settings checks */
export async function getDriveAccessToken(): Promise<string | null> {
  return getValidDriveAccessToken();
}

/** Clears Drive session (connect again to upload). */
export async function setDriveAccessToken(token: string | null): Promise<void> {
  if (!token) {
    await clearDriveSession();
    return;
  }
  await persistDriveAccessToken(token);
}

function drivePathParts(userKey: string, exportedAt: string) {
  const day = exportedAt.slice(0, 10);
  return {
    day,
    backupFileName: `hisabboi-backup-${exportedAt.replace(/[:.]/g, "-")}.json`,
    manifestFileName: "manifest.json",
    folderPath: `${DRIVE_ROOT_FOLDER}/backups/${userKey}/${day}`,
  };
}

function driveApiErrorMessage(json: any, fallback: string): string {
  const msg = String(json?.error?.message || json?.error_description || "");
  if (/insufficient.*(auth|scope)/i.test(msg)) {
    return "Google token missing Drive permission — disconnect Drive, add drive.file scope in Google Cloud → Data Access, then Sign in with Google again";
  }
  return msg || fallback;
}

async function driveFetch(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      /* ignore */
    }
    throw new Error(driveApiErrorMessage(json, `Drive API ${res.status}`));
  }
  return res;
}

async function ensureFolder(
  token: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const q = parentId
    ? `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${name}' and 'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const list = await driveFetch(
    `/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name)`,
    token,
  );
  const listed = await list.json();
  if (listed.files?.[0]?.id) return listed.files[0].id;

  const create = await driveFetch(`/files`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : ["root"],
    }),
  });
  const created = await create.json();
  if (!created.id) {
    throw new Error(driveApiErrorMessage(created, "Folder create failed"));
  }
  return created.id;
}

async function uploadJsonFile(
  token: string,
  parentId: string,
  fileName: string,
  content: string,
): Promise<string> {
  const metadata = {
    name: fileName,
    parents: [parentId],
  };
  const boundary = "hisabboi_boundary";
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const json = await res.json();
  if (!json.id) {
    throw new Error(driveApiErrorMessage(json, "Drive upload failed"));
  }
  return json.id as string;
}

async function trashFile(token: string, fileId: string): Promise<void> {
  await driveFetch(`/files/${fileId}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
}

/**
 * Delete oldest hisabboi-backup-*.json beyond retention.
 */
export async function pruneDriveBackups(
  token: string,
  keep = DRIVE_RETENTION_COUNT,
): Promise<number> {
  const q = `name contains 'hisabboi-backup-' and trashed=false`;
  const res = await driveFetch(
    `/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=100`,
    token,
  );
  const json = await res.json();
  const files: { id: string }[] = json.files ?? [];
  let deleted = 0;
  for (let i = keep; i < files.length; i++) {
    await trashFile(token, files[i].id);
    deleted += 1;
  }
  return deleted;
}

/**
 * Upload dated backup + manifest to Google Drive.
 */
export async function uploadDatedDriveBackup(userKey: string): Promise<{
  fileId: string;
  manifest: BackupManifest;
  path: string;
}> {
  if (!isDriveBackupEnabled()) {
    throw new Error("Drive backup is disabled — turn on Google Drive backups");
  }
  const token = await getValidDriveAccessToken();
  if (!token) {
    throw new Error("Connect Google Drive first");
  }

  const { confirmBackupIfLowSpace } = await import(
    "@/lib/local-first/storage-guard"
  );
  const { errorCodeFromUnknown, trackLfEvent } = await import(
    "@/lib/local-first/telemetry"
  );

  try {
    if (!(await confirmBackupIfLowSpace())) {
      throw Object.assign(new Error("Drive backup cancelled — low storage"), {
        code: "low_space_cancelled",
      });
    }

    const backup = await exportLocalBackup();
    const { fileName, manifest } = await writeBackupToDocumentDir(backup);
    const parts = drivePathParts(userKey, backup.exportedAt);

    const rootId = await ensureFolder(token, DRIVE_ROOT_FOLDER);
    const backupsId = await ensureFolder(token, "backups", rootId);
    const userId = await ensureFolder(token, userKey, backupsId);
    const dayId = await ensureFolder(token, parts.day, userId);

    const local = new File(Paths.document, fileName);
    const content = await local.text();
    const fileId = await uploadJsonFile(
      token,
      dayId,
      parts.backupFileName,
      content,
    );
    await uploadJsonFile(
      token,
      dayId,
      parts.manifestFileName,
      JSON.stringify(manifest, null, 2),
    );

    await pruneDriveBackups(token, DRIVE_RETENTION_COUNT);

    const db = await getDb();
    await setMeta(db, META_KEYS.LAST_DRIVE_BACKUP_AT, backup.exportedAt);
    await setMeta(db, "last_drive_file_id", fileId);
    await setMeta(db, "last_drive_checksum", backup.checksum);

    void trackLfEvent("drive_backup_success", {
      count: backup.summary.transactionsCount,
    });

    return {
      fileId,
      manifest,
      path: `${parts.folderPath}/${parts.backupFileName}`,
    };
  } catch (e: any) {
    void trackLfEvent("drive_backup_fail", {
      code: e?.code || errorCodeFromUnknown(e),
    });
    throw e;
  }
}

export async function listDriveBackupDates(
  _userKey?: string,
): Promise<DriveBackupEntry[]> {
  const token = await getValidDriveAccessToken();
  if (!token) return [];

  const q = `name contains 'hisabboi-backup-' and trashed=false`;
  const res = await driveFetch(
    `/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=50`,
    token,
  );
  const json = await res.json();
  if (json.error) {
    throw new Error(json.error.message || "Failed to list Drive backups");
  }
  return (json.files ?? []).map((f: any) => ({
    date:
      (f.name as string).match(/\d{4}-\d{2}-\d{2}/)?.[0] ??
      String(f.createdTime || "").slice(0, 10),
    fileId: f.id,
    fileName: f.name,
    createdTime: f.createdTime,
  }));
}

export async function restoreFromDriveFile(fileId: string): Promise<void> {
  const { errorCodeFromUnknown, trackLfEvent } = await import(
    "@/lib/local-first/telemetry"
  );
  try {
    const token = await getValidDriveAccessToken();
    if (!token) throw new Error("Connect Google Drive first");

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error("Failed to download Drive backup");
    const text = await res.text();
    let parsed: BackupV3;
    try {
      parsed = JSON.parse(text) as BackupV3;
    } catch {
      throw new Error("Downloaded file is not valid JSON");
    }

    if (parsed.checksum) {
      const ok = await verifyChecksum(parsed.data, parsed.checksum);
      if (!ok) {
        throw new Error("Backup checksum mismatch — file may be tampered");
      }
    }

    await importLocalBackup(parsed, { mode: "replace" });
    void trackLfEvent("drive_restore_success");
  } catch (e) {
    void trackLfEvent("drive_restore_fail", { code: errorCodeFromUnknown(e) });
    throw e;
  }
}

export { DRIVE_OAUTH_SCOPE } from "@/services/drive-auth";

// silence unused if tree-shaken
void SecureStore;
void setDriveTokenBundle;
