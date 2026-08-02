import { getDb } from "@/db/client";
import * as transactionsRepo from "@/db/repos/transactions";
import * as transfersRepo from "@/db/repos/transfers";
import * as accountsRepo from "@/db/repos/accounts";
import * as categoriesRepo from "@/db/repos/categories";
import * as partiesRepo from "@/db/repos/parties";
import type { LocalTransaction } from "@/db/types";
import {
  createTransaction as apiCreateTransaction,
  createTransfer as apiCreateTransfer,
  createDuePayment as apiCreateDuePayment,
  deleteTransaction as apiDeleteTransaction,
  updateTransaction as apiUpdateTransaction,
  fetchTransactions,
  type Transaction,
  type TransactionFilters,
} from "@/services/transactions";
import { isDualWriteEnabled } from "@/lib/local-first/flags";
import { getOrCreateDeviceId } from "@/services/device";
import { createClientRequestId } from "@/lib/local-first/ids";

async function resolveLocalTransaction(transactionId: string) {
  const db = await getDb();
  let row = await transactionsRepo.getTransactionById(db, transactionId);
  if (!row) {
    row =
      (await db.getFirstAsync<LocalTransaction>(
        `SELECT * FROM transactions WHERE server_id = ? AND deleted_at IS NULL LIMIT 1`,
        transactionId,
      )) ?? null;
  }
  return { db, row };
}

function mapLocalTxn(
  row: LocalTransaction,
  extras?: {
    accountName?: string;
    categoryName?: string;
    categoryType?: string;
    categoryFlow?: "credit" | "debit";
    partyName?: string;
  },
): Transaction {
  return {
    _id: row.id,
    account: {
      _id: row.account_id,
      name: extras?.accountName ?? "",
      kind: undefined,
    },
    category: row.category_id
      ? {
          _id: row.category_id,
          name: extras?.categoryName ?? "",
          type: extras?.categoryType ?? "",
          flow: extras?.categoryFlow,
        }
      : null,
    type: row.type,
    amount: Number(row.amount),
    date: row.date,
    createdAt: row.created_at,
    description: row.description ?? undefined,
    keyword: row.keyword ?? undefined,
    party: row.party_id
      ? {
          _id: row.party_id,
          name: extras?.partyName ?? "",
          type: "customer",
        }
      : null,
    for_party: row.for_party_id
      ? { _id: row.for_party_id, name: "", type: "customer" }
      : null,
    payment_status: row.payment_status,
    due_date: row.due_date ?? undefined,
    due_remaining: row.due_remaining ?? undefined,
    due_group_id: row.due_group_id ?? undefined,
    parent_due_id: row.parent_due_id ?? undefined,
    due_settled_at: row.due_settled_at ?? undefined,
    balance_after_transaction: row.balance_after_transaction ?? undefined,
    is_deleted: Boolean(row.deleted_at),
  };
}

export async function enrichLocalTransaction(
  db: Awaited<ReturnType<typeof getDb>>,
  row: LocalTransaction,
) {
  const [account, category, party] = await Promise.all([
    accountsRepo.getAccountById(db, row.account_id),
    row.category_id
      ? categoriesRepo.getCategoryById(db, row.category_id)
      : Promise.resolve(null),
    row.party_id
      ? partiesRepo.getPartyById(db, row.party_id)
      : Promise.resolve(null),
  ]);
  return mapLocalTxn(row, {
    accountName: account?.name,
    categoryName: category?.name,
    categoryType: category?.type,
    categoryFlow: category?.flow as "credit" | "debit" | undefined,
    partyName: party?.name,
  });
}

