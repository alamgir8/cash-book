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
import { isLocalFirstEnabled } from "@/lib/local-first/flags";

export async function dalFetchTransactions(
  filters: TransactionFilters = {},
): Promise<{
  transactions: Transaction[];
  pagination?: { page: number; limit: number; total: number; pages: number };
}> {
  if (!isLocalFirstEnabled() || filters.organizationId) {
    return fetchTransactions(filters);
  }
  const local = await import("./transactions.local");
  return local.fetchLocalTransactions(filters);
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
  if (!isLocalFirstEnabled() || payload.organizationId) {
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
  if (!isLocalFirstEnabled()) {
    return apiUpdateTransaction(payload);
  }
  const local = await import("./transactions.local");
  return local.updateLocalTransaction(payload);
}

export async function dalDeleteTransaction(transactionId: string) {
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
  if (!isLocalFirstEnabled() || payload.organizationId) {
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
  if (!isLocalFirstEnabled()) {
    return apiCreateDuePayment(payload);
  }
  const local = await import("./transactions.local");
  return local.createLocalDuePayment(payload);
}

export async function enrichLocalTransaction(...args: [any, any]) {
  const local = await import("./transactions.local");
  return local.enrichLocalTransaction(...args);
}
