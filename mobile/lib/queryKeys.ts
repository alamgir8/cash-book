export const queryKeys = {
  profile: ['profile'],
  accounts: ['accounts'],
  transactions: (filters: Record<string, unknown>) => ['transactions', filters],
  summary: ['summary']
};
