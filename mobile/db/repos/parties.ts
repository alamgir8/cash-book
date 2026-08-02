import type { Db } from "../client";
import { scopeWhere } from "../meta";
import type { LocalParty, ScopeFilter } from "../types";
import { createClientRequestId, createLocalId, nowIso } from "@/lib/local-first/ids";

export type PartyInput = {
  type: string;
  name: string;
  code?: string | null;
  phone?: string | null;
  email?: string | null;
  address_json?: string | null;
  opening_balance?: number;
  current_balance?: number;
  credit_limit?: number | null;
  notes?: string | null;
  organization_id?: string | null;
  device_id: string;
  server_id?: string | null;
  id?: string;
  dirty?: number;
};

export async function listParties(
  db: Db,
  scope?: ScopeFilter,
  opts?: { includeArchived?: boolean; includeDeleted?: boolean },
): Promise<LocalParty[]> {
  const { sql, params } = scopeWhere("", scope);
  const archived = opts?.includeArchived ? "" : "AND archived = 0";
  const deleted = opts?.includeDeleted ? "" : "AND deleted_at IS NULL";
  return db.getAllAsync<LocalParty>(
    `SELECT * FROM parties WHERE ${sql} ${archived} ${deleted} ORDER BY name COLLATE NOCASE ASC`,
    ...params,
  );
}

export async function getPartyById(
  db: Db,
  id: string,
): Promise<LocalParty | null> {
  return (
    (await db.getFirstAsync<LocalParty>(
      "SELECT * FROM parties WHERE id = ?",
      id,
    )) ?? null
  );
}

export async function createParty(
  db: Db,
  input: PartyInput,
): Promise<LocalParty> {
  const id = input.id ?? (await createLocalId());
  const ts = nowIso();
  const opening = Number(input.opening_balance ?? 0);
  await db.runAsync(
    `INSERT INTO parties (
      id, server_id, organization_id, type, name, code, phone, email, address_json,
      opening_balance, current_balance, credit_limit, notes,
      archived, archived_at, created_at, updated_at, deleted_at,
      dirty, sync_version, client_request_id, device_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, NULL, ?, 0, ?, ?)`,
    id,
    input.server_id ?? null,
    input.organization_id ?? null,
    input.type || "customer",
    input.name.trim(),
    input.code ?? null,
    input.phone ?? null,
    input.email ?? null,
    input.address_json ?? null,
    opening,
    Number(input.current_balance ?? opening),
    input.credit_limit ?? null,
    input.notes ?? null,
    ts,
    ts,
    input.dirty ?? 1,
    createClientRequestId(),
    input.device_id,
  );
  const row = await getPartyById(db, id);
  if (!row) throw new Error("Failed to create party");
  return row;
}

export async function updateParty(
  db: Db,
  id: string,
  patch: Partial<PartyInput> & { archived?: boolean; device_id: string },
): Promise<LocalParty> {
  const existing = await getPartyById(db, id);
  if (!existing || existing.deleted_at) throw new Error("Party not found");
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
    `UPDATE parties SET
      type = ?, name = ?, code = ?, phone = ?, email = ?, address_json = ?,
      opening_balance = ?, credit_limit = ?, notes = ?,
      archived = ?, archived_at = ?,
      updated_at = ?, dirty = 1, device_id = ?, sync_version = sync_version + 1
     WHERE id = ?`,
    patch.type ?? existing.type,
    patch.name?.trim() ?? existing.name,
    patch.code !== undefined ? patch.code : existing.code,
    patch.phone !== undefined ? patch.phone : existing.phone,
    patch.email !== undefined ? patch.email : existing.email,
    patch.address_json !== undefined ? patch.address_json : existing.address_json,
    patch.opening_balance !== undefined
      ? Number(patch.opening_balance)
      : existing.opening_balance,
    patch.credit_limit !== undefined ? patch.credit_limit : existing.credit_limit,
    patch.notes !== undefined ? patch.notes : existing.notes,
    archived,
    archived_at,
    ts,
    patch.device_id,
    id,
  );
  const row = await getPartyById(db, id);
  if (!row) throw new Error("Failed to update party");
  return row;
}

export async function softDeleteParty(
  db: Db,
  id: string,
  device_id: string,
): Promise<void> {
  const ts = nowIso();
  await db.runAsync(
    `UPDATE parties SET deleted_at = ?, updated_at = ?, dirty = 1, device_id = ?, sync_version = sync_version + 1 WHERE id = ?`,
    ts,
    ts,
    device_id,
    id,
  );
}

export async function upsertPartyFromSync(db: Db, row: LocalParty): Promise<void> {
  await db.runAsync(
    `INSERT INTO parties (
      id, server_id, organization_id, type, name, code, phone, email, address_json,
      opening_balance, current_balance, credit_limit, notes,
      archived, archived_at, created_at, updated_at, deleted_at,
      dirty, sync_version, client_request_id, device_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      server_id = excluded.server_id,
      organization_id = excluded.organization_id,
      type = excluded.type,
      name = excluded.name,
      code = excluded.code,
      phone = excluded.phone,
      email = excluded.email,
      address_json = excluded.address_json,
      opening_balance = excluded.opening_balance,
      current_balance = excluded.current_balance,
      credit_limit = excluded.credit_limit,
      notes = excluded.notes,
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
    row.name,
    row.code,
    row.phone,
    row.email,
    row.address_json,
    row.opening_balance,
    row.current_balance,
    row.credit_limit,
    row.notes,
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
