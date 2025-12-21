import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  OrganizationSummary,
  OrganizationPermissions,
} from "../services/organizations";

const ACTIVE_ORG_KEY = "@active_organization";

interface OrganizationContextValue {
  organizations: OrganizationSummary[];
  activeOrganization: OrganizationSummary | null;
  isLoading: boolean;
  isPersonalMode: boolean; // True when user is not in any organization context
  setOrganizations: (orgs: OrganizationSummary[]) => void;
  switchOrganization: (orgId: string | null) => Promise<void>;
  hasPermission: (permission: keyof OrganizationPermissions) => boolean;
  isOwner: boolean;
  isManager: boolean;
  canManageAccounts: boolean;
  canManageCategories: boolean;
  canCreateTransactions: boolean;
  canViewTransactions: boolean;
  canViewReports: boolean;
  canManageMembers: boolean;
  canCreateInvoices: boolean;
  canManageInvoices: boolean;
  canViewInvoices: boolean;
  canManageCustomers: boolean;
  canManageSuppliers: boolean;
  canManageParties: boolean;
  canExportData: boolean;
  canBackupRestore: boolean;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(
  null
);

interface OrganizationProviderProps {
  children: React.ReactNode;
  initialOrganizations?: OrganizationSummary[];
}

export function OrganizationProvider({
  children,
  initialOrganizations = [],
}: OrganizationProviderProps) {
  const [organizations, setOrganizationsState] =
    useState<OrganizationSummary[]>(initialOrganizations);
  const [activeOrganization, setActiveOrganization] =
    useState<OrganizationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved active organization on mount
  useEffect(() => {
    const loadActiveOrg = async () => {
      try {
        const savedOrgId = await AsyncStorage.getItem(ACTIVE_ORG_KEY);
        if (savedOrgId && organizations.length > 0) {
          const org = organizations.find((o) => o.id === savedOrgId);
          if (org) {
            setActiveOrganization(org);
          }
        }
      } catch (error) {
        console.warn("Failed to load active organization:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadActiveOrg();
  }, [organizations]);

  const setOrganizations = useCallback((orgs: OrganizationSummary[]) => {
    setOrganizationsState(orgs);
  }, []);

  const switchOrganization = useCallback(
    async (orgId: string | null) => {
      try {
        if (!orgId) {
          setActiveOrganization(null);
          await AsyncStorage.removeItem(ACTIVE_ORG_KEY);
          return;
        }

        const org = organizations.find((o) => o.id === orgId);
        if (org) {
          setActiveOrganization(org);
          await AsyncStorage.setItem(ACTIVE_ORG_KEY, orgId);
        }
      } catch (error) {
        console.warn("Failed to switch organization:", error);
        throw error;
      }
    },
    [organizations]
  );

  const hasPermission = useCallback(
    (permission: keyof OrganizationPermissions) => {
      if (!activeOrganization) {
        // Personal mode - user has all permissions (they own their own data)
        return true;
      }

      // Owner has all permissions
      if (activeOrganization.role === "owner") {
        return true;
      }

      // Check the permission from the permissions object
      const perms = activeOrganization.permissions;
      if (!perms) return false;

      return perms[permission] === true;
    },
    [activeOrganization]
  );

  // Determine if user is in personal mode (no active organization)
  const isPersonalMode = !activeOrganization;

  const value = useMemo<OrganizationContextValue>(
    () => ({
      organizations,
      activeOrganization,
      isLoading,
      isPersonalMode,
      setOrganizations,
      switchOrganization,
      hasPermission,
      isOwner: !activeOrganization || activeOrganization.role === "owner",
      isManager:
        !activeOrganization ||
        activeOrganization.role === "owner" ||
        activeOrganization.role === "admin" ||
        activeOrganization.role === "manager",
      canManageAccounts: hasPermission("manage_accounts"),
      canManageCategories: hasPermission("manage_categories"),
      canCreateTransactions: hasPermission("create_transactions"),
      canViewTransactions: hasPermission("view_transactions"),
      canViewReports: hasPermission("view_reports"),
      canManageMembers: hasPermission("manage_members"),
      canCreateInvoices: hasPermission("create_invoices"),
      canManageInvoices:
        hasPermission("create_invoices") || hasPermission("edit_invoices"),
      canViewInvoices: hasPermission("view_invoices"),
      canManageCustomers: hasPermission("manage_customers"),
      canManageSuppliers: hasPermission("manage_suppliers"),
      canManageParties:
        hasPermission("manage_customers") || hasPermission("manage_suppliers"),
      canExportData: hasPermission("export_data"),
      canBackupRestore: hasPermission("backup_restore"),
    }),
    [
      organizations,
      activeOrganization,
      isLoading,
      setOrganizations,
      switchOrganization,
      hasPermission,
    ]
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error(
      "useOrganization must be used within an OrganizationProvider"
    );
  }
  return context;
}

export function useActiveOrgId() {
  const { activeOrganization } = useOrganization();
  return activeOrganization?.id ?? null;
}
