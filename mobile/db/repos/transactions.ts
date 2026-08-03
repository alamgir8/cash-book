import type { Db } from "../client";
import { withDbTransaction } from "../client";
import { scopeWhere } from "../meta";
import type { LocalTransaction, ScopeFilter } from "../types";
import {
  createClientRequestId,
  createLocalId,
  nowIso,
} from "@/lib/local-first/ids";

export type TransactionInput = {
  account_id: string;
  category_id?: string | null;
  party_id?: string | null;
  for_party_id?: string | null;
  type: "debit" | "credit";
  amount: number;
  date: string;
  description?: string | null;
  keyword?: string | null;
  counterparty?: string | null;
  vendor?: string | null;
  payment_status?: "paid" | "due";
  due_date?: string | null;
  due_group_id?: string | null;
  parent_due_id?: string | null;
  due_remaining?: number | null;
  meta_data_json?: string | null;
  transfer_id?: string | null;
  transfer_direction?: "outgoing" | "incoming" | null;
  attachments_json?: string | null;
  organization_id?: string | null;
  device_id: string;
  server_id?: string | null;
  id?: string;
  client_request_id?: string | null;
  dirty?: number;
  /** When false, skip balance side-effects (used by restore/recalc). Default true. */
  applyBalance?: boolean;
};

function signedDelta(type: "debit" | "credit", amount: number): number {
  return type === "credit" ? amount : -amount;
}

async function applyAccountDelta(
  db: Db,
  accountId: string,
  delta: number,
): Promise<number> {
  await db.runAsync(
    `UPDATE accounts SET current_balance = current_balance + ?
     WHERE id = ? OR server_id = ?`,
    delta,
    accountId,
    accountId,
  );
  const row = await db.getFirstAsync<{ current_balance: number }>(
    `SELECT current_balance FROM accounts WHERE id = ? OR server_id = ? LIMIT 1`,
    accountId,
    accountId,
  );
  return Number(row?.current_balance ?? 0);
}

async function applyPartyDelta(
  db: Db,
  partyId: string | null | undefined,
  delta: number,
): Promise<number | null> {
  if (!partyId) return null;
  await db.runAsync(
    `UPDATE parties SET current_balance = current_balance + ?
     WHERE id = ? OR server_id = ?`,
    delta,
    partyId,
    partyId,
  );
  const row = await db.getFirstAsync<{ current_balance: number }>(
    `SELECT current_balance FROM parties WHERE id = ? OR server_id = ? LIMIT 1`,
    partyId,
    partyId,
  );
  return Number(row?.current_balance ?? 0);
}

export async function listTransactions(
  db: Db,
  scope?: ScopeFilter,
  opts?: {
    accountId?: string;
    partyId?: string;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  },
): Promise<LocalTransaction[]> {
  const { sql, params } = scopeWhere("", scope);
  const clauses = [sql];
  const allParams: (string | number | null)[] = [...params];
  if (!opts?.includeDeleted) clauses.push("deleted_at IS NULL");
  if (opts?.accountId) {
    // Match local id or server_id stored on the account row.
    const acc = await db.getFirstAsync<{ id: string; server_id: string | null }>(
      `SELECT id, server_id FROM accounts WHERE id = ? OR server_id = ? LIMIT 1`,
      opts.accountId,
      opts.accountId,
    );
    clauses.push("(account_id = ? OR account_id = ?)");
    allParams.push(acc?.id ?? opts.accountId, acc?.server_id ?? opts.accountId);
  }
  if (opts?.partyId) {
    clauses.push("(party_id = ? OR for_party_id = ?)");
    allParams.push(opts.partyId, opts.partyId);
  }
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  allParams.push(limit, offset);
  return db.getAllAsync<LocalTransaction>(
    `SELECT * FROM transactions WHERE ${clauses.join(" AND ")}
     ORDER BY date DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    ...allParams,
  );
}

export async function countTransactions(
  db: Db,
  scope?: ScopeFilter,
  opts?: { accountId?: string; includeDeleted?: boolean },
): Promise<number> {
  const { sql, params } = scopeWhere("", scope);
  const clauses = [sql];
  const allParams: (string | null)[] = [...params];
  if (!opts?.includeDeleted) clauses.push("deleted_at IS NULL");
  if (opts?.accountId) {
    const acc = await db.getFirstAsync<{ id: string; server_id: string | null }>(
      `SELECT id, server_id FROM accounts WHERE id = ? OR server_id = ? LIMIT 1`,
      opts.accountId,
      opts.accountId,
    );
    clauses.push("(account_id = ? OR account_id = ?)");
    allParams.push(acc?.id ?? opts.accountId, acc?.server_id ?? opts.accountId);
  }
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM transactions WHERE ${clauses.join(" AND ")}`,
    ...allParams,
  );
  return Number(row?.c ?? 0);
}

