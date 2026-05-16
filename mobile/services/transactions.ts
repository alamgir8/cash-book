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
  counterparty?: string; // For / Beneficiary
  vendor?: string; // Vendor / Seller (who you buy from / sell to)
  payment_status?: "paid" | "due";
  due_date?: string;
  due_remaining?: number; // remaining unpaid (lives on the root due transaction)
  due_group_id?: string;
  parent_due_id?:
    | string
    | {
        _id: string;
        amount: number;
        due_remaining?: number;
        due_settled_at?: string;
        date: string;
        description?: string;
        vendor?: string;
        counterparty?: string;
        payment_status?: "paid" | "due";
      };
  due_settled_at?: string;
  balance_after_transaction?: number;
  is_deleted?: boolean;
  attachments?: {
    url: string;
    thumbnail_url?: string | null;
    file_name?: string;
    file_size?: number;
    mime_type?: string;
    storage_key: string;
    uploaded_at?: string;
  }[];
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
  vendor?: string;
  payment_status?: "paid" | "due";
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
  if (filters.vendor) params.vendor = filters.vendor;
  if (filters.payment_status) params.payment_status = filters.payment_status;
  if (filters.financialScope) params.financialScope = filters.financialScope;
  if (filters.type) params.type = filters.type;
  if (filters.q || filters.search) params.q = filters.q ?? filters.search;
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
  accountSource: Record<string, any> | string | null | undefined,
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
  transaction: Record<string, any>,
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
    vendor: transaction.vendor ?? undefined,
    payment_status: transaction.payment_status ?? undefined,
    due_date: transaction.due_date ?? undefined,
    due_remaining: transaction.due_remaining ?? undefined,
    due_group_id: transaction.due_group_id
      ? String(transaction.due_group_id)
      : undefined,
    parent_due_id: transaction.parent_due_id ?? undefined,
    due_settled_at: transaction.due_settled_at ?? undefined,
    balance_after_transaction: transaction.balance_after_transaction,
    is_deleted: transaction.is_deleted,
    attachments: transaction.attachments ?? [],
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

/**
 * Fetch all unique counterparties from the database
 * @param search - Optional search query to filter counterparties
 */
export const fetchCounterparties = async (
  search?: string,
): Promise<string[]> => {
  const params: Record<string, string> = {};
  if (search?.trim()) {
    params.search = search.trim();
  }
  const { data } = await api.get<string[]>("/transactions/counterparties", {
    params,
  });
  return data;
};

export const fetchVendors = async (search?: string): Promise<string[]> => {
  const params: Record<string, string> = {};
  if (search?.trim()) {
    params.search = search.trim();
  }
  const { data } = await api.get<string[]>("/transactions/vendors", { params });
  return data;
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
  vendor?: string;
  payment_status?: "paid" | "due";
  due_date?: string;
};

export const createTransaction = async (payload: CreateTransactionPayload) => {
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
  if (payload.vendor !== undefined) requestBody.vendor = payload.vendor;
  if (payload.payment_status)
    requestBody.payment_status = payload.payment_status;
  if (payload.due_date !== undefined) requestBody.due_date = payload.due_date;

  const { data } = await api.post<{ transaction: Record<string, any> }>(
    "/transactions",
    requestBody,
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

export const normalizeTransfer = (transfer: Record<string, any>): Transfer => {
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
    requestBody,
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
  vendor?: string;
  payment_status?: "paid" | "due";
  due_date?: string;
};

export const deleteTransaction = async (
  transactionId: string,
): Promise<void> => {
  await api.delete(`/transactions/${transactionId}`);
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
  if (payload.vendor !== undefined) requestBody.vendor = payload.vendor;
  if (payload.payment_status)
    requestBody.payment_status = payload.payment_status;
  if (payload.due_date !== undefined) requestBody.due_date = payload.due_date;

  const { data } = await api.put<{ transaction: Record<string, any> }>(
    `/transactions/${transactionId}`,
    requestBody,
  );
  return normalizeTransaction(data.transaction);
};

// ── Due chain types ────────────────────────────────────────────────────────

export type DueChainPayment = Transaction & { remaining_after: number };

export type DueChain = {
  root: Transaction;
  payments: DueChainPayment[];
  summary: {
    original_amount: number;
    total_paid: number;
    remaining: number;
    is_settled: boolean;
    settled_at: string | null;
    payment_count: number;
  };
};

export type LedgerEntry = Transaction & {
  entry_type: "borrow" | "repayment" | "loan_given" | "loan_received_back";
  running_balance: number;
};

export type CounterpartyLedger = {
  counterparty: string;
  timeline: LedgerEntry[];
  summary: {
    total_borrowed: number;
    total_repaid: number;
    total_given: number;
    total_received_back: number;
    outstanding: number;
    net_owed_by_me: number;
    owed_by_me: number;
    owed_by_them: number;
    transaction_count: number;
    is_settled: boolean;
  };
};

/**
 * Fetch the full due chain for any transaction in the chain
 * (works whether you pass the root due transaction id or any payment id)
 */
export const fetchDueChain = async (
  transactionId: string,
): Promise<DueChain> => {
  const { data } = await api.get<{
    root: Record<string, any>;
    payments: Record<string, any>[];
    summary: DueChain["summary"];
  }>(`/transactions/${transactionId}/due-chain`);

  return {
    root: normalizeTransaction(data.root),
    payments: data.payments.map((p) => ({
      ...normalizeTransaction(p),
      remaining_after: p.remaining_after,
    })),
    summary: data.summary,
  };
};

/**
 * Fetch a unified running ledger for ALL transactions with a counterparty.
 * Shows every borrow and repayment in chronological order with running balance.
 */
export const fetchCounterpartyLedger = async (
  counterparty: string,
): Promise<CounterpartyLedger> => {
  const { data } = await api.get<{
    counterparty: string;
    timeline: Record<string, any>[];
    summary: CounterpartyLedger["summary"];
  }>(`/transactions/counterparty-ledger`, { params: { counterparty } });

  return {
    counterparty: data.counterparty,
    timeline: data.timeline.map((t) => ({
      ...normalizeTransaction(t),
      entry_type: t.entry_type,
      running_balance: t.running_balance,
    })),
    summary: data.summary,
  };
};

type CreateDuePaymentPayload = {
  parentDueId: string;
  accountId: string;
  amount: number;
  type: "debit" | "credit";
  date?: string;
  description?: string;
  categoryId?: string;
};

/**
 * Record a (partial or full) payment against an existing "due" transaction.
 * The backend will:
 *   - Create the payment transaction (payment_status = 'paid')
 *   - Decrement the parent due's due_remaining
 *   - Mark the parent due as settled if due_remaining reaches 0
 *   - Adjust the account balance for the paid amount
 */
export const createDuePayment = async (
  payload: CreateDuePaymentPayload,
): Promise<Transaction> => {
  const requestBody: Record<string, unknown> = {
    accountId: payload.accountId,
    amount: payload.amount,
    type: payload.type,
    parent_due_id: payload.parentDueId,
  };
  if (payload.date) requestBody.date = payload.date;
  if (payload.description) requestBody.description = payload.description;
  if (payload.categoryId) requestBody.categoryId = payload.categoryId;

  const { data } = await api.post<{ transaction: Record<string, any> }>(
    "/transactions",
    requestBody,
  );
  return normalizeTransaction(data.transaction);
};
