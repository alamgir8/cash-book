/**
 * use-dashboard
 *
 * Encapsulates all business logic for the Dashboard (Home) screen.
 * Transaction list/filter state is delegated to useTransactionFeed.
 */
import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import {
  createTransaction,
  createTransfer,
  deleteTransaction,
  updateTransaction,
  type Transaction,
} from "@/services/transactions";
import { exportTransactionsPdf } from "@/services/reports";
import { refreshAppData } from "@/lib/refresh-app-data";
import { useTransactionFeed } from "@/hooks/use-transaction-feed";
import { useOrganization } from "@/hooks/use-organization";
import { useDeleteMode } from "@/hooks/use-delete-mode";
import type {
  TransactionFormValues,
  TransferFormValues,
} from "@/components/modals/types";

export function useDashboard() {
  const { canCreateTransactions, activeOrganization, hasPermission } =
    useOrganization();
  const canEditTransactions = hasPermission("edit_transactions");
  const { isDeleteModeActive } = useDeleteMode();
  const queryClient = useQueryClient();

  const [isModalVisible, setModalVisible] = useState(false);
  const [isTransferModalVisible, setTransferModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [payingDueTxn, setPayingDueTxn] = useState<Transaction | null>(null);
  const [returningLoanTxn, setReturningLoanTxn] = useState<Transaction | null>(
    null,
  );
  const [viewingChainFor, setViewingChainFor] = useState<Transaction | null>(
    null,
  );
  const [viewingAttachmentsFor, setViewingAttachmentsFor] =
    useState<Transaction | null>(null);

  const feed = useTransactionFeed({
    pageLimit: 20,
    editingCounterparty: editingTransaction?.counterparty,
    includeEmptyCategoryOption: true,
  });

  const {
    filters,
    allTransactions,
    rawTransactions,
    hasMorePages,
    loadingMore,
    resetToPageOne,
    handleCategoryFilter,
    handleCounterpartyFilter,
    handleVendorFilter,
    handleForPartyFilter,
    handlePaymentStatusFilter,
    handleFilterChange,
    handleLoadMore,
    handleResetFilters: feedResetFilters,
    handleApplyFilters,
    transactionsQuery,
    accountsQuery,
    categoriesQuery,
    accountOptions,
    modalCategoryOptions,
    categoryOptions,
    counterpartyOptions,
    vendorOptions,
    partyOptions,
    hasActiveFilters,
    totalTransactionCount,
  } = feed;

  const invalidateAll = useCallback(async () => {
    resetToPageOne();
    await refreshAppData(queryClient);
  }, [queryClient, resetToPageOne]);

  const createMutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      void invalidateAll();
      Toast.show({ type: "success", text1: "Transaction added" });
    },
    onError: () =>
      Toast.show({
        type: "error",
        text1: "Error saving transaction",
        text2: "Please try again.",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: updateTransaction,
    onSuccess: () => {
      setModalVisible(false);
      setEditingTransaction(null);
      void invalidateAll();
      Toast.show({ type: "success", text1: "Transaction updated" });
    },
    onError: () =>
      Toast.show({
        type: "error",
        text1: "Error updating transaction",
        text2: "Please try again.",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      void invalidateAll();
      Toast.show({ type: "success", text1: "Transaction deleted" });
    },
    onError: () =>
      Toast.show({
        type: "error",
        text1: "Delete failed",
        text2: "Please try again.",
      }),
  });

  const createTransferMutation = useMutation({
    mutationFn: createTransfer,
    onSuccess: () => {
      void invalidateAll();
      Toast.show({ type: "success", text1: "Transfer completed" });
    },
    onError: () =>
      Toast.show({
        type: "error",
        text1: "Error creating transfer",
        text2: "Please try again.",
      }),
  });

  const totals = useMemo(
    () =>
      rawTransactions.reduce(
        (acc, txn) => {
          acc[txn.type] += txn.amount;
          return acc;
        },
        { debit: 0, credit: 0 },
      ),
    [rawTransactions],
  );

  const handleEditTransaction = useCallback(
    (transaction: Transaction) => {
      if (!canCreateTransactions) {
        Toast.show({
          type: "error",
          text1: "Permission Denied",
          text2: "You don't have permission to edit transactions",
        });
        return;
      }
      setEditingTransaction(transaction);
      setModalVisible(true);
    },
    [canCreateTransactions],
  );

  const handleDeleteTransaction = useCallback(
    (transaction: Transaction) => {
      Alert.alert(
        "Delete Transaction?",
        `Delete "${transaction.description || transaction.account?.name}" (${
          transaction.type === "credit" ? "+" : "-"
        }${transaction.amount})? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteMutation.mutate(transaction._id),
          },
        ],
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deleteMutation.mutate],
  );

  const handleAttachmentsPress = useCallback(
    (t: Transaction) => setViewingAttachmentsFor(t),
    [],
  );

  const handleResetFilters = useCallback(() => {
    feedResetFilters();
    void refreshAppData(queryClient);
  }, [feedResetFilters, queryClient]);

  const handleRefresh = useCallback(() => {
    resetToPageOne();
    void refreshAppData(queryClient);
  }, [queryClient, resetToPageOne]);

  const openTransferModal = useCallback(() => {
    if (accountsQuery.isLoading) {
      Toast.show({ type: "info", text1: "Loading accounts" });
      return;
    }
    if (accountOptions.length < 2) {
      Toast.show({
        type: "info",
        text1: "Add another account to transfer funds",
      });
      return;
    }
    setTransferModalVisible(true);
  }, [accountsQuery.isLoading, accountOptions.length]);

  const handleExportPdf = useCallback(async () => {
    try {
      await exportTransactionsPdf(filters);
      Toast.show({ type: "success", text1: "PDF exported successfully!" });
    } catch {
      Toast.show({ type: "error", text1: "Failed to export PDF" });
    }
  }, [filters]);

  const handleTransactionSubmit = async (
    values: TransactionFormValues,
  ): Promise<{ _id: string } | void> => {
    const payload = {
      ...values,
      amount: Number(values.amount),
      date: values.date?.trim() || undefined,
      description: values.description?.trim() || undefined,
      comment: values.comment?.trim() || undefined,
      categoryId: values.categoryId || undefined,
      party: values.party || undefined,
      for_party: (values as any).for_party || undefined,
      payment_status: values.payment_status || "paid",
      due_date: values.due_date?.trim() || undefined,
    };

    if (editingTransaction) {
      await updateMutation.mutateAsync({
        transactionId: editingTransaction._id,
        ...payload,
      } as any);
    } else {
      const created = await createMutation.mutateAsync(payload as any);
      return { _id: created._id };
    }
  };

  const handleTransferSubmit = async (values: TransferFormValues) => {
    const transfer = await createTransferMutation.mutateAsync({
      fromAccountId: values.fromAccountId,
      toAccountId: values.toAccountId,
      amount: Number(values.amount),
      date: values.date?.trim() || undefined,
      description: values.description?.trim() || undefined,
      comment: values.comment?.trim() || undefined,
      counterparty: values.counterparty?.trim() || undefined,
    } as any);
    return transfer;
  };

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingTransaction(null);
  }, []);

  const closeTransferModal = useCallback(
    () => setTransferModalVisible(false),
    [],
  );

  return {
    filters,
    allTransactions,
    hasMorePages,
    loadingMore,
    isModalVisible,
    isTransferModalVisible,
    editingTransaction,
    payingDueTxn,
    returningLoanTxn,
    viewingChainFor,
    viewingAttachmentsFor,
    transactionsQuery,
    accountsQuery,
    categoriesQuery,
    accountOptions,
    categoryOptions,
    modalCategoryOptions,
    counterpartyOptions,
    vendorOptions,
    partyOptions,
    totals,
    totalTransactionCount,
    hasActiveFilters,
    canCreateTransactions,
    canEditTransactions,
    activeOrganization,
    isDeleteModeActive,
    isSubmitting: createMutation.isPending || updateMutation.isPending,
    isTransferSubmitting: createTransferMutation.isPending,
    setPayingDueTxn,
    setReturningLoanTxn,
    setViewingChainFor,
    setViewingAttachmentsFor,
    setModalVisible,
    handleEditTransaction,
    handleDeleteTransaction,
    handleAttachmentsPress,
    handleCategoryFilter,
    handleCounterpartyFilter,
    handleVendorFilter,
    handleForPartyFilter,
    handlePaymentStatusFilter,
    handleLoadMore,
    handleFilterChange,
    handleResetFilters,
    handleApplyFilters,
    handleRefresh,
    openTransferModal,
    handleExportPdf,
    handleTransactionSubmit,
    handleTransferSubmit,
    closeModal,
    closeTransferModal,
  };
}
