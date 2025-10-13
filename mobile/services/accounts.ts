import { api } from '../lib/api';

export type Account = {
  _id: string;
  name: string;
  type: 'debit' | 'credit';
  description?: string;
  balance: number;
};

export const fetchAccounts = async (): Promise<Account[]> => {
  const { data } = await api.get<{ accounts: Account[] }>('/accounts');
  return data.accounts;
};

export const createAccount = async (payload: {
  name: string;
  type: 'debit' | 'credit';
  description?: string;
  createdViaVoice?: boolean;
}) => {
  const { data } = await api.post<{ account: Account }>('/accounts', payload);
  return data.account;
};

export const updateAccount = async ({
  accountId,
  ...payload
}: {
  accountId: string;
  name?: string;
  type?: 'debit' | 'credit';
  description?: string;
}) => {
  const { data } = await api.patch<{ account: Account }>(`/accounts/${accountId}`, payload);
  return data.account;
};
