import type { z } from "zod";
import type {
  partyFormSchema,
  partyFiltersSchema,
} from "@/lib/validations/party";

/**
 * Party type enum
 */
export type PartyType = "customer" | "supplier" | "both";

/**
 * Party address structure
 */
export type PartyAddress = {
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

/**
 * Party entity from API
 */
export type Party = {
  _id: string;
  organization?: string;
  admin: string;
  code: string;
  name: string;
  type: PartyType;
  phone?: string;
  email?: string;
  address?: PartyAddress;
  opening_balance: number;
  current_balance: number;
  credit_limit?: number;
  payment_terms_days?: number;
  tax_id?: string;
  notes?: string;
  tags?: string[];
  archived?: boolean;
  total_transactions: number;
  total_invoices?: number;
  last_transaction_at?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Ledger entry for party transactions
 */
export type LedgerEntry = {
  _id?: string;
  date: string;
  type: string;
  description?: string;
  reference?: string;
  debit: number;
  credit: number;
  running_balance: number;
  transaction_id?: string;
  invoice_id?: string;
};

/**
 * Party list response with pagination
 */
export type PartiesListResponse = {
  parties: Party[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

/**
 * Party ledger response with entries and summary
 */
export type PartyLedgerResponse = {
  party: Party;
  entries: LedgerEntry[];
  summary: {
    total_debit: number;
    total_credit: number;
    opening_balance: number;
    closing_balance: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

/**
 * Party form data type (inferred from Zod schema)
 */
export type PartyFormData = z.infer<typeof partyFormSchema>;

/**
 * Party filters type (inferred from Zod schema)
 */
export type PartyFilters = z.infer<typeof partyFiltersSchema>;

/**
 * Create party payload
 */
export type CreatePartyPayload = {
  organization?: string;
  name: string;
  type: PartyType;
  code?: string;
  phone?: string;
  email?: string;
  address?: PartyAddress | string;
  opening_balance?: number;
  credit_limit?: number;
  payment_terms_days?: number;
  tax_id?: string;
  notes?: string;
  tags?: string[];
};

/**
 * Update party payload
 */
export type UpdatePartyPayload = {
  name?: string;
  type?: PartyType;
  code?: string;
  phone?: string;
  email?: string;
  address?: PartyAddress | string;
  credit_limit?: number;
  payment_terms_days?: number;
  tax_id?: string;
  notes?: string;
  tags?: string[];
  archived?: boolean;
};

/**
 * List parties parameters
 */
export type ListPartiesParams = {
  organization?: string;
  type?: PartyType;
  search?: string;
  archived?: boolean | "all";
  page?: number;
  limit?: number;
};

/**
 * Get ledger parameters
 */
export type GetLedgerParams = {
  page?: number;
  limit?: number;
};