export async function fetchLocalTransactions(
  filters: TransactionFilters = {},
): Promise<{
  transactions: Transaction[];
  pagination?: { page: number; limit: number; total: number; pages: number };
}> {
  const db = await getDb();
  const page = Number(filters.page ?? 1);
  const limit = Number(filters.limit ?? 20);
  const offset = (page - 1) * limit;
  const rows = await transactionsRepo.listTransactions(
    db,
    { organizationId: null },
    {
      accountId: filters.accountId,
      partyId: filters.party_id,
      limit,
      offset,
    },
  );
  const total = await transactionsRepo.countTransactions(
    db,
    { organizationId: null },
    { accountId: filters.accountId },
  );
  const transactions = [];
  for (const row of rows) {
    transactions.push(await enrichLocalTransaction(db, row));
  }
  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

type CreatePayload = {
  accountId: string;
  amount: number;
  type: "debit" | "credit";
  date?: string;
  description?: string;
  comment?: string;
  categoryId?: string;
  party?: string;
  for_party?: string;
  payment_status?: "paid" | "due";
  due_date?: string;
  organizationId?: string | null;
};

export async function createLocalTransaction(payload: CreatePayload) {
  const db = await getDb();
  const device_id = await getOrCreateDeviceId();
  const client_request_id = createClientRequestId();

  let created: LocalTransaction | null = null;
  const { withDbTransaction } = await import("@/db/client");
  await withDbTransaction(db, async (txn) => {
    created = await transactionsRepo.createTransaction(txn, {
      account_id: payload.accountId,
      category_id: payload.categoryId ?? null,
      party_id: payload.party ?? null,
      for_party_id: payload.for_party ?? null,
      type: payload.type,
      amount: payload.amount,
      date: payload.date ?? new Date().toISOString(),
      description: payload.description ?? null,
      keyword: payload.comment ?? null,
      payment_status: payload.payment_status ?? "paid",
      due_date: payload.due_date ?? null,
      organization_id: null,
      device_id,
      client_request_id,
    });
  });

  if (!created) throw new Error("Failed to create local transaction");

  if (isDualWriteEnabled()) {
    try {
      const remote = await apiCreateTransaction(payload);
      if (remote?._id) {
        await db.runAsync(
          `UPDATE transactions SET server_id = ?, dirty = 0 WHERE id = ?`,
          remote._id,
          created.id,
        );
      }
    } catch (e) {
      console.warn("[dal] dual-write transaction create failed", e);
    }
  }

  return enrichLocalTransaction(db, created);
}

export async function deleteLocalTransaction(transactionId: string) {
  const { db, row: existing } = await resolveLocalTransaction(transactionId);
  if (!existing) throw new Error("Transaction not found");
  const device_id = await getOrCreateDeviceId();
  await transactionsRepo.softDeleteTransaction(db, existing.id, device_id);

  if (isDualWriteEnabled() && existing.server_id) {
    try {
      await apiDeleteTransaction(existing.server_id);
      await db.runAsync(`UPDATE transactions SET dirty = 0 WHERE id = ?`, existing.id);
    } catch (e) {
      console.warn("[dal] dual-write transaction delete failed", e);
    }
  }
}

type UpdatePayload = {
  transactionId: string;
  accountId?: string;
  amount?: number;
  type?: "debit" | "credit";
  date?: string;
  description?: string;
  comment?: string;
  categoryId?: string;
  party?: string;
  for_party?: string;
  payment_status?: "paid" | "due";
  due_date?: string;
};

export async function updateLocalTransaction(payload: UpdatePayload) {
  const { db, row: existing } = await resolveLocalTransaction(
    payload.transactionId,
  );
  if (!existing) throw new Error("Transaction not found");
  const device_id = await getOrCreateDeviceId();

  const updated = await transactionsRepo.updateTransaction(db, existing.id, {
    device_id,
    account_id: payload.accountId,
    amount: payload.amount,
    type: payload.type,
    date: payload.date,
    description: payload.description,
    keyword: payload.comment,
    category_id: payload.categoryId,
    party_id: payload.party,
    for_party_id: payload.for_party,
    payment_status: payload.payment_status,
    due_date: payload.due_date,
  });

  if (isDualWriteEnabled() && existing.server_id) {
    try {
      await apiUpdateTransaction({
        ...payload,
        transactionId: existing.server_id,
      });
      await db.runAsync(`UPDATE transactions SET dirty = 0 WHERE id = ?`, existing.id);
    } catch (e) {
      console.warn("[dal] dual-write transaction update failed", e);
    }
  }

  return enrichLocalTransaction(db, updated);
}

export async function createLocalDuePayment(payload: {
  parentDueId: string;
  accountId: string;
  amount: number;
  type: "debit" | "credit";
  date?: string;
  description?: string;
  categoryId?: string;
}) {
  const { db, row: parent } = await resolveLocalTransaction(payload.parentDueId);
  if (!parent) throw new Error("Due transaction not found");
  const device_id = await getOrCreateDeviceId();

  const created = await transactionsRepo.createDuePaymentTransaction(db, {
    parentDueId: parent.id,
    account_id: payload.accountId,
    amount: payload.amount,
    type: payload.type,
    date: payload.date ?? new Date().toISOString(),
    description: payload.description ?? null,
    category_id: payload.categoryId ?? null,
    device_id,
  });

  if (isDualWriteEnabled() && parent.server_id) {
    try {
      const remote = await apiCreateDuePayment({
        ...payload,
        parentDueId: parent.server_id,
      });
      if (remote?._id) {
        await db.runAsync(
          `UPDATE transactions SET server_id = ?, dirty = 0 WHERE id = ?`,
          remote._id,
          created.id,
        );
      }
    } catch (e) {
      console.warn("[dal] dual-write due payment failed", e);
    }
  }

  return enrichLocalTransaction(db, created);
}

export async function createLocalTransfer(payload: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date?: string;
  description?: string;
  organizationId?: string | null;
}) {
  const db = await getDb();
  const device_id = await getOrCreateDeviceId();
  const transfer = await transfersRepo.createTransfer(db, {
    from_account_id: payload.fromAccountId,
    to_account_id: payload.toAccountId,
    amount: payload.amount,
    date: payload.date ?? new Date().toISOString(),
    description: payload.description ?? null,
    organization_id: null,
    device_id,
  });

  if (isDualWriteEnabled()) {
    try {
      await apiCreateTransfer(payload);
      await db.runAsync(`UPDATE transfers SET dirty = 0 WHERE id = ?`, transfer.id);
    } catch (e) {
      console.warn("[dal] dual-write transfer failed", e);
    }
  }

  return transfer;
}

// silence unused if tree-shaken oddly
void fetchTransactions;
