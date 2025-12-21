import { api } from "../lib/api";

export type PartyType = "customer" | "supplier" | "both";

export interface PartyAddress {
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface Party {
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
}

export interface CreatePartyParams {
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
}

export interface UpdatePartyParams {
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
}

export interface ListPartiesParams {
  organization?: string;
  type?: PartyType;
  search?: string;
  archived?: boolean | "all";
  page?: number;
  limit?: number;
}

export interface LedgerEntry {
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
}

export interface PartiesListResponse {
  parties: Party[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface PartyLedgerResponse {
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
}

export const partiesApi = {
  // Create a new party (customer/supplier)
  create: async (params: CreatePartyParams) => {
    const response = await api.post<{ party: Party }>("/parties", params);
    return response.data.party;
  },

  // List parties
  list: async (params?: ListPartiesParams) => {
    const response = await api.get<PartiesListResponse>("/parties", {
      params,
    });
    return response.data;
  },

  // Get party details
  get: async (partyId: string) => {
    const response = await api.get<{ party: Party }>(`/parties/${partyId}`);
    return response.data.party;
  },

  // Update party
  update: async (partyId: string, params: UpdatePartyParams) => {
    const response = await api.put<{ party: Party }>(
      `/parties/${partyId}`,
      params
    );
    return response.data.party;
  },

  // Delete party
  delete: async (partyId: string) => {
    await api.delete(`/parties/${partyId}`);
  },

  // Get party ledger (all transactions for this party)
  getLedger: async (
    partyId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    }
  ) => {
    const response = await api.get<PartyLedgerResponse>(
      `/parties/${partyId}/ledger`,
      { params }
    );
    return response.data;
  },
};
