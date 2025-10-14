import { api } from "../lib/api";

export type Transaction = {
  _id: string;
  account: {
    _id: string;
    name: string;
    type: "debit" | "credit";
  };
  type: "debit" | "credit";
  amount: number;
  date: string;
  description?: string;
  comment?: string;
  balanceAfterTransaction?: number;
};

export type TransactionFilters = {
  range?: string;
  startDate?: string;
  endDate?: string;
  accountId?: string;
  accountName?: string;
  type?: "debit" | "credit";
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
};

export const fetchTransactions = async (filters: TransactionFilters) => {
  const { data } = await api.get<{
    transactions: Transaction[];
    pagination: { page: number; pages: number; total: number };
  }>("/transactions", { params: filters });
  return data;
};

export const createTransaction = async (payload: {
  accountId: string;
  amount: number;
  type: "debit" | "credit";
  date?: string;
  description?: string;
  comment?: string;
}) => {
  const { data } = await api.post<{ transaction: Transaction }>(
    "/transactions",
    payload
  );
  return data.transaction;
};

export const updateTransaction = async ({
  transactionId,
  ...payload
}: {
  transactionId: string;
  accountId?: string;
  amount?: number;
  type?: "debit" | "credit";
  date?: string;
  description?: string;
  comment?: string;
}) => {
  const { data } = await api.patch<{ transaction: Transaction }>(
    `/transactions/${transactionId}`,
    payload
  );
  return data.transaction;
};
