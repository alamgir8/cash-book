import { serializeTransactionFilters } from "@/lib/transaction-filters";
import type { TransactionFilters } from "@/services/transactions";

export const queryKeys = {
  profile: ["profile"],
  accounts: ["accounts"],
  accountsOverview: ["accounts", "overview"],
  categories: {
    all: ["categories"],
  },
  counterparties: ["counterparties"],
  vendors: ["vendors"],
  accountDetail: (accountId: string) => ["account", accountId, "detail"],
  accountTransactions: (accountId: string, filters: TransactionFilters) => [
    "account",
    accountId,
    "transactions",
    serializeTransactionFilters(filters),
  ],
  transactions: (filters: TransactionFilters) => [
    "transactions",
    serializeTransactionFilters(filters),
  ],
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
