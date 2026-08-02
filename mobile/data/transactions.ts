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
import {
  ensureLocalFirstFlags,
  isLocalFirstEnabled,
} from "@/lib/local-first/flags";
import { shouldUseLocalPersonalLedger } from "@/lib/local-first/ledger-scope";

export async function dalFetchTransactions(
  filters: TransactionFilters = {},
): Promise<{
  transactions: Transaction[];
  pagination?: { page: number; limit: number; total: number; pages: number };
}> {
  await ensureLocalFirstFlags();
  if (!shouldUseLocalPersonalLedger(filters.organizationId)) {
    return fetchTransactions(filters);
  }
  const local = await import("./transactions.local");
  return local.fetchLocalTransactions(filters);
}

export async function dalFetchTransactionTotals(
  filters: TransactionFilters = {},
): Promise<{ debit: number; credit: number; count: number }> {
  await ensureLocalFirstFlags();
  if (!shouldUseLocalPersonalLedger(filters.organizationId)) {
    // Cloud path: approximate from first page is wrong — fetch a summary page.
    const page = await fetchTransactions({ ...filters, page: 1, limit: 1 });
    const total = page.pagination?.total ?? page.transactions.length;
    // Without a dedicated summary endpoint, leave debit/credit to the caller.
    return { debit: 0, credit: 0, count: total };
  }
  const local = await import("./transactions.local");
  return local.fetchLocalTransactionTotals(filters);
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

export async function dalCreateTransaction(payload: CreatePayload) {
  await ensureLocalFirstFlags();
  if (!shouldUseLocalPersonalLedger(payload.organizationId)) {
    return apiCreateTransaction(payload);
  }
  const local = await import("./transactions.local");
  return local.createLocalTransaction(payload);
}

export async function dalUpdateTransaction(payload: {
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
}) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return apiUpdateTransaction(payload);
  }
  const local = await import("./transactions.local");
  return local.updateLocalTransaction(payload);
}

export async function dalDeleteTransaction(transactionId: string) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return apiDeleteTransaction(transactionId);
  }
  const local = await import("./transactions.local");
  return local.deleteLocalTransaction(transactionId);
}

export async function dalCreateTransfer(payload: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date?: string;
  description?: string;
  organizationId?: string | null;
}) {
  await ensureLocalFirstFlags();
  if (!shouldUseLocalPersonalLedger(payload.organizationId)) {
    return apiCreateTransfer(payload);
  }
  const local = await import("./transactions.local");
  return local.createLocalTransfer(payload);
}

export async function dalCreateDuePayment(payload: {
  parentDueId: string;
  accountId: string;
  amount: number;
  type: "debit" | "credit";
  date?: string;
  description?: string;
  categoryId?: string;
}) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return apiCreateDuePayment(payload);
  }
  const local = await import("./transactions.local");
  return local.createLocalDuePayment(payload);
}
