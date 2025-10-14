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
  flow?: "credit" | "debit";
};

export type Transaction = {
  _id: string;
  account: TransactionAccount;
  category?: TransactionCategory | null;
  type: "debit" | "credit";
  amount: number;
  date: string;
  createdAt?: string;
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
  counterparty?: string;
  financialScope?: "actual" | "income" | "expense" | "both";
  type?: "debit" | "credit";
  q?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  includeDeleted?: boolean;
  page?: number;
  limit?: number;
};

export type Transfer = {
  _id: string;
  amount: number;
  date: string;
  description?: string;
  keyword?: string;
  counterparty?: string;
  meta_data?: Record<string, unknown>;
  from_account: TransactionAccount;
  to_account: TransactionAccount;
  debit_transaction?: Transaction;
  credit_transaction?: Transaction;
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
  if (filters.counterparty) params.counterparty = filters.counterparty;
  if (filters.financialScope) params.financialScope = filters.financialScope;
  if (filters.type) params.type = filters.type;
  if (filters.q || filters.search)
    params.q = filters.q ?? filters.search;
  if (filters.accountName) params.accountName = filters.accountName;
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

const normalizeAccount = (
  accountSource: Record<string, any> | string | null | undefined
): TransactionAccount => {
  if (!accountSource) {
    return {
      _id: "",
      name: "",
    };
  }

  if (typeof accountSource === "object") {
    return {
      _id: accountSource._id ?? "",
      name: accountSource.name ?? "",
      kind: accountSource.kind,
    };
  }

  return {
    _id: accountSource,
    name: "",
  };
};

export const normalizeTransaction = (
  transaction: Record<string, any>
): Transaction => {
  const categorySource = transaction.category_id ?? transaction.category;
  const category: TransactionCategory | null = categorySource
    ? {
        _id: categorySource._id ?? categorySource,
        name: categorySource.name ?? "",
        type: categorySource.type ?? "",
        flow: categorySource.flow,
      }
    : null;

  const account = normalizeAccount(transaction.account);

  return {
    _id: transaction._id,
    account,
    category,
    type: transaction.type,
    amount: Number(transaction.amount ?? 0),
    date: transaction.date,
    createdAt: transaction.createdAt ?? transaction.created_at,
    description: transaction.description ?? undefined,
    keyword: transaction.keyword ?? undefined,
    comment: transaction.comment ?? transaction.keyword ?? undefined,
    counterparty: transaction.counterparty ?? undefined,
    balance_after_transaction: transaction.balance_after_transaction,
    is_deleted: transaction.is_deleted,
  };
};

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

type CreateTransferPayload = {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date?: string;
  description?: string;
  comment?: string;
  counterparty?: string;
};

export const normalizeTransfer = (
  transfer: Record<string, any>
): Transfer => {
  const debitTransaction = transfer.debit_transaction
    ? normalizeTransaction(transfer.debit_transaction)
    : undefined;
  const creditTransaction = transfer.credit_transaction
    ? normalizeTransaction(transfer.credit_transaction)
    : undefined;

  return {
    _id: transfer._id,
    amount: Number(transfer.amount ?? 0),
    date: transfer.date,
    description: transfer.description ?? undefined,
    keyword: transfer.keyword ?? undefined,
    counterparty: transfer.counterparty ?? undefined,
    meta_data: transfer.meta_data ?? undefined,
    from_account: normalizeAccount(transfer.from_account),
    to_account: normalizeAccount(transfer.to_account),
    debit_transaction: debitTransaction,
    credit_transaction: creditTransaction,
  };
};

export const createTransfer = async (payload: CreateTransferPayload) => {
  const requestBody: Record<string, unknown> = {
    fromAccountId: payload.fromAccountId,
    toAccountId: payload.toAccountId,
    amount: payload.amount,
  };

  if (payload.date) requestBody.date = payload.date;
  if (payload.description) requestBody.description = payload.description;
  if (payload.comment) requestBody.keyword = payload.comment;
  if (payload.counterparty) requestBody.counterparty = payload.counterparty;

  const { data } = await api.post<{ transfer: Record<string, any> }>(
    "/transactions/transfer",
    requestBody
  );

  return normalizeTransfer(data.transfer);
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
