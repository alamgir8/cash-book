import { api } from "../lib/api";
import type { Transaction, TransactionFilters } from "./transactions";

export type Account = {
  _id: string;
  name: string;
  type: "debit" | "credit";
  description?: string;
  balance: number;
};

export type AccountSummary = {
  totalTransactions: number;
  totalDebit: number;
  totalCredit: number;
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

export const fetchAccounts = async (): Promise<Account[]> => {
  const { data } = await api.get<{ accounts: Account[] }>("/accounts");
  return data.accounts;
};

export const fetchAccountsOverview = async (): Promise<AccountOverview[]> => {
  const { data } = await api.get<{ accounts: AccountOverview[] }>(
    "/accounts/overview"
  );
  return data.accounts;
};

export const createAccount = async (payload: {
  name: string;
  type: "debit" | "credit";
  description?: string;
}) => {
  const { data } = await api.post<{ account: Account }>("/accounts", payload);
  return data.account;
};

export const updateAccount = async ({
  accountId,
  ...payload
}: {
  accountId: string;
  name?: string;
  type?: "debit" | "credit";
  description?: string;
}) => {
  const { data } = await api.patch<{ account: Account }>(
    `/accounts/${accountId}`,
    payload
  );
  return data.account;
};

export const fetchAccountDetail = async (
  accountId: string
): Promise<AccountDetail> => {
  const { data } = await api.get<AccountDetail>(
    `/accounts/${accountId}/detail`
  );
  return data;
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

export const fetchAccountTransactions = async (
  accountId: string,
  filters: TransactionFilters
): Promise<AccountTransactionsResponse> => {
  const { data } = await api.get<AccountTransactionsResponse>(
    `/accounts/${accountId}/transactions`,
    {
      params: filters,
    }
  );
  return data;
};