export async function getTransactionById(
  db: Db,
  id: string,
): Promise<LocalTransaction | null> {
  return (
    (await db.getFirstAsync<LocalTransaction>(
      "SELECT * FROM transactions WHERE id = ?",
      id,
    )) ?? null
  );
}

/**
 * Create transaction and update account/party balances atomically (caller may wrap).
 */
export async function createTransaction(
  db: Db,
  input: TransactionInput,
): Promise<LocalTransaction> {
  const id = input.id ?? (await createLocalId());
  const ts = nowIso();
  const amount = Number(input.amount);
  if (!(amount >= 0)) throw new Error("Amount must be >= 0");
  const paymentStatus = input.payment_status ?? "paid";
  const applyBalance = input.applyBalance !== false && paymentStatus === "paid";

  let balanceAfter: number | null = null;
  let partyBalanceAfter: number | null = null;

  if (applyBalance) {
    const delta = signedDelta(input.type, amount);
    balanceAfter = await applyAccountDelta(db, input.account_id, delta);
    // Party: credit increases receivable (they owe us) for typical income linked to party
    partyBalanceAfter = await applyPartyDelta(db, input.party_id, delta);
  }

  await db.runAsync(
    `INSERT INTO transactions (
      id, server_id, organization_id, account_id, category_id, party_id, for_party_id,
      type, amount, date, description, keyword, counterparty, vendor,
      payment_status, due_date, due_group_id, parent_due_id, due_remaining, due_settled_at,
      meta_data_json, balance_after_transaction, party_balance_after,
      transfer_id, transfer_direction, attachments_json,
      created_at, updated_at, deleted_at, dirty, sync_version, client_request_id, device_id
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, NULL,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, NULL, ?, 0, ?, ?
    )`,
    id,
    input.server_id ?? null,
    input.organization_id ?? null,
    input.account_id,
    input.category_id ?? null,
    input.party_id ?? null,
    input.for_party_id ?? null,
    input.type,
    amount,
    input.date,
    input.description ?? null,
    input.keyword ?? null,
    input.counterparty ?? null,
    input.vendor ?? null,
    paymentStatus,
    input.due_date ?? null,
    input.due_group_id ?? null,
    input.parent_due_id ?? null,
    input.due_remaining ?? (paymentStatus === "due" ? amount : null),
    input.meta_data_json ?? null,
    balanceAfter,
    partyBalanceAfter,
    input.transfer_id ?? null,
    input.transfer_direction ?? null,
    input.attachments_json ?? null,
    ts,
    ts,
    input.dirty ?? 1,
    input.client_request_id ?? createClientRequestId(),
    input.device_id,
  );

  const row = await getTransactionById(db, id);
  if (!row) throw new Error("Failed to create transaction");
  return row;
}

export async function softDeleteTransaction(
  db: Db,
  id: string,
  device_id: string,
): Promise<void> {
  const existing = await getTransactionById(db, id);
  if (!existing || existing.deleted_at) return;

  await withDbTransaction(db, async (txn) => {
    if (existing.payment_status === "paid") {
      const reverse = -signedDelta(existing.type, existing.amount);
      await applyAccountDelta(txn, existing.account_id, reverse);
      await applyPartyDelta(txn, existing.party_id, reverse);
    }
    const ts = nowIso();
    await txn.runAsync(
      `UPDATE transactions SET deleted_at = ?, updated_at = ?, dirty = 1, device_id = ?, sync_version = sync_version + 1 WHERE id = ?`,
      ts,
      ts,
      device_id,
      id,
    );
  });
}

