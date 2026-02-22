export const queryKeys = {
  profile: ["profile"],
  accounts: ["accounts"],
  accountsOverview: ["accounts", "overview"],
  categories: {
    all: ["categories"],
  },
  counterparties: ["counterparties"],
  accountDetail: (accountId: string) => ["account", accountId, "detail"],
  accountTransactions: (
    accountId: string,
    filters: Record<string, unknown>,
  ) => ["account", accountId, "transactions", filters],
  transactions: (filters: Record<string, unknown>) => ["transactions", filters],
  summary: ["summary"],
  // Organization, Parties, Invoices
  organizations: ["organizations"],
  parties: ["parties"],
  invoices: ["invoices"],
  imports: ["imports"],
};

// Alias for QUERY_KEYS (uppercase naming convention)
export const QUERY_KEYS = {
  PARTIES: ["parties"],
  INVOICES: ["invoices"],
  ORGANIZATIONS: ["organizations"],
  ...queryKeys,
};
