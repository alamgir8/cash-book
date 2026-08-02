import type { Db } from "../client";
import { scopeWhere } from "../meta";
import type { LocalCategory, ScopeFilter } from "../types";
import { createClientRequestId, createLocalId, nowIso } from "@/lib/local-first/ids";

export type CategoryInput = {
  type: string;
  flow: string;
  name: string;
  description?: string | null;
  color?: string | null;
  organization_id?: string | null;
  device_id: string;
  server_id?: string | null;
  id?: string;
  dirty?: number;
};

export async function listCategories(
  db: Db,
  scope?: ScopeFilter,
  opts?: { includeArchived?: boolean; includeDeleted?: boolean },
): Promise<LocalCategory[]> {
  const { sql, params } = scopeWhere("", scope);
  const archived = opts?.includeArchived ? "" : "AND archived = 0";
  const deleted = opts?.includeDeleted ? "" : "AND deleted_at IS NULL";
  return db.getAllAsync<LocalCategory>(
    `SELECT * FROM categories WHERE ${sql} ${archived} ${deleted} ORDER BY name COLLATE NOCASE ASC`,
    ...params,
  );
}

export async function getCategoryById(
  db: Db,
  id: string,
): Promise<LocalCategory | null> {
  return (
    (await db.getFirstAsync<LocalCategory>(
      "SELECT * FROM categories WHERE id = ?",
      id,
    )) ?? null
  );
}

export async function createCategory(
  db: Db,
  input: CategoryInput,
): Promise<LocalCategory> {
  const id = input.id ?? (await createLocalId());
  const ts = nowIso();
  await db.runAsync(
    `INSERT INTO categories (
      id, server_id, organization_id, type, flow, name, description, color,
      archived, archived_at, created_at, updated_at, deleted_at,
      dirty, sync_version, client_request_id, device_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, NULL, ?, 0, ?, ?)`,
    id,
    input.server_id ?? null,
    input.organization_id ?? null,
    input.type,
    input.flow,
    input.name.trim(),
    input.description ?? null,
    input.color ?? null,
    ts,
    ts,
    input.dirty ?? 1,
    createClientRequestId(),
    input.device_id,
  );
  const row = await getCategoryById(db, id);
  if (!row) throw new Error("Failed to create category");
  return row;
}

export async function updateCategory(
  db: Db,
  id: string,
  patch: Partial<CategoryInput> & { archived?: boolean; device_id: string },
): Promise<LocalCategory> {
  const existing = await getCategoryById(db, id);
  if (!existing || existing.deleted_at) throw new Error("Category not found");
  const ts = nowIso();
  const archived =
    patch.archived === undefined ? existing.archived : patch.archived ? 1 : 0;
  const archived_at =
    patch.archived === undefined
      ? existing.archived_at
      : patch.archived
        ? ts
        : null;

  await db.runAsync(
    `UPDATE categories SET
      type = ?, flow = ?, name = ?, description = ?, color = ?,
      archived = ?, archived_at = ?,
      updated_at = ?, dirty = 1, device_id = ?, sync_version = sync_version + 1
     WHERE id = ?`,
    patch.type ?? existing.type,
    patch.flow ?? existing.flow,
    patch.name?.trim() ?? existing.name,
    patch.description !== undefined ? patch.description : existing.description,
    patch.color !== undefined ? patch.color : existing.color,
    archived,
    archived_at,
    ts,
    patch.device_id,
    id,
  );
  const row = await getCategoryById(db, id);
  if (!row) throw new Error("Failed to update category");
  return row;
}

export async function softDeleteCategory(
  db: Db,
  id: string,
  device_id: string,
): Promise<void> {
  const ts = nowIso();
  await db.runAsync(
    `UPDATE categories SET deleted_at = ?, updated_at = ?, dirty = 1, device_id = ?, sync_version = sync_version + 1 WHERE id = ?`,
    ts,
    ts,
    device_id,
    id,
  );
}

export async function upsertCategoryFromSync(
  db: Db,
  row: LocalCategory,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO categories (
      id, server_id, organization_id, type, flow, name, description, color,
      archived, archived_at, created_at, updated_at, deleted_at,
      dirty, sync_version, client_request_id, device_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      server_id = excluded.server_id,
      organization_id = excluded.organization_id,
      type = excluded.type,
      flow = excluded.flow,
      name = excluded.name,
      description = excluded.description,
      color = excluded.color,
      archived = excluded.archived,
      archived_at = excluded.archived_at,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      dirty = excluded.dirty,
      sync_version = excluded.sync_version,
      client_request_id = excluded.client_request_id,
      device_id = excluded.device_id`,
    row.id,
    row.server_id,
    row.organization_id,
    row.type,
    row.flow,
    row.name,
    row.description,
    row.color,
    row.archived,
    row.archived_at,
    row.created_at,
    row.updated_at,
    row.deleted_at,
    row.dirty,
    row.sync_version,
    row.client_request_id,
    row.device_id,
  );
}
