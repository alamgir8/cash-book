import type { Db } from "../client";
import { scopeWhere } from "../meta";
import type { LocalAccount, ScopeFilter } from "../types";
import { createClientRequestId, createLocalId, nowIso } from "@/lib/local-first/ids";

export type AccountInput = {
  name: string;
  description?: string | null;
  kind?: string;
  opening_balance?: number;
  currency_code?: string | null;
  currency_symbol?: string | null;
  organization_id?: string | null;
  device_id: string;
  server_id?: string | null;
  id?: string;
  dirty?: number;
  current_balance?: number;
};

export async function listAccounts(
  db: Db,
  scope?: ScopeFilter,
  opts?: { includeArchived?: boolean; includeDeleted?: boolean },
): Promise<LocalAccount[]> {
  const { sql, params } = scopeWhere("", scope);
  const archived = opts?.includeArchived ? "" : "AND archived = 0";
  const deleted = opts?.includeDeleted ? "" : "AND deleted_at IS NULL";
  return db.getAllAsync<LocalAccount>(
    `SELECT * FROM accounts WHERE ${sql} ${archived} ${deleted} ORDER BY name COLLATE NOCASE ASC`,
    ...params,
  );
}

export async function getAccountById(
  db: Db,
  id: string,
): Promise<LocalAccount | null> {
  return (
    (await db.getFirstAsync<LocalAccount>(
      "SELECT * FROM accounts WHERE id = ?",
      id,
    )) ?? null
  );
}

export async function createAccount(
  db: Db,
  input: AccountInput,
): Promise<LocalAccount> {
  const id = input.id ?? (await createLocalId());
  const ts = nowIso();
  const opening = Number(input.opening_balance ?? 0);
  const current = Number(input.current_balance ?? opening);
  await db.runAsync(
    `INSERT INTO accounts (
      id, server_id, organization_id, name, description, kind,
      opening_balance, current_balance, currency_code, currency_symbol,
      archived, archived_at, created_at, updated_at, deleted_at,
      dirty, sync_version, client_request_id, device_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, NULL, ?, 0, ?, ?)`,
    id,
    input.server_id ?? null,
    input.organization_id ?? null,
    input.name.trim(),
    input.description ?? null,
    input.kind ?? "cash",
    opening,
    current,
    input.currency_code ?? null,
    input.currency_symbol ?? null,
    ts,
    ts,
    input.dirty ?? 1,
    createClientRequestId(),
    input.device_id,
  );
  const row = await getAccountById(db, id);
  if (!row) throw new Error("Failed to create account");
  return row;
}

export async function updateAccount(
  db: Db,
  id: string,
  patch: Partial<AccountInput> & { archived?: boolean; device_id: string },
): Promise<LocalAccount> {
  const existing = await getAccountById(db, id);
  if (!existing || existing.deleted_at) {
    throw new Error("Account not found");
  }
  const ts = nowIso();
  const archived = patch.archived === undefined ? existing.archived : patch.archived ? 1 : 0;
  const archived_at =
    patch.archived === undefined
      ? existing.archived_at
      : patch.archived
        ? ts
        : null;

  await db.runAsync(
    `UPDATE accounts SET
      name = ?, description = ?, kind = ?,
      opening_balance = ?, currency_code = ?, currency_symbol = ?,
      archived = ?, archived_at = ?,
      updated_at = ?, dirty = 1, device_id = ?, sync_version = sync_version + 1
     WHERE id = ?`,
    patch.name?.trim() ?? existing.name,
    patch.description !== undefined ? patch.description : existing.description,
    patch.kind ?? existing.kind,
    patch.opening_balance !== undefined
      ? Number(patch.opening_balance)
      : existing.opening_balance,
    patch.currency_code !== undefined
      ? patch.currency_code
      : existing.currency_code,
    patch.currency_symbol !== undefined
      ? patch.currency_symbol
      : existing.currency_symbol,
    archived,
    archived_at,
    ts,
    patch.device_id,
    id,
  );
  const row = await getAccountById(db, id);
  if (!row) throw new Error("Failed to update account");
  return row;
}

export async function softDeleteAccount(
  db: Db,
  id: string,
  device_id: string,
): Promise<void> {
  const ts = nowIso();
  await db.runAsync(
    `UPDATE accounts SET deleted_at = ?, updated_at = ?, dirty = 1, device_id = ?, sync_version = sync_version + 1 WHERE id = ?`,
    ts,
    ts,
    device_id,
    id,
  );
}

export async function upsertAccountFromSync(
  db: Db,
  row: LocalAccount,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO accounts (
      id, server_id, organization_id, name, description, kind,
      opening_balance, current_balance, currency_code, currency_symbol,
      archived, archived_at, created_at, updated_at, deleted_at,
      dirty, sync_version, client_request_id, device_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      server_id = excluded.server_id,
      organization_id = excluded.organization_id,
      name = excluded.name,
      description = excluded.description,
      kind = excluded.kind,
      opening_balance = excluded.opening_balance,
      current_balance = excluded.current_balance,
      currency_code = excluded.currency_code,
      currency_symbol = excluded.currency_symbol,
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
    row.name,
    row.description,
    row.kind,
    row.opening_balance,
    row.current_balance,
    row.currency_code,
    row.currency_symbol,
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
