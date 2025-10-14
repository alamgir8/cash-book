export const queryKeys = {
  profile: ['profile'],
  accounts: ['accounts'],
  accountsOverview: ['accounts', 'overview'],
  categories: ['categories'],
  accountDetail: (accountId: string) => ['account', accountId, 'detail'],
  accountTransactions: (accountId: string, filters: Record<string, unknown>) => [
    'account',
    accountId,
    'transactions',
    filters
  ],
  transactions: (filters: Record<string, unknown>) => ['transactions', filters],
  summary: ['summary']
};