export type TransactionUpdatePatch = {
  account_id?: string;
  category_id?: string | null;
  party_id?: string | null;
  for_party_id?: string | null;
  type?: "debit" | "credit";
  amount?: number;
  date?: string;
  description?: string | null;
  keyword?: string | null;
  payment_status?: "paid" | "due";
  due_date?: string | null;
  device_id: string;
};

/**
 * Update a transaction, reversing prior balance effects and applying the new ones.
 */
export async function updateTransaction(
  db: Db,
  id: string,
  patch: TransactionUpdatePatch,
): Promise<LocalTransaction> {
  const existing = await getTransactionById(db, id);
  if (!existing || existing.deleted_at) throw new Error("Transaction not found");

  await withDbTransaction(db, async (txn) => {
    if (existing.payment_status === "paid") {
      const reverse = -signedDelta(existing.type, existing.amount);
      await applyAccountDelta(txn, existing.account_id, reverse);
      await applyPartyDelta(txn, existing.party_id, reverse);
    }

    const nextType = patch.type ?? existing.type;
    const nextAmount =
      patch.amount !== undefined ? Number(patch.amount) : Number(existing.amount);
    const nextAccountId = patch.account_id ?? existing.account_id;
    const nextPartyId =
      patch.party_id !== undefined ? patch.party_id : existing.party_id;
    const nextStatus = patch.payment_status ?? existing.payment_status;
    const ts = nowIso();

    let balanceAfter: number | null = existing.balance_after_transaction;
    let partyBalanceAfter: number | null = existing.party_balance_after;

    if (nextStatus === "paid") {
      const delta = signedDelta(nextType, nextAmount);
      balanceAfter = await applyAccountDelta(txn, nextAccountId, delta);
      partyBalanceAfter = await applyPartyDelta(txn, nextPartyId, delta);
    } else {
      balanceAfter = null;
      partyBalanceAfter = null;
    }

    await txn.runAsync(
      `UPDATE transactions SET
        account_id = ?, category_id = ?, party_id = ?, for_party_id = ?,
        type = ?, amount = ?, date = ?, description = ?, keyword = ?,
        payment_status = ?, due_date = ?,
        due_remaining = CASE WHEN ? = 'due' THEN ? ELSE due_remaining END,
        balance_after_transaction = ?, party_balance_after = ?,
        updated_at = ?, dirty = 1, device_id = ?, sync_version = sync_version + 1
       WHERE id = ?`,
      nextAccountId,
      patch.category_id !== undefined ? patch.category_id : existing.category_id,
      nextPartyId,
      patch.for_party_id !== undefined
        ? patch.for_party_id
        : existing.for_party_id,
      nextType,
      nextAmount,
      patch.date ?? existing.date,
      patch.description !== undefined ? patch.description : existing.description,
      patch.keyword !== undefined ? patch.keyword : existing.keyword,
      nextStatus,
      patch.due_date !== undefined ? patch.due_date : existing.due_date,
      nextStatus,
      nextAmount,
      balanceAfter,
      partyBalanceAfter,
      ts,
      patch.device_id,
      id,
    );
  });

  const row = await getTransactionById(db, id);
  if (!row) throw new Error("Failed to update transaction");
  return row;
}

/**
 * Record a payment against a due parent: create paid child + decrement remaining.
 */
