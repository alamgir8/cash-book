import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import Toast from "react-native-toast-message";
import { TransactionModal } from "@/components/modals/transaction-modal";
import { AttachmentViewerModal } from "@/components/transactions/attachment-viewer-modal";
import { DuePaymentModal } from "@/components/modals/due-payment-modal";
import { LoanReturnModal } from "@/components/modals/loan-return-modal";
import { DueChainSheet } from "@/components/modals/due-chain-sheet";
import { VendorHistorySheet } from "@/components/modals/vendor-history-sheet";
import { FilteredTransactionList } from "@/components/transactions/filtered-transaction-list";
import type { Transaction } from "@/services/transactions";
import {
  AccountHeader,
  AccountActions,
  AccountSummaryCard,
  ExportOptionsModal,
} from "@/components/accounts";
import type { ExportType } from "@/components/accounts";
import {
  exportTransactionsPdf,
  exportTransactionsByCategoryPdf,
  exportTransactionsByCounterpartyPdf,
} from "@/services/reports";
import {
  updateTransaction,
  deleteTransaction,
} from "@/services/transactions";
import { usePreferences } from "@/hooks/use-preferences";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";
import { useOrganization } from "@/hooks/use-organization";
import { useDeleteMode } from "@/hooks/use-delete-mode";
import { useAccountDetail } from "@/hooks/use-accounts";
import { useTransactionFeed } from "@/hooks/use-transaction-feed";
import { calculateAccountNetFlow } from "@/lib/account-utils";
import { refreshAppData } from "@/lib/refresh-app-data";
import type { TransactionFormValues } from "@/components/modals/types";

