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
    summaryTotals,
    totalTransactionCount,
    hasActiveFilters,
    canEditTransactions,
    canExportData,
    isDeleteModeActive,
    isUpdating,
    setPayingDueTxn,
    setReturningLoanTxn,
    setViewingChainFor,
    setViewingVendorHistoryFor,
    setViewingAttachmentsFor,
    handleEditTransaction,
    handleDeleteTransaction,
    handleAttachmentsPress,
    handleCategoryPress,
    handleCounterpartyPress,
    handleVendorPress,
    handleForPartyPress,
    handleViewHistory,
    handlePaymentStatusPress,
    handleFilterChange,
    handleResetFilters,
    handleApplyFilters,
    handleLoadMore,
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
        transactionCount={totalTransactionCount}
        accountCount={accountsQuery.data?.length ?? 0}
        isLoading={transactionsQuery.isLoading}
      />
    ),
    [
      summaryTotals,
      totalTransactionCount,
      accountsQuery.data,
      transactionsQuery.isLoading,
    ],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title={t("transactions")}
        subtitle={accountId ? "Account transactions" : t("allTransactions")}
        icon="receipt"
        backgroundColor={colors.bg.primary}
        actionButton={
          canExportData
            ? {
                label: exporting ? t("exporting") : t("exportPdf"),
                onPress: handleExport,
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
        filterSection={{
          hasActiveFilters,
          showAccountField: !accountId,
          accounts: accountOptions,
          showTypeToggle: true,
          categories: categoryOptions,
          counterparties: counterpartyOptions,
          vendors: vendorOptions,
          onReset: handleResetFilters,
          onApplyFilters: handleApplyFilters,
        }}
        emptyState={{
          icon: "receipt-outline",
          title: t("noTransactionsFound"),
          description: t("noTransactionsMatchFilters"),
        }}
        cardActions={{
          onCategoryPress: handleCategoryPress,
          onCounterpartyPress: handleCounterpartyPress,
          onVendorPress: handleVendorPress,
          onForPartyPress: handleForPartyPress,
          onViewHistory: handleViewHistory,
          onPaymentStatusPress: handlePaymentStatusPress,
          onEdit: canEditTransactions ? handleEditTransaction : undefined,
          onDelete: isDeleteModeActive ? handleDeleteTransaction : undefined,
          onAttachmentsPress: handleAttachmentsPress,
          onPayDue: setPayingDueTxn,
          onReturnLoan: setReturningLoanTxn,
          onViewChain: setViewingChainFor,
        }}
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
