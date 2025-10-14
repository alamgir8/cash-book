import { api } from "../lib/api";

export type TransactionAccount = {
  _id: string;
  name: string;
  kind?: string;
};

export type TransactionCategory = {
  _id: string;
  name: string;
  type: string;
};

export type Transaction = {
  _id: string;
  account: TransactionAccount;
  category?: TransactionCategory | null;
  type: "debit" | "credit";
  amount: number;
  date: string;
  description?: string;
  keyword?: string;
  comment?: string;
  counterparty?: string;
  balance_after_transaction?: number;
  is_deleted?: boolean;
};

export type TransactionFilters = {
  from?: string;
  to?: string;
  startDate?: string;
  endDate?: string;
  range?: string;
  accountId?: string;
  accountName?: string;
  categoryId?: string;
  type?: "debit" | "credit";
  q?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  includeDeleted?: boolean;
  page?: number;
  limit?: number;
};

const mapFilters = (filters: TransactionFilters) => {
  const params: Record<string, unknown> = {};
  const from = filters.from ?? filters.startDate;
  const to = filters.to ?? filters.endDate;
  if (from) params.from = from;
  if (to) params.to = to;
  if (filters.range) params.range = filters.range;
  if (filters.accountId) params.accountId = filters.accountId;
  if (filters.categoryId) params.categoryId = filters.categoryId;
  if (filters.type) params.type = filters.type;
  if (filters.q || filters.search)
    params.q = filters.q ?? filters.search;
  if (filters.accountName) {
    params.q = params.q
      ? `${params.q} ${filters.accountName}`
      : filters.accountName;
  }
  if (filters.minAmount !== undefined && filters.minAmount !== null) {
    const value = Number(filters.minAmount);
    if (!Number.isNaN(value)) params.minAmount = value;
  }
  if (filters.maxAmount !== undefined && filters.maxAmount !== null) {
    const value = Number(filters.maxAmount);
    if (!Number.isNaN(value)) params.maxAmount = value;
  }
  if (filters.includeDeleted) params.includeDeleted = "true";
  if (filters.page !== undefined) params.page = filters.page;
  if (filters.limit !== undefined) params.limit = filters.limit;
  return params;
};

export const normalizeTransaction = (
  transaction: Record<string, any>
): Transaction => ({
  _id: transaction._id,
  account: transaction.account ?? {
    _id: transaction.account?._id ?? transaction.account,
    name: transaction.account?.name ?? "",
    kind: transaction.account?.kind,
  },
  category: transaction.category_id
    ? {
        _id: transaction.category_id._id ?? transaction.category_id,
        name: transaction.category_id.name ?? "",
        type: transaction.category_id.type ?? "",
      }
    : transaction.category ?? null,
  type: transaction.type,
  amount: Number(transaction.amount ?? 0),
  date: transaction.date,
  description: transaction.description ?? undefined,
  keyword: transaction.keyword ?? undefined,
  comment: transaction.comment ?? transaction.keyword ?? undefined,
  counterparty: transaction.counterparty ?? undefined,
  balance_after_transaction: transaction.balance_after_transaction,
  is_deleted: transaction.is_deleted,
});

export const fetchTransactions = async (filters: TransactionFilters) => {
  const { data } = await api.get<{
    transactions: Record<string, any>[];
    pagination: { page: number; pages: number; total: number; limit: number };
  }>("/transactions", { params: mapFilters(filters) });

  return {
    transactions: data.transactions.map(normalizeTransaction),
    pagination: data.pagination,
  };
};

type CreateTransactionPayload = {
  accountId: string;
  amount: number;
  type: "debit" | "credit";
  date?: string;
  description?: string;
  comment?: string;
  categoryId?: string;
  counterparty?: string;
};

export const createTransaction = async (
  payload: CreateTransactionPayload
) => {
  const requestBody: Record<string, unknown> = {
    accountId: payload.accountId,
    amount: payload.amount,
    type: payload.type,
  };

  if (payload.date) requestBody.date = payload.date;
  if (payload.description) requestBody.description = payload.description;
  if (payload.comment) requestBody.keyword = payload.comment;
  if (payload.categoryId) requestBody.categoryId = payload.categoryId;
  if (payload.counterparty) requestBody.counterparty = payload.counterparty;

  const { data } = await api.post<{ transaction: Record<string, any> }>(
    "/transactions",
    requestBody
  );
  return normalizeTransaction(data.transaction);
};

type UpdateTransactionPayload = {
  transactionId: string;
  accountId?: string;
  amount?: number;
  type?: "debit" | "credit";
  date?: string;
  description?: string;
  comment?: string;
  categoryId?: string;
  counterparty?: string;
};

export const updateTransaction = async ({
  transactionId,
  ...payload
}: UpdateTransactionPayload) => {
  const requestBody: Record<string, unknown> = {};

  if (payload.accountId) requestBody.accountId = payload.accountId;
  if (payload.amount !== undefined) requestBody.amount = payload.amount;
  if (payload.type) requestBody.type = payload.type;
  if (payload.date) requestBody.date = payload.date;
  if (payload.description) requestBody.description = payload.description;
  if (payload.comment) requestBody.keyword = payload.comment;
  if (payload.categoryId) requestBody.categoryId = payload.categoryId;
  if (payload.counterparty) requestBody.counterparty = payload.counterparty;

  const { data } = await api.put<{ transaction: Record<string, any> }>(
    `/transactions/${transactionId}`,
    requestBody
  );
  return normalizeTransaction(data.transaction);
};
