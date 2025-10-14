import { api } from "../lib/api";
import type { Transaction, TransactionFilters } from "./transactions";
import { normalizeTransaction } from "./transactions";

export type Account = {
  _id: string;
  name: string;
  description?: string;
  balance: number;
  kind?: string;
  currency_code?: string;
  currency_symbol?: string;
  opening_balance?: number;
  archived?: boolean;
};

export type AccountSummary = {
  totalTransactions: number;
  totalDebit: number;
  totalCredit: number;
  net: number;
  lastTransactionDate: string | null;
};

export type AccountOverview = Account & {
  summary: AccountSummary;
};

export type AccountDetail = {
  account: Account;
  summary: AccountSummary;
  recentTransactions: Transaction[];
};

export type AccountTransactionsResponse = {
  account: Account;
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

const normalizeAccountSummary = (summary: Record<string, any>): AccountSummary => {
  const totalDebit = Number(summary?.total_debit ?? summary?.totalDebit ?? 0);
  const totalCredit = Number(
    summary?.total_credit ?? summary?.totalCredit ?? 0
  );
  const netValue =
    summary?.net !== undefined && summary?.net !== null
      ? Number(summary.net)
      : totalCredit - totalDebit;

  return {
    totalTransactions: Number(
      summary?.total_transactions ?? summary?.totalTransactions ?? 0
    ),
    totalDebit,
    totalCredit,
    net: netValue,
    lastTransactionDate:
      summary?.last_transaction_date ?? summary?.lastTransactionDate ?? null,
  };
};

const normalizeAccount = (account: Record<string, any>): Account => ({
  _id: account._id,
  name: account.name,
  description: account.description ?? "",
  balance: Number(
    account.current_balance ??
      account.balance ??
      account.opening_balance ??
      0
  ),
  kind: account.kind,
  currency_code: account.currency_code,
  currency_symbol: account.currency_symbol,
  opening_balance: account.opening_balance,
  archived: account.archived,
});

const normalizeOverview = (
  account: Record<string, any>
): AccountOverview => ({
  ...normalizeAccount(account),
  summary: normalizeAccountSummary(account.summary ?? {}),
});

export const fetchAccounts = async (): Promise<AccountOverview[]> => {
  const { data } = await api.get<{ accounts: Record<string, any>[] }>(
    "/accounts"
  );
  return data.accounts.map(normalizeOverview);
};

export const fetchAccountsOverview = async (): Promise<AccountOverview[]> => {
  const { data } = await api.get<{ accounts: Record<string, any>[] }>(
    "/accounts/overview"
  );
  return data.accounts.map(normalizeOverview);
};

type AccountPayload = {
  name: string;
  description?: string;
  kind?: string;
  opening_balance?: number;
  currency_code?: string;
  currency_symbol?: string;
};

export const createAccount = async (payload: AccountPayload) => {
  const { data } = await api.post<{ account: Record<string, any> }>(
    "/accounts",
    payload
  );
  return normalizeAccount(data.account);
};

export const updateAccount = async ({
  accountId,
  ...payload
}: { accountId: string } & Partial<AccountPayload>) => {
  const { data } = await api.put<{ account: Record<string, any> }>(
    `/accounts/${accountId}`,
    payload
  );
  return normalizeAccount(data.account);
};

export const fetchAccountDetail = async (
  accountId: string
): Promise<AccountDetail> => {
  const { data } = await api.get<{
    account: Record<string, any>;
    summary: Record<string, any>;
    recent_transactions: Record<string, any>[];
  }>(`/accounts/${accountId}/detail`);

  return {
    account: normalizeAccount(data.account),
    summary: normalizeAccountSummary(data.summary ?? {}),
    recentTransactions: (data.recent_transactions ?? []).map(
      normalizeTransaction
    ),
  };
};

export const fetchAccountTransactions = async (
  accountId: string,
  filters: TransactionFilters
): Promise<AccountTransactionsResponse> => {
  const { data } = await api.get<{
    account: Record<string, any>;
    transactions: Record<string, any>[];
    pagination: AccountTransactionsResponse["pagination"];
  }>(`/accounts/${accountId}/transactions`, {
    params: filters,
  });

  return {
    account: normalizeAccount(data.account),
    pagination: data.pagination,
    transactions: data.transactions.map(normalizeTransaction),
  };
};
