import type { Db } from "../client";
import { withDbTransaction } from "../client";
import { scopeWhere } from "../meta";
import type { LocalTransfer, ScopeFilter } from "../types";
import {
  createClientRequestId,
  createLocalId,
  nowIso,
} from "@/lib/local-first/ids";
import { createTransaction } from "./transactions";

export type TransferInput = {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  date: string;
  description?: string | null;
  keyword?: string | null;
  counterparty?: string | null;
  organization_id?: string | null;
  device_id: string;
  server_id?: string | null;
  id?: string;
  client_request_id?: string | null;
  dirty?: number;
};

export async function listTransfers(
  db: Db,
  scope?: ScopeFilter,
  opts?: { includeDeleted?: boolean },
): Promise<LocalTransfer[]> {
  const { sql, params } = scopeWhere("", scope);
  const deleted = opts?.includeDeleted ? "" : "AND deleted_at IS NULL";
  return db.getAllAsync<LocalTransfer>(
    `SELECT * FROM transfers WHERE ${sql} ${deleted} ORDER BY date DESC`,
    ...params,
  );
}

export async function getTransferById(
  db: Db,
  id: string,
): Promise<LocalTransfer | null> {
  return (
    (await db.getFirstAsync<LocalTransfer>(
      "SELECT * FROM transfers WHERE id = ?",
      id,
    )) ?? null
  );
}

/**
 * Creates transfer + paired debit/credit transactions and updates both account balances.
 */
export async function createTransfer(
  db: Db,
  input: TransferInput,
): Promise<LocalTransfer> {
  if (input.from_account_id === input.to_account_id) {
    throw new Error("Cannot transfer to the same account");
  }
  const amount = Number(input.amount);
  if (!(amount > 0)) throw new Error("Transfer amount must be > 0");

  const transferId = input.id ?? (await createLocalId());
  const crid = input.client_request_id ?? createClientRequestId();
  const ts = nowIso();

  let created: LocalTransfer | null = null;

  await withDbTransaction(db, async (txn) => {
    const debit = await createTransaction(txn, {
      id: await createLocalId(),
      account_id: input.from_account_id,
      type: "debit",
      amount,
      date: input.date,
      description: input.description ?? "Transfer out",
      keyword: input.keyword ?? null,
      counterparty: input.counterparty ?? null,
      organization_id: input.organization_id ?? null,
      device_id: input.device_id,
      transfer_id: transferId,
      transfer_direction: "outgoing",
      client_request_id: `${crid}-out`,
      dirty: input.dirty ?? 1,
    });

    const credit = await createTransaction(txn, {
      id: await createLocalId(),
      account_id: input.to_account_id,
      type: "credit",
      amount,
      date: input.date,
      description: input.description ?? "Transfer in",
      keyword: input.keyword ?? null,
      counterparty: input.counterparty ?? null,
      organization_id: input.organization_id ?? null,
      device_id: input.device_id,
      transfer_id: transferId,
      transfer_direction: "incoming",
      client_request_id: `${crid}-in`,
      dirty: input.dirty ?? 1,
    });

    await txn.runAsync(
      `INSERT INTO transfers (
        id, server_id, organization_id, from_account_id, to_account_id,
        amount, date, description, keyword, counterparty, meta_data_json,
        debit_transaction_id, credit_transaction_id,
        created_at, updated_at, deleted_at, dirty, sync_version, client_request_id, device_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL, ?, 0, ?, ?)`,
      transferId,
      input.server_id ?? null,
      input.organization_id ?? null,
      input.from_account_id,
      input.to_account_id,
      amount,
      input.date,
      input.description ?? null,
      input.keyword ?? null,
      input.counterparty ?? null,
      debit.id,
      credit.id,
      ts,
      ts,
      input.dirty ?? 1,
      crid,
      input.device_id,
    );

    created = await getTransferById(txn, transferId);
  });

  if (!created) throw new Error("Failed to create transfer");
  return created;
}

export async function upsertTransferFromSync(
  db: Db,
  row: LocalTransfer,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO transfers (
      id, server_id, organization_id, from_account_id, to_account_id,
      amount, date, description, keyword, counterparty, meta_data_json,
      debit_transaction_id, credit_transaction_id,
      created_at, updated_at, deleted_at, dirty, sync_version, client_request_id, device_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      server_id = excluded.server_id,
      organization_id = excluded.organization_id,
      from_account_id = excluded.from_account_id,
      to_account_id = excluded.to_account_id,
      amount = excluded.amount,
      date = excluded.date,
      description = excluded.description,
      keyword = excluded.keyword,
      counterparty = excluded.counterparty,
      meta_data_json = excluded.meta_data_json,
      debit_transaction_id = excluded.debit_transaction_id,
      credit_transaction_id = excluded.credit_transaction_id,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      dirty = excluded.dirty,
      sync_version = excluded.sync_version,
      client_request_id = excluded.client_request_id,
      device_id = excluded.device_id`,
    row.id,
    row.server_id,
    row.organization_id,
    row.from_account_id,
    row.to_account_id,
    row.amount,
    row.date,
    row.description,
    row.keyword,
    row.counterparty,
    row.meta_data_json,
    row.debit_transaction_id,
    row.credit_transaction_id,
    row.created_at,
    row.updated_at,
    row.deleted_at,
    row.dirty,
    row.sync_version,
    row.client_request_id,
    row.device_id,
  );
}
