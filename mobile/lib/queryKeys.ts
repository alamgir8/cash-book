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
  organizations: ["organizations"],
  parties: ["parties"],
  invoices: ["invoices"],
  imports: ["imports"],
} as const;

/**
 * Unified QUERY_KEYS — single source of truth.
 * Use `QUERY_KEYS` everywhere for consistency.
 */
export const QUERY_KEYS = queryKeys;
