import { api } from "../lib/api";

export interface OrganizationSettings {
  currency: string;
  locale: string;
  fiscal_year_start: string;
  date_format: string;
  time_format: string;
}

export interface Organization {
  _id: string;
  name: string;
  business_type: string;
  description?: string;
  logo?: string;
  owner: string;
  settings: OrganizationSettings;
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
}

export interface OrganizationMember {
  _id: string;
  organization: string | Organization;
  user: string;
  display_name?: string;
  role: string;
  permissions: string[];
  status: string;
  invited_by?: string;
  joined_at?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  business_type: string;
  role: string;
  permissions: string[];
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
  settings?: Partial<OrganizationSettings>;
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
