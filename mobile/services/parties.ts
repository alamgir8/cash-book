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
  debit_transactions?: number;
  credit_transactions?: number;
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
  sort?: string;
}

export interface LedgerEntry {
  _id?: string;
  date: string;
  type: string;
  description?: string;
  comment?: string;
  reference?: string;
  debit: number;
  credit: number;
  running_balance: number;
  transaction_id?: string;
  invoice_id?: string;
  category_name?: string;
  account_name?: string;
  payment_status?: string;
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
  list: async (params?: ListPartiesParams, signal?: AbortSignal) => {
    const cleanParams: Record<string, string | number | boolean> = {};
    if (params?.organization) cleanParams.organization = params.organization;
    if (params?.type) cleanParams.type = params.type;
    if (params?.search?.trim()) cleanParams.search = params.search.trim();
    if (params?.archived != null) cleanParams.archived = params.archived as any;
    if (params?.page != null) cleanParams.page = params.page;
    if (params?.limit != null) cleanParams.limit = params.limit;
    if (params?.sort) cleanParams.sort = params.sort;

    const response = await api.get<PartiesListResponse>("/parties", {
      params: cleanParams,
      signal,
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
    const response = await api.patch<{ party: Party }>(
      `/parties/${partyId}`,
      params,
    );
    return response.data.party;
  },

  // Archive party (soft delete)
  archive: async (partyId: string, archived = true) => {
    const response = await api.post<{ party: Party; message: string }>(
      `/parties/${partyId}/archive`,
      { archived },
    );
    return response.data;
  },

  // Hard-delete party (blocked if linked transactions/invoices exist)
  delete: async (partyId: string) => {
    const response = await api.delete<{ message: string }>(
      `/parties/${partyId}`,
    );
    return response.data;
  },

  // Merge source party into target (reassigns txns/invoices, deletes source)
  merge: async (sourcePartyId: string, targetPartyId: string) => {
    const response = await api.post<{
      message: string;
      source?: Party;
      target: Party;
      transactionsUpdated: number;
      invoicesUpdated: number;
      sourceDeleted?: boolean;
    }>(`/parties/${sourcePartyId}/merge`, { targetPartyId });
    return response.data;
  },

  // Get party ledger (all transactions for this party)
  getLedger: async (
    partyId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
      search?: string;
      type?: "debit" | "credit" | "all";
      sort?: string;
    },
    signal?: AbortSignal,
  ) => {
    const cleanParams: Record<string, string | number> = {};
    if (params?.page != null) cleanParams.page = params.page;
    if (params?.limit != null) cleanParams.limit = params.limit;
    if (params?.sort) cleanParams.sort = params.sort;
    if (params?.startDate) cleanParams.startDate = params.startDate;
    if (params?.endDate) cleanParams.endDate = params.endDate;
    const searchText = params?.search?.trim();
    if (searchText) cleanParams.search = searchText;
    if (params?.type === "debit" || params?.type === "credit") {
      cleanParams.type = params.type;
    }

    const response = await api.get<PartyLedgerResponse & { ledger?: LedgerEntry[] }>(
      `/parties/${partyId}/ledger`,
      { params: cleanParams, signal },
    );
    const raw = response.data as PartyLedgerResponse & {
      ledger?: LedgerEntry[];
      net_balance?: number;
    };
    const entries = (raw.entries ?? raw.ledger ?? []) as LedgerEntry[];
    const opening = raw.summary?.opening_balance ?? raw.party?.opening_balance ?? 0;
    const totalDebit = raw.summary?.total_debit ?? 0;
    const totalCredit = raw.summary?.total_credit ?? 0;
    const closing =
      raw.summary?.closing_balance ??
      raw.net_balance ??
      opening + totalCredit - totalDebit;

    return {
      ...raw,
      entries: entries.map((entry) => ({
        ...entry,
        debit: Number(entry.debit || 0),
        credit: Number(entry.credit || 0),
        running_balance: Number(entry.running_balance || 0),
        description:
          entry.description ||
          entry.category_name ||
          (entry as { type?: string }).type ||
          "Transaction",
      })),
      summary: {
        opening_balance: opening,
        total_debit: totalDebit,
        total_credit: totalCredit,
        closing_balance: closing,
      },
    };
  },
};