export async function createDuePaymentTransaction(
  db: Db,
  input: {
    parentDueId: string;
    account_id: string;
    amount: number;
    type: "debit" | "credit";
    date: string;
    description?: string | null;
    category_id?: string | null;
    device_id: string;
  },
): Promise<LocalTransaction> {
  const parent = await getTransactionById(db, input.parentDueId);
  if (!parent || parent.deleted_at) throw new Error("Due transaction not found");
  if (parent.payment_status !== "due") {
    throw new Error("Parent transaction is not due");
  }

  const payAmount = Number(input.amount);
  if (!(payAmount > 0)) throw new Error("Payment amount must be > 0");

  const remaining = Number(parent.due_remaining ?? parent.amount);
  if (payAmount > remaining + 1e-9) {
    throw new Error("Payment exceeds remaining due amount");
  }

  let created: LocalTransaction | null = null;
  await withDbTransaction(db, async (txn) => {
    created = await createTransaction(txn, {
      account_id: input.account_id,
      category_id: input.category_id ?? parent.category_id,
      party_id: parent.party_id,
      for_party_id: parent.for_party_id,
      type: input.type,
      amount: payAmount,
      date: input.date,
      description: input.description ?? parent.description,
      payment_status: "paid",
      parent_due_id: parent.id,
      due_group_id: parent.due_group_id ?? parent.id,
      organization_id: parent.organization_id,
      device_id: input.device_id,
      applyBalance: true,
    });

    const nextRemaining = Math.max(0, remaining - payAmount);
    const settledAt = nextRemaining <= 1e-9 ? nowIso() : null;
    await txn.runAsync(
      `UPDATE transactions SET
        due_remaining = ?, due_settled_at = ?,
        updated_at = ?, dirty = 1, device_id = ?, sync_version = sync_version + 1
       WHERE id = ?`,
      nextRemaining,
      settledAt,
      nowIso(),
      input.device_id,
      parent.id,
    );
  });

  if (!created) throw new Error("Failed to create due payment");
  return created;
}

export async function upsertTransactionFromSync(
  db: Db,
  row: LocalTransaction,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO transactions (
      id, server_id, organization_id, account_id, category_id, party_id, for_party_id,
      type, amount, date, description, keyword, counterparty, vendor,
      payment_status, due_date, due_group_id, parent_due_id, due_remaining, due_settled_at,
      meta_data_json, balance_after_transaction, party_balance_after,
      transfer_id, transfer_direction, attachments_json,
      created_at, updated_at, deleted_at, dirty, sync_version, client_request_id, device_id
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      server_id = excluded.server_id,
      organization_id = excluded.organization_id,
      account_id = excluded.account_id,
      category_id = excluded.category_id,
      party_id = excluded.party_id,
      for_party_id = excluded.for_party_id,
      type = excluded.type,
      amount = excluded.amount,
      date = excluded.date,
      description = excluded.description,
      keyword = excluded.keyword,
      counterparty = excluded.counterparty,
      vendor = excluded.vendor,
      payment_status = excluded.payment_status,
      due_date = excluded.due_date,
      due_group_id = excluded.due_group_id,
      parent_due_id = excluded.parent_due_id,
      due_remaining = excluded.due_remaining,
      due_settled_at = excluded.due_settled_at,
      meta_data_json = excluded.meta_data_json,
      balance_after_transaction = excluded.balance_after_transaction,
      party_balance_after = excluded.party_balance_after,
      transfer_id = excluded.transfer_id,
      transfer_direction = excluded.transfer_direction,
      attachments_json = excluded.attachments_json,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      dirty = excluded.dirty,
      sync_version = excluded.sync_version,
      client_request_id = excluded.client_request_id,
      device_id = excluded.device_id`,
    row.id,
    row.server_id,
    row.organization_id,
    row.account_id,
    row.category_id,
    row.party_id,
    row.for_party_id,
    row.type,
    row.amount,
    row.date,
    row.description,
    row.keyword,
    row.counterparty,
    row.vendor,
    row.payment_status,
    row.due_date,
    row.due_group_id,
    row.parent_due_id,
    row.due_remaining,
    row.due_settled_at,
    row.meta_data_json,
    row.balance_after_transaction,
    row.party_balance_after,
    row.transfer_id,
    row.transfer_direction,
    row.attachments_json,
    row.created_at,
    row.updated_at,
    row.deleted_at,
    row.dirty,
    row.sync_version,
    row.client_request_id,
    row.device_id,
  );
}

export async function listDirtyTransactions(
  db: Db,
  limit = 500,
): Promise<LocalTransaction[]> {
  return db.getAllAsync<LocalTransaction>(
    `SELECT * FROM transactions WHERE dirty = 1 ORDER BY updated_at ASC LIMIT ?`,
    limit,
  );
}
