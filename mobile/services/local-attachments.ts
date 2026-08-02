import {
  Paths,
  Directory,
  File,
} from "expo-file-system";
import * as LegacyFS from "expo-file-system/legacy";
import type { Attachment } from "@/services/attachments";
import { getDb } from "@/db/client";
import { nowIso } from "@/lib/local-first/ids";

function attachmentsRootUri(): string {
  const dir = new Directory(Paths.document, "attachments");
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir.uri;
}

function extFromName(name: string, mime?: string): string {
  const fromName = name.includes(".")
    ? name.split(".").pop()?.toLowerCase()
    : "";
  if (fromName && fromName.length <= 5) return fromName;
  if (mime?.includes("png")) return "png";
  if (mime?.includes("webp")) return "webp";
  if (mime?.includes("pdf")) return "pdf";
  return "jpg";
}

/**
 * Copy picked files into app documents (on-device).
 * Images should already be compressed by ImagePicker `quality`.
 * Metadata is stored on the transaction `attachments_json` column.
 */
export async function saveLocalAttachments(
  transactionId: string,
  files: {
    uri: string;
    name?: string;
    type?: string;
    size?: number;
  }[],
): Promise<Attachment[]> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    id: string;
    attachments_json: string | null;
  }>(
    `SELECT id, attachments_json FROM transactions
     WHERE id = ? OR server_id = ? LIMIT 1`,
    transactionId,
    transactionId,
  );
  if (!row) throw new Error("Transaction not found");

  const root = attachmentsRootUri().replace(/\/?$/, "/");
  const txnDir = `${root}${row.id}/`;
  const info = await LegacyFS.getInfoAsync(txnDir);
  if (!info.exists) {
    await LegacyFS.makeDirectoryAsync(txnDir, { intermediates: true });
  }

  const existing: Attachment[] = row.attachments_json
    ? (JSON.parse(row.attachments_json) as Attachment[])
    : [];
  const added: Attachment[] = [];

  for (const file of files) {
    const name = file.name ?? `file_${Date.now()}.jpg`;
    const ext = extFromName(name, file.type);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const destUri = `${txnDir}${fileName}`;
    await LegacyFS.copyAsync({ from: file.uri, to: destUri });

    added.push({
      url: destUri,
      thumbnail_url: destUri,
      file_name: name,
      file_size: file.size,
      mime_type: file.type ?? "image/jpeg",
      storage_key: `local:${row.id}/${fileName}`,
      uploaded_at: nowIso(),
    });
  }

  const next = [...existing, ...added];
  await db.runAsync(
    `UPDATE transactions
     SET attachments_json = ?, updated_at = ?, dirty = 1
     WHERE id = ?`,
    JSON.stringify(next),
    nowIso(),
    row.id,
  );

  return next;
}

export async function deleteLocalAttachment(
  transactionId: string,
  storageKey: string,
): Promise<Attachment[]> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    id: string;
    attachments_json: string | null;
  }>(
    `SELECT id, attachments_json FROM transactions
     WHERE id = ? OR server_id = ? LIMIT 1`,
    transactionId,
    transactionId,
  );
  if (!row) throw new Error("Transaction not found");

  const existing: Attachment[] = row.attachments_json
    ? (JSON.parse(row.attachments_json) as Attachment[])
    : [];
  const target = existing.find((a) => a.storage_key === storageKey);
  const next = existing.filter((a) => a.storage_key !== storageKey);

  if (target?.url?.startsWith("file")) {
    try {
      await LegacyFS.deleteAsync(target.url, { idempotent: true });
    } catch {
      /* ignore */
    }
  } else if (target?.storage_key?.startsWith("local:")) {
    const relative = target.storage_key.replace(/^local:/, "");
    const uri = `${attachmentsRootUri().replace(/\/?$/, "/")}${relative}`;
    try {
      await LegacyFS.deleteAsync(uri, { idempotent: true });
    } catch {
      /* ignore */
    }
  }

  await db.runAsync(
    `UPDATE transactions
     SET attachments_json = ?, updated_at = ?, dirty = 1
     WHERE id = ?`,
    JSON.stringify(next),
    nowIso(),
    row.id,
  );

  return next;
}

// Keep File import used for tree typing consistency with other services
void File;
