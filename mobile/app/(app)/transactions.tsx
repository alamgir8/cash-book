import { useMemo } from "react";
import { View } from "react-native";
import { ScreenHeader } from "@/components/screen-header";
import { StatsCards } from "@/components/stats-cards";
import { TransactionModal } from "@/components/modals/transaction-modal";
import { AttachmentViewerModal } from "@/components/transactions/attachment-viewer-modal";
import { DuePaymentModal } from "@/components/modals/due-payment-modal";
import { LoanReturnModal } from "@/components/modals/loan-return-modal";
import { DueChainSheet } from "@/components/modals/due-chain-sheet";
import { VendorHistorySheet } from "@/components/modals/vendor-history-sheet";
import { FilteredTransactionList } from "@/components/transactions/filtered-transaction-list";
import { ExportOptionsModal } from "@/components/accounts/export-options-modal";
import { useTheme } from "@/hooks/use-theme";
import { useTransactionsScreen } from "@/hooks/use-transactions-screen";
import { useTranslation } from "@/hooks/use-translation";

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const {
    accountId,
    filters,
    exporting,
    exportingType,
    exportModalVisible,
    allTransactions,
    hasMorePages,
    loadingMore,
    isModalVisible,
    editingTransaction,
    payingDueTxn,
    returningLoanTxn,
    viewingChainFor,
    viewingVendorHistoryFor,
    viewingForHistoryFor,
    viewingAttachmentsFor,
    transactionsQuery,
    accountsQuery,
    categoriesQuery,
    accountOptions,
    modalCategoryOptions,
    categoryOptions,
    counterpartyOptions,
    vendorOptions,
    summaryTotals,
    totalTransactionCount,
    bookTransactionCount,
    hasActiveFilters,
    canEditTransactions,
    canExportData,
    isDeleteModeActive,
    isUpdating,
    setPayingDueTxn,
    setReturningLoanTxn,
    setViewingChainFor,
    setViewingVendorHistoryFor,
    setViewingForHistoryFor,
    setViewingAttachmentsFor,
    setExportModalVisible,
    handleEditTransaction,
    handleDeleteTransaction,
    handleAttachmentsPress,
    handleCategoryPress,
    handleCounterpartyPress,
    handleVendorPress,
    handleForPartyPress,
    handleViewHistory,
    handleViewForHistory,
    handlePaymentStatusPress,
    handleFilterChange,
    handleResetFilters,
    handleApplyFilters,
    handleLoadMore,
    openExportModal,
    handleExport,
    handleTransactionSubmit,
    handleRefresh,
    closeModal,
  } = useTransactionsScreen();

  const headerContent = useMemo(
    () => (
      <StatsCards
        totalDebit={summaryTotals.debit}
        totalCredit={summaryTotals.credit}
        transactionCount={
          hasActiveFilters || accountId
            ? totalTransactionCount
            : Math.max(totalTransactionCount, bookTransactionCount)
        }
        accountCount={accountsQuery.data?.length ?? 0}
        isLoading={transactionsQuery.isLoading}
      />
    ),
    [
      summaryTotals,
      totalTransactionCount,
      bookTransactionCount,
      hasActiveFilters,
      accountId,
      accountsQuery.data,
      transactionsQuery.isLoading,
    ],
  );

  const filterSection = useMemo(
    () => ({
      hasActiveFilters,
      showAccountField: !accountId,
      accounts: accountOptions,
      showTypeToggle: true,
      categories: categoryOptions,
      counterparties: counterpartyOptions,
      vendors: vendorOptions,
      onReset: handleResetFilters,
      onApplyFilters: handleApplyFilters,
    }),
    [
      hasActiveFilters,
      accountId,
      accountOptions,
      categoryOptions,
      counterpartyOptions,
      vendorOptions,
      handleResetFilters,
      handleApplyFilters,
    ],
  );

  const cardActions = useMemo(
    () => ({
      onCategoryPress: handleCategoryPress,
      onCounterpartyPress: handleCounterpartyPress,
      onVendorPress: handleVendorPress,
      onForPartyPress: handleForPartyPress,
      onViewHistory: handleViewHistory,
      onViewForHistory: handleViewForHistory,
      onPaymentStatusPress: handlePaymentStatusPress,
      onEdit: canEditTransactions ? handleEditTransaction : undefined,
      onDelete: isDeleteModeActive ? handleDeleteTransaction : undefined,
      onAttachmentsPress: handleAttachmentsPress,
      onPayDue: setPayingDueTxn,
      onReturnLoan: setReturningLoanTxn,
      onViewChain: setViewingChainFor,
    }),
    [
      handleCategoryPress,
      handleCounterpartyPress,
      handleVendorPress,
      handleForPartyPress,
      handleViewHistory,
      handleViewForHistory,
      handlePaymentStatusPress,
      canEditTransactions,
      handleEditTransaction,
      isDeleteModeActive,
      handleDeleteTransaction,
      handleAttachmentsPress,
      setPayingDueTxn,
      setReturningLoanTxn,
      setViewingChainFor,
    ],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title={t("transactions")}
        subtitle={accountId ? t("accountTransactions") : t("allTransactions")}
        icon="receipt"
        backgroundColor={colors.bg.primary}
        actionButton={
          canExportData
            ? {
                label: exporting ? t("exporting") : t("exportPdf"),
                onPress: openExportModal,
                icon: "document-text",
                color: "green",
              }
            : undefined
        }
      />

      <FilteredTransactionList
        transactions={allTransactions}
        filters={filters}
        onFilterChange={handleFilterChange}
        isLoading={transactionsQuery.isLoading}
        isRefetching={transactionsQuery.isRefetching}
        isFetching={transactionsQuery.isFetching}
        loadingMore={loadingMore}
        hasMorePages={hasMorePages}
        onLoadMore={handleLoadMore}
        onRefresh={handleRefresh}
        showSkeletonOnEmpty={false}
        headerContent={headerContent}
        filterSection={filterSection}
        emptyState={{
          icon: "receipt-outline",
          title: t("noTransactionsFound"),
          description: t("noTransactionsMatchFilters"),
        }}
        cardActions={cardActions}
      />

      <TransactionModal
        visible={isModalVisible}
        onClose={closeModal}
        onSubmit={handleTransactionSubmit}
        editingTransaction={editingTransaction}
        accountOptions={accountOptions}
        categoryOptions={modalCategoryOptions}
        counterpartyOptions={counterpartyOptions}
        vendorOptions={vendorOptions}
        isAccountsLoading={accountsQuery.isLoading}
        isCategoriesLoading={categoriesQuery.isLoading}
        isSubmitting={isUpdating}
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
        showByAccount={!accountId}
        showByFor
        hasDateFilter={Boolean(
          filters.from ||
            filters.to ||
            filters.startDate ||
            filters.endDate ||
            (filters.range && filters.range !== "all"),
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
          mode="vendor"
        />
      )}

      {viewingForHistoryFor && (
        <VendorHistorySheet
          visible={!!viewingForHistoryFor}
          onClose={() => setViewingForHistoryFor(null)}
          transaction={viewingForHistoryFor}
          mode="for_party"
        />
      )}
    </View>
  );
}
