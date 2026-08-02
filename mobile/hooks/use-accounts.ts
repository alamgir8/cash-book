import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import {
  dalCreateAccount,
  dalDeleteAccount,
  dalFetchAccounts,
  dalFetchAccountsOverview,
  dalFetchAccountDetail,
  dalFetchAccountTransactions,
  dalUpdateAccount,
} from "@/data/accounts";
import { queryKeys } from "@/lib/queryKeys";
import type { AccountPayload } from "@/types/account";
import type { TransactionFilters } from "@/services/transactions";

/**
 * Hook to fetch all accounts
 */
export const useAccounts = () => {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => dalFetchAccounts(),
  });
};

/**
 * Hook to fetch accounts overview (with summary data)
 */
export const useAccountsOverview = () => {
  return useQuery({
    queryKey: queryKeys.accountsOverview,
    queryFn: () => dalFetchAccountsOverview(),
  });
};

/**
 * Hook to fetch a single account detail
 */
export const useAccountDetail = (accountId: string) => {
  return useQuery({
    queryKey: queryKeys.accountDetail(accountId),
    queryFn: () => dalFetchAccountDetail(accountId),
    enabled: Boolean(accountId),
  });
};

/**
 * Hook to fetch account transactions with filters
 */
export const useAccountTransactions = (
  accountId: string,
  filters: TransactionFilters
) => {
  return useQuery({
    queryKey: queryKeys.accountTransactions(accountId, filters),
    queryFn: () => dalFetchAccountTransactions(accountId, filters),
    enabled: Boolean(accountId),
  });
};

/**
 * Hook to create a new account
 */
export const useCreateAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AccountPayload) => dalCreateAccount(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountsOverview });
      Toast.show({
        type: "success",
        text1: "Account created successfully",
      });
    },
    onError: (error: any) => {
      Toast.show({
        type: "error",
        text1: "Failed to create account",
        text2: error?.response?.data?.message || error.message,
      });
    },
  });
};

/**
 * Hook to update an existing account
 */
export const useUpdateAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      ...payload
    }: { accountId: string; archived?: boolean } & Partial<AccountPayload>) =>
      dalUpdateAccount({ accountId, ...payload }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountsOverview });
      queryClient.invalidateQueries({
        queryKey: queryKeys.accountDetail(data._id),
      });
      Toast.show({
        type: "success",
        text1: "Account updated successfully",
      });
    },
    onError: (error: any) => {
      Toast.show({
        type: "error",
        text1: "Failed to update account",
        text2: error?.response?.data?.message || error.message,
      });
    },
  });
};

/**
 * Hook to delete an account (blocked server-side if it has transactions)
 */
export const useDeleteAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) => dalDeleteAccount(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountsOverview });
      Toast.show({
        type: "success",
        text1: "Account deleted successfully",
      });
    },
    onError: (error: any) => {
      Toast.show({
        type: "error",
        text1: "Failed to delete account",
        text2: error?.response?.data?.message || error.message,
      });
    },
  });
};

/**
 * Hook to archive an account
 * Note: Archive API endpoint may not exist yet
 */
export const useArchiveAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      // TODO: Implement when API endpoint is available
      throw new Error("Archive account API not implemented");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountsOverview });
      Toast.show({
        type: "success",
        text1: "Account archived successfully",
      });
    },
    onError: (error: any) => {
      Toast.show({
        type: "error",
        text1: "Failed to archive account",
        text2: error?.response?.data?.message || error.message,
      });
    },
  });
};