export default function AccountDetailScreen() {
  const { formatAmount } = usePreferences();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { hasPermission } = useOrganization();
  const { isDeleteModeActive } = useDeleteMode();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const accountId = Array.isArray(params.accountId)
    ? params.accountId[0]
    : params.accountId;

  const canEditTransactions = hasPermission("edit_transactions");
  const canDeleteTransactions = hasPermission("delete_transactions");

  const [isModalVisible, setModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [viewingAttachmentsFor, setViewingAttachmentsFor] =
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
  const [exporting, setExporting] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportingType, setExportingType] = useState<ExportType | null>(null);

  const detailQuery = useAccountDetail(accountId ?? "");

  const feed = useTransactionFeed({
    accountId,
    pageLimit: 50,
    enabled: Boolean(accountId),
    editingCounterparty: editingTransaction?.counterparty,
    includeEmptyCategoryOption: true,
  });

  const {
    filters,
    allTransactions: visibleTransactions,
    hasMorePages,
    loadingMore,
    resetToPageOne,
    handleCategoryFilter,
    handleCounterpartyFilter,
    handleVendorFilter: handlePartyFilter,
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
  } = feed;

  const updateMutation = useMutation({
    mutationFn: updateTransaction,
    onSuccess: async () => {
      resetToPageOne();
      await refreshAppData(queryClient);
      setModalVisible(false);
      setEditingTransaction(null);
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

  const account = detailQuery.data?.account;
  const summary = detailQuery.data?.summary;

  const netFlow = useMemo(
    () => calculateAccountNetFlow(summary?.totalCredit, summary?.totalDebit),
    [summary],
  );

  const lastActivityLabel = summary?.lastTransactionDate
    ? dayjs(summary.lastTransactionDate).format("MMM D, YYYY")
    : "No activity yet";

  const handleViewHistory = useCallback((txn: Transaction) => {
    setViewingVendorHistoryFor(txn);
  }, []);

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

  const handleAttachmentsPress = useCallback((transaction: Transaction) => {
    setViewingAttachmentsFor(transaction);
  }, []);

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

  const closeTransactionModal = useCallback(() => {
    setModalVisible(false);
    setEditingTransaction(null);
  }, []);

  const handleExport = async (type: ExportType) => {
    if (!accountId) return;
    try {
      setExporting(true);
      setExportingType(type);
      const { page, limit, ...filtersWithoutPagination } = filters;
      const exportFilters = { ...filtersWithoutPagination, accountId };

      switch (type) {
        case "pdf":
          await exportTransactionsPdf(exportFilters);
          break;
        case "by-category":
          await exportTransactionsByCategoryPdf(exportFilters);
          break;
        case "by-counterparty":
          await exportTransactionsByCounterpartyPdf(exportFilters);
          break;
      }

      Toast.show({ type: "success", text1: "PDF exported successfully" });
      setExportModalVisible(false);
    } catch {
      Toast.show({ type: "error", text1: "Failed to export PDF" });
    } finally {
      setExporting(false);
      setExportingType(null);
    }
  };

  const handleRefresh = useCallback(() => {
    resetToPageOne();
    void refreshAppData(queryClient);
  }, [queryClient, resetToPageOne]);

  const handleEdit = useCallback(() => {
    router.push({
      pathname: "/(app)/accounts",
      params: { accountId },
    });
  }, [router, accountId]);

  const headerContent = useMemo(
    () => (
      <View className="gap-4">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full border items-center justify-center"
            style={{
              backgroundColor: colors.bg.secondary,
              borderColor: colors.border,
            }}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={colors.text.primary}
            />
          </TouchableOpacity>
          <Text
            className="text-2xl font-bold"
            style={{ color: colors.text.primary }}
          >
            {account?.name ?? "Account"}
          </Text>
        </View>

        {account && (
          <AccountHeader
            account={account}
            lastActivityLabel={lastActivityLabel}
            formatAmount={formatAmount}
          />
        )}

        <AccountActions
          onEdit={handleEdit}
          onExport={() => setExportModalVisible(true)}
        />

        {summary && (
          <AccountSummaryCard
            summary={summary}
            netFlow={netFlow}
            formatAmount={formatAmount}
          />
        )}
      </View>
    ),
    [
      account,
      lastActivityLabel,
      formatAmount,
      summary,
      netFlow,
      colors,
      router,
      handleEdit,
    ],
  );

  if (!accountId) {
    return (
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: colors.bg.primary }}
      >
        <Text className="text-base" style={{ color: colors.text.secondary }}>
          Account not found. Please go back and try again.
        </Text>
      </View>
    );
  }

  if (detailQuery.isLoading && !detailQuery.data) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: colors.bg.primary }}
      >
        <ActivityIndicator color={colors.info} size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <FilteredTransactionList
        transactions={visibleTransactions}
        filters={filters}
        onFilterChange={handleFilterChange}
        isLoading={transactionsQuery.isLoading}
        isRefetching={transactionsQuery.isRefetching}
        isFetching={transactionsQuery.isFetching}
        loadingMore={loadingMore}
        hasMorePages={hasMorePages}
        onLoadMore={handleLoadMore}
        onRefresh={handleRefresh}
        contentPaddingBottom={80}
        refreshTintColor="#3b82f6"
        headerContent={headerContent}
        filterSection={{
          hasActiveFilters,
          showAccountField: false,
          showTypeToggle: true,
          categories: categoryOptions,
          counterparties: counterpartyOptions,
          vendors: vendorOptions,
          onReset: handleResetFilters,
          onApplyFilters: handleApplyFilters,
        }}
        emptyState={{
          icon: "document-text-outline",
          title: t("noTransactionsFound"),
          description: t("noTransactionsMatchFilters"),
        }}
        cardActions={{
          onCategoryPress: handleCategoryFilter,
          onCounterpartyPress: handleCounterpartyFilter,
          onVendorPress: handlePartyFilter,
          onForPartyPress: handleForPartyFilter,
          onPaymentStatusPress: handlePaymentStatusFilter,
          onViewHistory: handleViewHistory,
          onEdit: canEditTransactions ? handleEditTransaction : undefined,
          onDelete:
            canDeleteTransactions && isDeleteModeActive
              ? handleDeleteTransaction
              : undefined,
          onAttachmentsPress: handleAttachmentsPress,
          onPayDue: setPayingDueTxn,
          onReturnLoan: setReturningLoanTxn,
          onViewChain: setViewingChainFor,
        }}
      />

      <TransactionModal
        visible={isModalVisible}
        onClose={closeTransactionModal}
        onSubmit={handleTransactionSubmit}
        editingTransaction={editingTransaction}
        accountOptions={accountOptions}
        categoryOptions={modalCategoryOptions}
        counterpartyOptions={counterpartyOptions}
        vendorOptions={vendorOptions}
        partyOptions={partyOptions}
        isAccountsLoading={accountsQuery.isLoading}
        isCategoriesLoading={categoriesQuery.isLoading}
        isSubmitting={updateMutation.isPending}
      />

      <AttachmentViewerModal
        visible={!!viewingAttachmentsFor}
        onClose={() => setViewingAttachmentsFor(null)}
        transactionId={viewingAttachmentsFor?._id ?? ""}
        attachments={viewingAttachmentsFor?.attachments ?? []}
        canDelete={canEditTransactions}
      />

      <ExportOptionsModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        onExport={handleExport}
        exporting={exporting}
        exportingType={exportingType}
        accountName={account?.name}
        hasDateFilter={Boolean(
          filters.from || filters.to || filters.startDate || filters.endDate,
        )}
      />

      {payingDueTxn && (
        <DuePaymentModal
          visible={!!payingDueTxn}
          onClose={() => setPayingDueTxn(null)}
          dueTxn={payingDueTxn}
          accountOptions={accountOptions}
          onSuccess={() => {
            handleRefresh();
            setPayingDueTxn(null);
          }}
        />
      )}

      {returningLoanTxn && (
        <LoanReturnModal
          visible={!!returningLoanTxn}
          onClose={() => setReturningLoanTxn(null)}
          loanTxn={returningLoanTxn}
          accountOptions={accountOptions}
          onSuccess={() => {
            handleRefresh();
            setReturningLoanTxn(null);
          }}
        />
      )}

      {viewingChainFor && (
        <DueChainSheet
          visible={!!viewingChainFor}
          onClose={() => setViewingChainFor(null)}
          transaction={viewingChainFor}
        />
      )}

      {viewingVendorHistoryFor && (
        <VendorHistorySheet
          visible={!!viewingVendorHistoryFor}
          onClose={() => setViewingVendorHistoryFor(null)}
          transaction={viewingVendorHistoryFor}
        />
      )}
    </View>
  );
}
