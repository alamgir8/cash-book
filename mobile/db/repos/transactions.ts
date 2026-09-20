import type { Db } from "../client";
import { withDbTransaction } from "../client";
import { scopeWhere } from "../meta";
import type { LocalTransaction, ScopeFilter } from "../types";
import {
  createClientRequestId,
  createLocalId,
  nowIso,
} from "@/lib/local-first/ids";
import { partySignedDelta } from "@/lib/local-first/party-balance";
import { recalculateAccountCashBalance, scheduleAccountTrailRewrite } from "../balances";

/**
 * True when the category is a loan (`loan_in` / `loan_out`).
 *
 * Loans are NOT pending payments: giving or receiving a loan moves cash
 * immediately, and what is still owed is tracked by the loan machinery
 * (`loan-summary.ts` → `owed_by_them` / `owed_by_me`), not by
 * `payment_status = 'due'`.
 *
 * Storing a loan as `due` was found in real data (all 7 of one account's loan
 * rows) and it silently corrupts money maths, because every cash rule in the app
 * excludes `due` rows — so the loan's real cash movement vanished from the
 * balance. The cloud fix corrected the existing rows; this guard stops new ones.
 */
async function isLoanCategory(
  db: Db,
  categoryId: string | null | undefined,
): Promise<boolean> {
  if (!categoryId) return false;
  const row = await db.getFirstAsync<{ type: string | null }>(
    `SELECT type FROM categories
     WHERE (id = ? OR server_id = ?) AND deleted_at IS NULL LIMIT 1`,
    categoryId,
    categoryId,
  );
  return row?.type === "loan_in" || row?.type === "loan_out";
}

