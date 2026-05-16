/**
 * use-accounts-screen
 *
 * Encapsulates all business logic for the Accounts screen.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import dayjs from "dayjs";
import {
  createAccount,
  fetchAccountsOverview,
  updateAccount,
  type Account,
  type AccountOverview,
} from "@/services/accounts";
import { queryKeys } from "@/lib/queryKeys";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import type { AccountFormValues } from "@/components/accounts/account-form-modal";

export function useAccountsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const queryClient = useQueryClient();
  const { canManageAccounts } = useOrganization();
  const { formatAmount } = usePreferences();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const accountsQuery = useQuery({
    queryKey: queryKeys.accountsOverview,
    queryFn: fetchAccountsOverview,
  });

  const accounts = useMemo(
    () => accountsQuery.data ?? [],
    [accountsQuery.data],
  );

  // ── Invalidation helper ──────────────────────────────────────────────────
  const invalidateAccountData = useCallback(
    async (accountId?: string) => {
      const tasks: Promise<unknown>[] = [
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accountsOverview }),
      ];
      if (accountId) {
        tasks.push(
          queryClient.invalidateQueries({
            queryKey: queryKeys.accountDetail(accountId),
          }),
          queryClient.invalidateQueries({
            queryKey: ["account", accountId],
            exact: false,
          }),
        );
      }
      await Promise.all(tasks);
    },
    [queryClient],
  );

  // ── Mutations ────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: async () => {
      Toast.show({ type: "success", text1: "Account added" });
      await invalidateAccountData();
      setModalVisible(false);
      setSelectedAccount(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateAccount,
    onSuccess: async () => {
      Toast.show({ type: "success", text1: "Account updated" });
      await invalidateAccountData(selectedAccount?._id);
      setModalVisible(false);
      setSelectedAccount(null);
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openModal = useCallback((account?: Account | AccountOverview) => {
    if (account) {
      setSelectedAccount({
        _id: account._id,
        name: account.name,
        description: account.description,
        balance: account.balance,
      } as Account);
    } else {
      setSelectedAccount(null);
    }
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setSelectedAccount(null);
  }, []);

  const handleSubmit = useCallback(
    async (values: AccountFormValues) => {
      const payload = {
        name: values.name,
        description: values.description,
      };
      if (selectedAccount) {
        await updateMutation.mutateAsync({
          accountId: selectedAccount._id,
          ...payload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
    },
    [selectedAccount, createMutation, updateMutation],
  );

  const handleViewHistory = useCallback(
    (accountId: string) => {
      router.push({
        pathname: "/(app)/accounts/[accountId]",
        params: { accountId },
      } as any);
    },
    [router],
  );

  // ── Deep-link: open modal for a specific account via URL param ───────────
  useEffect(() => {
    const accountParam = Array.isArray(params.accountId)
      ? params.accountId[0]
      : params.accountId;
    if (!accountParam || !accountsQuery.data) return;

    const target = accountsQuery.data.find((a) => a._id === accountParam);
    if (target) {
      openModal(target);
      router.replace("/(app)/accounts");
    }
  }, [params.accountId, accountsQuery.data, openModal, router]);

  // ── Derived totals ────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const agg = {
      totalAccounts: accounts.length,
      totalDebit: 0,
      totalCredit: 0,
      netBalance: 0,
      totalTransactions: 0,
      lastActivity: null as Date | null,
    };
    accounts.forEach((account) => {
      agg.totalDebit += account.summary.totalDebit ?? 0;
      agg.totalCredit += account.summary.totalCredit ?? 0;
      agg.netBalance += account.balance ?? 0;
      agg.totalTransactions += account.summary.totalTransactions ?? 0;
      if (account.summary.lastTransactionDate) {
        const d = new Date(account.summary.lastTransactionDate);
        if (!agg.lastActivity || d > agg.lastActivity) agg.lastActivity = d;
      }
    });
    return agg;
  }, [accounts]);

  const lastActivityLabel = totals.lastActivity
    ? dayjs(totals.lastActivity).format("MMM D, YYYY")
    : "No activity yet";

  const formatSignedAmount = useCallback(
    (value: number) => {
      const base = formatAmount(Math.abs(value));
      return `${value >= 0 ? "+" : "-"}${base}`;
    },
    [formatAmount],
  );

  return {
    // state
    modalVisible,
    selectedAccount,
    // queries
    accountsQuery,
    accounts,
    // computed
    totals,
    lastActivityLabel,
    // permissions
    canManageAccounts,
    // mutation state
    isSubmitting: createMutation.isPending || updateMutation.isPending,
    // handlers
    openModal,
    closeModal,
    handleSubmit,
    handleViewHistory,
    // utils
    formatAmount,
    formatSignedAmount,
  };
}
