/**
 * use-transactions-screen — Ledger tab business logic.
 */
import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import Toast from "react-native-toast-message";
import {
  updateTransaction,
  deleteTransaction,
  type Transaction,
} from "@/services/transactions";
import { exportTransactionsPdf } from "@/services/reports";
import { refreshAppData } from "@/lib/refresh-app-data";
import { useTransactionFeed } from "@/hooks/use-transaction-feed";
import { useOrganization } from "@/hooks/use-organization";
import { useDeleteMode } from "@/hooks/use-delete-mode";
import type { TransactionFormValues } from "@/components/modals/types";

export function useTransactionsScreen() {
  const searchParams = useLocalSearchParams<{
    accountId?: string;
    party_id?: string;
    for_party_id?: string;
    counterparty?: string;
  }>();
  const accountId = searchParams?.accountId as string | undefined;
  const initialPartyId = searchParams?.party_id as string | undefined;
  const initialForPartyId = searchParams?.for_party_id as string | undefined;
  const initialCounterparty = searchParams?.counterparty as string | undefined;
  const queryClient = useQueryClient();
  const { hasPermission } = useOrganization();
  const { isDeleteModeActive } = useDeleteMode();

  const canEditTransactions = hasPermission("edit_transactions");
  const canDeleteTransactions = hasPermission("delete_transactions");
  const canExportData = hasPermission("export_data");

  const [exporting, setExporting] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [payingDueTxn, setPayingDueTxn] = useState<Transaction | null>(null);
  const [returningLoanTxn, setReturningLoanTxn] = useState<Transaction | null>(
    null,
  );
  const [viewingChainFor, setViewingChainFor] = useState<Transaction | null>(
    null,
  );
  const [viewingVendorHistoryFor, setViewingVendorHistoryFor] =
    useState<Transaction | null>(null);
  const [viewingAttachmentsFor, setViewingAttachmentsFor] =
    useState<Transaction | null>(null);

  const initialFilters = useMemo(
    () => ({
      ...(initialPartyId ? { party_id: initialPartyId } : {}),
      ...(initialForPartyId ? { for_party_id: initialForPartyId } : {}),
      ...(initialCounterparty ? { counterparty: initialCounterparty } : {}),
    }),
    [initialPartyId, initialForPartyId, initialCounterparty],
  );

  const feed = useTransactionFeed({
    accountId,
    initialFilters,
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
    handleResetFilters,
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

  const updateMutation = useMutation({
    mutationFn: updateTransaction,
    onSuccess: async () => {
      resetToPageOne();
      setModalVisible(false);
      setEditingTransaction(null);
      Toast.show({ type: "success", text1: "Transaction updated" });
      await refreshAppData(queryClient);
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
    onSuccess: async () => {
      resetToPageOne();
      await refreshAppData(queryClient);
      Toast.show({ type: "success", text1: "Transaction deleted" });
    },
    onError: () =>
      Toast.show({
        type: "error",
        text1: "Delete failed",
        text2: "Please try again.",
      }),
  });

  const summaryTotals = useMemo(
    () =>
      rawTransactions.reduce(
        (acc, t) => {
          if (t.type === "credit") acc.credit += t.amount;
          else acc.debit += t.amount;
          return acc;
        },
        { debit: 0, credit: 0 },
      ),
    [rawTransactions],
  );

  const handleEditTransaction = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setModalVisible(true);
  }, []);

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

  const handleViewHistory = useCallback((transaction: Transaction) => {
    setViewingVendorHistoryFor(transaction);
  }, []);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    try {
      setExporting(true);
      await exportTransactionsPdf(filters);
      Toast.show({ type: "success", text1: "PDF exported successfully" });
    } catch {
      Toast.show({ type: "error", text1: "Failed to export PDF" });
    } finally {
      setExporting(false);
    }
  }, [exporting, filters]);

  const handleTransactionSubmit = async (values: TransactionFormValues) => {
    if (!editingTransaction) return;
    await updateMutation.mutateAsync({
      transactionId: editingTransaction._id,
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
    } as any);
  };

  const handleRefresh = useCallback(() => {
    resetToPageOne();
    void refreshAppData(queryClient);
  }, [queryClient, resetToPageOne]);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingTransaction(null);
  }, []);

  return {
    accountId,
    filters,
    exporting,
    allTransactions,
    hasMorePages,
    loadingMore,
    isModalVisible,
    editingTransaction,
    payingDueTxn,
    returningLoanTxn,
    viewingChainFor,
    viewingVendorHistoryFor,
    viewingAttachmentsFor,
    transactionsQuery,
    accountsQuery,
    categoriesQuery,
    accountOptions,
    modalCategoryOptions,
    categoryOptions,
    counterpartyOptions,
    vendorOptions,
    partyOptions,
    summaryTotals,
    totalTransactionCount,
    hasActiveFilters,
    canEditTransactions,
    canDeleteTransactions,
    canExportData,
    isDeleteModeActive,
    isUpdating: updateMutation.isPending,
    setPayingDueTxn,
    setReturningLoanTxn,
    setViewingChainFor,
    setViewingVendorHistoryFor,
    setViewingAttachmentsFor,
    setModalVisible,
    handleEditTransaction,
    handleDeleteTransaction,
    handleAttachmentsPress,
    handleCategoryPress: handleCategoryFilter,
    handleCounterpartyPress: handleCounterpartyFilter,
    handleVendorPress: handleVendorFilter,
    handlePartyPress: handleVendorFilter,
    handleForPartyPress: handleForPartyFilter,
    handleViewHistory,
    handlePaymentStatusPress: handlePaymentStatusFilter,
    handleFilterChange,
    handleResetFilters,
    handleApplyFilters,
    handleLoadMore,
    handleExport,
    handleTransactionSubmit,
    handleRefresh,
    closeModal,
  };
}