export type TransactionInput = {  account_id: string;
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

async function applyPartyDeltaRaw(
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

async function resolvePartyType(
  db: Db,
  partyId: string | null | undefined,
): Promise<string | null> {
  if (!partyId) return null;
  const row = await db.getFirstAsync<{ type: string }>(
    `SELECT type FROM parties WHERE id = ? OR server_id = ? LIMIT 1`,
    partyId,
    partyId,
  );
  return row?.type ?? null;
}

/** Type-aware party delta (customer credit-positive, supplier debit-positive). */
async function applyPartySignedDelta(
  db: Db,
  partyId: string | null | undefined,
  txnType: "debit" | "credit",
  amount: number,
  paymentStatus: "paid" | "due",
): Promise<number | null> {
  if (!partyId) return null;
  const partyType = await resolvePartyType(db, partyId);
  // Mirror the backend: no resolvable party type → no balance effect.
  if (!partyType) return null;
  const delta = partySignedDelta(partyType, txnType, amount, paymentStatus);
  if (!delta) return null;
  return applyPartyDeltaRaw(db, partyId, delta);
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
     ORDER BY substr(date, 1, 10) DESC, created_at DESC, id DESC
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
  // A loan always moved cash, so it is never 'due' — see isLoanCategory.
  const loanCategory = await isLoanCategory(db, input.category_id);
  const paymentStatus = loanCategory
    ? "paid"
    : input.payment_status === "due"
      ? "due"
      : "paid";
  const applyBalance = input.applyBalance !== false && paymentStatus === "paid";

  let organizationId = input.organization_id ?? null;
  if (!organizationId && input.account_id) {
    const acc = await db.getFirstAsync<{ organization_id: string | null }>(
      `SELECT organization_id FROM accounts
       WHERE (id = ? OR server_id = ?) AND deleted_at IS NULL LIMIT 1`,
      input.account_id,
      input.account_id,
    );
    if (acc?.organization_id) organizationId = acc.organization_id;
  }

  let balanceAfter: number | null = null;
  let partyBalanceAfter: number | null = null;

  if (applyBalance) {
    balanceAfter = await applyAccountDelta(
      db,
      input.account_id,
      signedDelta(input.type, amount),
    );
    partyBalanceAfter = await applyPartySignedDelta(
      db,
      input.party_id,
      input.type,
      amount,
      "paid",
    );
  }

  // Match backend: due roots own their group id so payments can attach.
  const dueGroupId =
    input.due_group_id ?? (paymentStatus === "due" ? id : null);
  const dueRemaining =
    input.due_remaining ?? (paymentStatus === "due" ? amount : null);

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
    organizationId,
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
    dueGroupId,
    input.parent_due_id ?? null,
    dueRemaining,
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

  // Wallet cash must update immediately for the UI. Full Balance-after trail
  // rewrite is deferred — waiting on 1k+ UPDATEs inside create made Saving hang.
  if (input.applyBalance !== false) {
    await recalculateAccountCashBalance(db, input.account_id);
    scheduleAccountTrailRewrite(db, input.account_id);
  }

  const row = await getTransactionById(db, id);
  if (!row) throw new Error("Failed to create transaction");
  return row;
}

/**
 * Reverse one row's balance effects and mark it deleted.
 *
 * Split out so a transfer delete can apply the identical treatment to both legs.
 */
async function softDeleteOneTransaction(
  db: Db,
  existing: LocalTransaction,
  device_id: string,
): Promise<void> {
  await withDbTransaction(db, async (txn) => {
    if (existing.payment_status === "paid") {
      const reverse = -signedDelta(existing.type, existing.amount);
      await applyAccountDelta(txn, existing.account_id, reverse);
      const existingPartyType = await resolvePartyType(txn, existing.party_id);
      const reverseParty = -partySignedDelta(
        existingPartyType,
        existing.type,
        existing.amount,
        "paid",
      );
      if (existing.party_id && reverseParty) {
        await applyPartyDeltaRaw(txn, existing.party_id, reverseParty);
      }
    }

    // Undoing a due payment restores remaining on the parent (stays due).
    if (existing.parent_due_id) {
      const parent = await getTransactionById(txn, existing.parent_due_id);
      if (parent && !parent.deleted_at) {
        const nextRemaining =
          Number(parent.due_remaining ?? 0) + Number(existing.amount);
        const capped = Math.min(nextRemaining, Number(parent.amount));
        await txn.runAsync(
          `UPDATE transactions SET
            due_remaining = ?,
            due_settled_at = NULL,
            payment_status = 'due',
            updated_at = ?, dirty = 1, sync_status = 'pending_update',
            retry_count = 0, last_sync_error = NULL,
            device_id = ?, sync_version = sync_version + 1
           WHERE id = ?`,
          capped,
          nowIso(),
          device_id,
          parent.id,
        );
      }
    }

    const ts = nowIso();
    await txn.runAsync(
      `UPDATE transactions SET deleted_at = ?, updated_at = ?, dirty = 1,
        sync_status = 'pending_delete', retry_count = 0, last_sync_error = NULL,
        device_id = ?, sync_version = sync_version + 1 WHERE id = ?`,
      ts,
      ts,
      device_id,
      existing.id,
    );
  });
}

export async function softDeleteTransaction(
  db: Db,
  id: string,
  device_id: string,
): Promise<void> {
  const existing = await getTransactionById(db, id);
  if (!existing || existing.deleted_at) return;

  // A transfer is ONE logical event stored as two transaction legs. Deleting a
  // single leg would leave its sibling alive, so the source account loses the
  // money while the destination keeps it — a permanently wrong balance with no
  // way back. The backend reverts both legs plus the transfer doc
  // (transaction.controller.js); do the same here.
  const siblings = existing.transfer_id
    ? await db.getAllAsync<LocalTransaction>(
        `SELECT * FROM transactions
         WHERE transfer_id = ? AND id != ? AND deleted_at IS NULL`,
        existing.transfer_id,
        existing.id,
      )
    : [];

  for (const row of [existing, ...siblings]) {
    await softDeleteOneTransaction(db, row, device_id);
    await recalculateAccountCashBalance(db, row.account_id);
    scheduleAccountTrailRewrite(db, row.account_id);
  }

  if (existing.transfer_id) {
    const ts = nowIso();
    await db.runAsync(
      `UPDATE transfers SET deleted_at = ?, updated_at = ?, dirty = 1,
        sync_status = 'pending_delete', retry_count = 0, last_sync_error = NULL,
        device_id = ?, sync_version = sync_version + 1
       WHERE id = ? AND deleted_at IS NULL`,
      ts,
      ts,
      device_id,
      existing.transfer_id,
    );
  }
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

  // Set when a transfer sibling leg is updated, so its account trail is
  // rewritten after the transaction commits.
  let siblingAccountId: string | null = null;

  await withDbTransaction(db, async (txn) => {
    const nextType = patch.type ?? existing.type;
    const nextAmount =
      patch.amount !== undefined ? Number(patch.amount) : Number(existing.amount);
    const nextAccountId = patch.account_id ?? existing.account_id;
    const nextPartyId =
      patch.party_id !== undefined ? patch.party_id : existing.party_id;
    const nextStatusRaw = patch.payment_status ?? existing.payment_status;
    // A loan is always paid: it moved cash. Guarding here too, so an edit that
    // switches a row onto (or off) a loan category cannot leave it 'due'.
    const nextCategoryId =
      patch.category_id !== undefined ? patch.category_id : existing.category_id;
    const nextLoanCategory = await isLoanCategory(txn, nextCategoryId);
    const nextStatus = nextLoanCategory
      ? "paid"
      : nextStatusRaw === "due"
        ? "due"
        : "paid";
    const ts = nowIso();

    const childCount = await txn.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n FROM transactions
       WHERE deleted_at IS NULL
         AND (parent_due_id = ? OR parent_due_id = ?)`,
      existing.id,
      existing.server_id || existing.id,
    );
    const hasPaymentChildren = Number(childCount?.n ?? 0) > 0;

    // Reverse cash only for paid rows (due roots never moved cash).
    if (existing.payment_status === "paid") {
      const reverse = -signedDelta(existing.type, existing.amount);
      await applyAccountDelta(txn, existing.account_id, reverse);
      const existingPartyType = await resolvePartyType(txn, existing.party_id);
      const reverseParty = -partySignedDelta(
        existingPartyType,
        existing.type,
        existing.amount,
        "paid",
      );
      if (existing.party_id && reverseParty) {
        await applyPartyDeltaRaw(txn, existing.party_id, reverseParty);
      }
    }

    let balanceAfter: number | null = existing.balance_after_transaction;
    let partyBalanceAfter: number | null = existing.party_balance_after;

    // Cash/Paid toggle: apply cash unless this due root already has payment children.
    const applyCash =
      nextStatus === "paid" &&
      !(existing.payment_status === "due" && hasPaymentChildren);

    if (applyCash) {
      balanceAfter = await applyAccountDelta(
        txn,
        nextAccountId,
        signedDelta(nextType, nextAmount),
      );
      partyBalanceAfter = await applyPartySignedDelta(
        txn,
        nextPartyId,
        nextType,
        nextAmount,
        "paid",
      );
    } else if (nextStatus === "due") {
      balanceAfter = null;
      partyBalanceAfter = null;
    }

    // Preserve partial remaining on due edits. Init only when entering due.
    let nextRemaining = existing.due_remaining;
    let nextSettledAt = existing.due_settled_at;
    if (nextStatus === "due") {
      if (existing.payment_status !== "due") {
        nextRemaining = nextAmount;
        nextSettledAt = null;
      } else if (
        patch.amount !== undefined &&
        Number(existing.due_remaining) === Number(existing.amount)
      ) {
        nextRemaining = nextAmount;
      }
      // Keep due_settled_at if already fully settled; clear only when reopening.
      if (
        nextRemaining != null &&
        Number(nextRemaining) > 0
      ) {
        nextSettledAt = null;
      }
    }

    await txn.runAsync(
      `UPDATE transactions SET
        account_id = ?, category_id = ?, party_id = ?, for_party_id = ?,
        type = ?, amount = ?, date = ?, description = ?, keyword = ?,
        payment_status = ?, due_date = ?,
        due_remaining = ?, due_settled_at = ?,
        balance_after_transaction = ?, party_balance_after = ?,
        updated_at = ?, dirty = 1, sync_status = 'pending_update',
        retry_count = 0, last_sync_error = NULL,
        device_id = ?, sync_version = sync_version + 1
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
      nextRemaining,
      nextSettledAt,
      balanceAfter,
      partyBalanceAfter,
      ts,
      patch.device_id,
      id,
    );

    // A transfer is one event stored as two legs that share an amount and a
    // date. Mirror an amount/date edit to the sibling leg (and the transfers
    // row) so the pair cannot drift — otherwise editing the outgoing leg leaves
    // the destination credited by the old amount, changing the total money in
    // the system. Account and type are deliberately NOT mirrored: each leg is
    // meant to sit on a different account with an opposite sign.
    if (existing.transfer_id) {
      const sibling = await txn.getFirstAsync<LocalTransaction>(
        `SELECT * FROM transactions
         WHERE transfer_id = ? AND id != ? AND deleted_at IS NULL LIMIT 1`,
        existing.transfer_id,
        existing.id,
      );
      if (sibling) {
        const siblingAmount = Number(sibling.amount);
        if (
          Math.abs(siblingAmount - nextAmount) > 0.0001 &&
          sibling.payment_status === "paid"
        ) {
          await applyAccountDelta(
            txn,
            sibling.account_id,
            -signedDelta(sibling.type, siblingAmount),
          );
          await applyAccountDelta(
            txn,
            sibling.account_id,
            signedDelta(sibling.type, nextAmount),
          );
        }
        await txn.runAsync(
          `UPDATE transactions SET
            amount = ?, date = ?, updated_at = ?, dirty = 1,
            sync_status = 'pending_update', retry_count = 0,
            last_sync_error = NULL, device_id = ?,
            sync_version = sync_version + 1
           WHERE id = ?`,
          nextAmount,
          patch.date ?? existing.date,
          ts,
          patch.device_id,
          sibling.id,
        );
        siblingAccountId = sibling.account_id;
      }

      await txn.runAsync(
        `UPDATE transfers SET
          amount = ?, date = ?, updated_at = ?, dirty = 1,
          sync_status = 'pending_update', retry_count = 0,
          last_sync_error = NULL, device_id = ?,
          sync_version = sync_version + 1
         WHERE id = ? AND deleted_at IS NULL`,
        nextAmount,
        patch.date ?? existing.date,
        ts,
        patch.device_id,
        existing.transfer_id,
      );
    }
  });

  const nextAccountId = patch.account_id ?? existing.account_id;
  await recalculateAccountCashBalance(db, nextAccountId);
  scheduleAccountTrailRewrite(db, nextAccountId);
  if (nextAccountId !== existing.account_id) {
    await recalculateAccountCashBalance(db, existing.account_id);
    scheduleAccountTrailRewrite(db, existing.account_id);
  }
  if (siblingAccountId && siblingAccountId !== nextAccountId) {
    await recalculateAccountCashBalance(db, siblingAccountId);
    scheduleAccountTrailRewrite(db, siblingAccountId);
  }

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
    // Keep payment_status='due' always on the root (cloud schema). Settled =
    // remaining 0 + due_settled_at set. Cash moves only via the paid child.
    await txn.runAsync(
      `UPDATE transactions SET
        due_remaining = ?, due_settled_at = ?,
        payment_status = 'due',
        updated_at = ?, dirty = 1, sync_status = 'pending_update',
        retry_count = 0, last_sync_error = NULL,
        device_id = ?, sync_version = sync_version + 1
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
      -- The local ascending trail is authoritative for display. The server's
      -- value comes from a descending walk that used to unwind due rows, so
      -- taking it verbatim made the same row show a different "Balance after"
      -- after a sync than before one. Keep whatever the local trail already
      -- computed; only seed from the server when this row has no local value
      -- yet (fresh insert), and the post-pull recompute then corrects it.
      balance_after_transaction = COALESCE(
        transactions.balance_after_transaction,
        excluded.balance_after_transaction
      ),
      party_balance_after = excluded.party_balance_after,
      transfer_id = excluded.transfer_id,
      transfer_direction = excluded.transfer_direction,
      attachments_json = excluded.attachments_json,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      dirty = excluded.dirty,
      sync_status = CASE WHEN excluded.dirty = 0 THEN 'synced' ELSE COALESCE(excluded.sync_status, 'pending_update') END,
      retry_count = CASE WHEN excluded.dirty = 0 THEN 0 ELSE transactions.retry_count END,
      last_sync_error = CASE WHEN excluded.dirty = 0 THEN NULL ELSE transactions.last_sync_error END,
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
