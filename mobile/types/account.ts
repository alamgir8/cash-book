import type { z } from "zod";
import type {
  accountFormSchema,
  accountFiltersSchema,
} from "@/lib/validations/account";

/**
 * Account entity from API
 */
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

/**
 * Account summary statistics
 */
export type AccountSummary = {
  totalTransactions: number;
  totalDebit: number;
  totalCredit: number;
  net: number;
  lastTransactionDate: string | null;
};

/**
 * Account with summary data for overview screens
 */
export type AccountOverview = Account & {
  summary: AccountSummary;
};

/**
 * Account detail response with recent transactions
 */
export type AccountDetail = {
  account: Account;
  summary: AccountSummary;
  recentTransactions: any[]; // Transaction type from transactions.ts
};

/**
 * Account transactions response with pagination
 */
export type AccountTransactionsResponse = {
  account: Account;
  transactions: any[]; // Transaction type from transactions.ts
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

/**
 * Account form data type (inferred from Zod schema)
 */
export type AccountFormData = z.infer<typeof accountFormSchema>;

/**
 * Account filters type (inferred from Zod schema)
 */
export type AccountFilters = z.infer<typeof accountFiltersSchema>;

/**
 * Account create/update payload
 */
export type AccountPayload = {
  name: string;
  description?: string;
  kind?: string;
  opening_balance?: number;
  currency_code?: string;
  currency_symbol?: string;
};
