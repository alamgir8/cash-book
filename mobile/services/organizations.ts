import { api } from "../lib/api";

export interface OrganizationSettings {
  currency: string;
  currency_code?: string;
  locale: string;
  fiscal_year_start: string;
  date_format: string;
  time_format: string;
}

export interface OrganizationPermissions {
  manage_organization?: boolean;
  manage_members?: boolean;
  manage_accounts?: boolean;
  manage_categories?: boolean;
  manage_customers?: boolean;
  manage_suppliers?: boolean;
  create_transactions?: boolean;
  edit_transactions?: boolean;
  delete_transactions?: boolean;
  view_transactions?: boolean;
  create_invoices?: boolean;
  edit_invoices?: boolean;
  delete_invoices?: boolean;
  view_invoices?: boolean;
  view_reports?: boolean;
  export_data?: boolean;
  backup_restore?: boolean;
}

export interface Organization {
  _id: string;
  name: string;
  business_type: string;
  description?: string;
  logo?: string;
  owner: string;
  settings: OrganizationSettings;
  status?: "active" | "suspended" | "archived";
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  contact?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
  // These fields are added when returning from getMyOrganizations
  role?: string;
  permissions?: OrganizationPermissions;
  member_status?: string;
  joined_at?: string;
}

export interface OrganizationMember {
  _id: string;
  organization: string | Organization;
  user: string | { _id: string; name: string; email: string; phone?: string };
  display_name?: string;
  role: string;
  permissions: OrganizationPermissions;
  status: string;
  invited_by?: string | { _id: string; name: string; email: string };
  joined_at?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  business_type: string;
  role: string;
  permissions: OrganizationPermissions;
  settings: OrganizationSettings;
}

export interface CreateOrganizationParams {
  name: string;
  description?: string;
  business_type?: string;
  logo?: string;
  address?: Organization["address"];
  contact?: Organization["contact"];
  settings?: Partial<OrganizationSettings>;
}

export interface UpdateOrganizationParams {
  name?: string;
  description?: string;
  business_type?: string;
  logo?: string;
  address?: Organization["address"];
  contact?: Organization["contact"];
  settings?: Partial<OrganizationSettings> | { currency?: string };
  status?: "active" | "suspended" | "archived";
}

export interface AddMemberParams {
  email?: string;
  phone?: string;
  role?: string;
  display_name?: string;
}

export const organizationsApi = {
  // Create a new organization
  create: async (params: CreateOrganizationParams) => {
    const response = await api.post<{ organization: Organization }>(
      "/organizations",
      params
    );
    return response.data.organization;
  },

  // List user's organizations
  list: async () => {
    const response = await api.get<{ organizations: Organization[] }>(
      "/organizations"
    );
    return response.data.organizations;
  },

  // Get organization details
  get: async (organizationId: string) => {
    const response = await api.get<{
      organization: Organization;
      members: OrganizationMember[];
    }>(`/organizations/${organizationId}`);
    return response.data;
  },

  // Update organization
  update: async (organizationId: string, params: UpdateOrganizationParams) => {
    const response = await api.put<{ organization: Organization }>(
      `/organizations/${organizationId}`,
      params
    );
    return response.data.organization;
  },

  // Delete organization
  delete: async (organizationId: string) => {
    await api.delete(`/organizations/${organizationId}`);
  },

  // Add member to organization
  addMember: async (organizationId: string, params: AddMemberParams) => {
    const response = await api.post<{ member: OrganizationMember }>(
      `/organizations/${organizationId}/members`,
      params
    );
    return response.data.member;
  },

  // Update member role
  updateMemberRole: async (
    organizationId: string,
    memberId: string,
    role: string
  ) => {
    const response = await api.patch<{ member: OrganizationMember }>(
      `/organizations/${organizationId}/members/${memberId}`,
      { role }
    );
    return response.data.member;
  },

  // Remove member from organization
  removeMember: async (organizationId: string, memberId: string) => {
    await api.delete(`/organizations/${organizationId}/members/${memberId}`);
  },

  // Switch active organization (updates user preference)
  switchOrganization: async (organizationId: string | null) => {
    const response = await api.post<{ active_organization: string | null }>(
      "/organizations/switch",
      { organization_id: organizationId }
    );
    return response.data.active_organization;
  },
};
