import { api } from "../lib/api";

export type SchemeSummaryCounts = {
  family_count: number;
  paid_count: number;
  partial_count: number;
  due_count: number;
  total_expected: number;
  total_paid: number;
  total_due: number;
  total_members: number;
};

export type CollectionScheme = {
  _id: string;
  name: string;
  rate_per_member: number;
  description?: string;
  default_account?: { _id: string; name: string; kind?: string } | string;
  default_category_id?: { _id: string; name: string; type?: string } | string;
  organization?: string;
  archived?: boolean;
  member_count?: number;
  createdAt?: string;
  updatedAt?: string;
} & Partial<SchemeSummaryCounts>;

export type SchemeMemberStatus = "paid" | "partial" | "due";

export type SchemeRosterMember = {
  _id: string;
  party: {
    _id: string;
    name: string;
    code?: string;
    type?: string;
    phone?: string;
  };
  member_count: number;
  notes?: string;
  expected: number;
  paid: number;
  due: number;
  status: SchemeMemberStatus;
  payment_count: number;
  last_payment_at?: string | null;
};

export type SchemePayment = {
  _id: string;
  amount: number;
  date: string;
  description?: string;
  account?: { _id: string; name: string };
  category_id?: { _id: string; name: string } | null;
};

export type CreateSchemeParams = {
  name: string;
  rate_per_member: number;
  description?: string;
  organization?: string;
  default_account?: string;
  default_category_id?: string;
};

export type UpdateSchemeParams = Partial<CreateSchemeParams>;

export type DuplicateSchemeParams = {
  name?: string;
};

export type EnrollMemberParams = {
  party: string;
  member_count: number;
  notes?: string;
};

export type RecordSchemePaymentParams = {
  party: string;
  amount: number;
  account?: string;
  accountId?: string;
  date?: string;
  description?: string;
  categoryId?: string;
  organization?: string;
};

export const schemesApi = {
  list: async (params?: { organization?: string }) => {
    const { data } = await api.get<{ schemes: CollectionScheme[] }>(
      "/collection-schemes",
      { params },
    );
    return data.schemes;
  },

  create: async (payload: CreateSchemeParams) => {
    const { data } = await api.post<{ scheme: CollectionScheme }>(
      "/collection-schemes",
      payload,
    );
    return data.scheme;
  },

  get: async (schemeId: string) => {
    const { data } = await api.get<{
      scheme: CollectionScheme;
      summary: SchemeSummaryCounts;
    }>(`/collection-schemes/${schemeId}`);
    return data;
  },

  update: async (schemeId: string, payload: UpdateSchemeParams) => {
    const { data } = await api.patch<{ scheme: CollectionScheme }>(
      `/collection-schemes/${schemeId}`,
      payload,
    );
    return data.scheme;
  },

  archive: async (schemeId: string) => {
    const { data } = await api.post<{ scheme: CollectionScheme }>(
      `/collection-schemes/${schemeId}/archive`,
    );
    return data.scheme;
  },

  duplicate: async (schemeId: string, payload: DuplicateSchemeParams) => {
    const { data } = await api.post<{ scheme: CollectionScheme }>(
      `/collection-schemes/${schemeId}/duplicate`,
      payload,
    );
    return data.scheme;
  },

  delete: async (schemeId: string) => {
    await api.delete(`/collection-schemes/${schemeId}`);
  },

  roster: async (
    schemeId: string,
    params?: { status?: string; search?: string },
  ) => {
    const { data } = await api.get<{
      scheme: Pick<CollectionScheme, "_id" | "name" | "rate_per_member">;
      summary: SchemeSummaryCounts;
      members: SchemeRosterMember[];
    }>(`/collection-schemes/${schemeId}/roster`, { params });
    return data;
  },

  enroll: async (schemeId: string, payload: EnrollMemberParams) => {
    const { data } = await api.post<{ member: SchemeRosterMember }>(
      `/collection-schemes/${schemeId}/members`,
      payload,
    );
    return data.member;
  },

  updateMember: async (
    schemeId: string,
    memberId: string,
    payload: { member_count?: number; notes?: string },
  ) => {
    const { data } = await api.patch<{ member: SchemeRosterMember }>(
      `/collection-schemes/${schemeId}/members/${memberId}`,
      payload,
    );
    return data.member;
  },

  removeMember: async (schemeId: string, memberId: string) => {
    await api.delete(`/collection-schemes/${schemeId}/members/${memberId}`);
  },

  recordPayment: async (
    schemeId: string,
    payload: RecordSchemePaymentParams,
  ) => {
    const { data } = await api.post<{ transaction: SchemePayment }>(
      `/collection-schemes/${schemeId}/payments`,
      payload,
    );
    return data.transaction;
  },

  memberPayments: async (schemeId: string, memberId: string) => {
    const { data } = await api.get<{
      member: SchemeRosterMember;
      payments: SchemePayment[];
    }>(`/collection-schemes/${schemeId}/members/${memberId}/payments`);
    return data;
  },
};
