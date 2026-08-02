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

const DRIVE_ACCESS_TOKEN_KEY = "hisabboi_drive_access_token";
const DRIVE_ROOT_FOLDER = "HisabBoi";

export type DriveBackupEntry = {
  date: string;
  fileId: string;
  fileName: string;
  manifest?: BackupManifest;
};

export async function getDriveAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(DRIVE_ACCESS_TOKEN_KEY);
}

export async function setDriveAccessToken(token: string | null): Promise<void> {
  if (!token) {
    await SecureStore.deleteItemAsync(DRIVE_ACCESS_TOKEN_KEY);
    return;
  }
  await SecureStore.setItemAsync(DRIVE_ACCESS_TOKEN_KEY, token);
}

function drivePathParts(userKey: string, exportedAt: string) {
  const day = exportedAt.slice(0, 10);
  const stamp = exportedAt.replace(/[:.]/g, "").replace("T", "T").slice(0, 16);
  return {
    day,
    backupFileName: `hisabboi-backup-${exportedAt.replace(/[:.]/g, "-")}.json`,
    manifestFileName: "manifest.json",
    folderPath: `${DRIVE_ROOT_FOLDER}/backups/${userKey}/${day}`,
    stamp,
  };
}

async function driveFetch(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
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
      parents: parentId ? [parentId] : undefined,
    }),
  });
  const created = await create.json();
  if (!created.id) throw new Error(created.error?.message || "Folder create failed");
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
  if (!json.id) throw new Error(json.error?.message || "Drive upload failed");
  return json.id as string;
}

/**
 * Upload dated backup + manifest to Google Drive.
 * Requires a Drive OAuth access token with drive.file scope stored via setDriveAccessToken.
 */
export async function uploadDatedDriveBackup(userKey: string): Promise<{
  fileId: string;
  manifest: BackupManifest;
  path: string;
}> {
  if (!isDriveBackupEnabled()) {
    throw new Error("Drive backup is disabled");
  }
  const token = await getDriveAccessToken();
  if (!token) {
    throw new Error("Connect Google Drive first");
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

  const db = await getDb();
  await setMeta(db, META_KEYS.LAST_DRIVE_BACKUP_AT, backup.exportedAt);

  return {
    fileId,
    manifest,
    path: `${parts.folderPath}/${parts.backupFileName}`,
  };
}

export async function listDriveBackupDates(
  userKey: string,
): Promise<DriveBackupEntry[]> {
  const token = await getDriveAccessToken();
  if (!token) return [];

  // Simplified: search app-created backup JSON files by name prefix
  const q = `name contains 'hisabboi-backup-' and trashed=false`;
  const res = await driveFetch(
    `/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=50`,
    token,
  );
  const json = await res.json();
  return (json.files ?? []).map((f: any) => ({
    date: (f.name as string).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? f.createdTime,
    fileId: f.id,
    fileName: f.name,
  }));
}

export async function restoreFromDriveFile(fileId: string): Promise<void> {
  const token = await getDriveAccessToken();
  if (!token) throw new Error("Connect Google Drive first");

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error("Failed to download Drive backup");
  const text = await res.text();
  const parsed = JSON.parse(text) as BackupV3;
  await importLocalBackup(parsed, { mode: "replace" });
}

/**
 * OAuth note: wire Expo AuthSession + Google client IDs in EAS secrets,
 * then call setDriveAccessToken(accessToken) after successful auth.
 * Scope required: https://www.googleapis.com/auth/drive.file
 */
export const DRIVE_OAUTH_SCOPE =
  "https://www.googleapis.com/auth/drive.file";
