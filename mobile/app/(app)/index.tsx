import { useMemo, useState } from "react";
import { View } from "react-native";
import { StatsCards } from "@/components/stats-cards";
import { HomeQuickFeatures } from "@/components/home-quick-features";
import { ScreenHeader } from "@/components/screen-header";
import { FloatingActionButton } from "@/components/floating-action-button";
import { TransactionModal } from "@/components/modals/transaction-modal";
import { AttachmentViewerModal } from "@/components/transactions/attachment-viewer-modal";
import { TransferModal } from "@/components/modals/transfer-modal";
import { DuePaymentModal } from "@/components/modals/due-payment-modal";
import { DueChainSheet } from "@/components/modals/due-chain-sheet";
import { VendorHistorySheet } from "@/components/modals/vendor-history-sheet";
import { FilteredTransactionList } from "@/components/transactions/filtered-transaction-list";
import {
  StatsCardsSkeleton,
  QuickFeaturesSkeleton,
} from "@/components/skeletons";
import type { Transaction } from "@/services/transactions";
import { useTheme } from "@/hooks/use-theme";
import { useDashboard } from "@/hooks/use-dashboard";
import { useTranslation } from "@/hooks/use-translation";

export default function DashboardScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [viewingVendorHistoryFor, setViewingVendorHistoryFor] =
    useState<Transaction | null>(null);

  const {
    filters,
    allTransactions,
    hasMorePages,
    loadingMore,
    isModalVisible,
    isTransferModalVisible,
    editingTransaction,
    payingDueTxn,
    viewingChainFor,
    viewingAttachmentsFor,
    transactionsQuery,
    accountsQuery,
    categoriesQuery,
    accountOptions,
    modalCategoryOptions,
    categoryOptions,
    counterpartyOptions,
    vendorOptions,
    totals,
    totalTransactionCount,
    hasActiveFilters,
    canCreateTransactions,
    canEditTransactions,
    activeOrganization,
    isDeleteModeActive,
    isSubmitting,
    isTransferSubmitting,
    setPayingDueTxn,
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
  } = useDashboard();

  const headerContent = useMemo(
    () => (
      <>
        {accountsQuery.isLoading || transactionsQuery.isLoading ? (
          <StatsCardsSkeleton />
        ) : (
          <StatsCards
            totalDebit={totals.debit}
            totalCredit={totals.credit}
            transactionCount={totalTransactionCount}
            accountCount={accountsQuery.data?.length ?? 0}
            isLoading={false}
          />
        )}

        {accountsQuery.isLoading ? (
          <QuickFeaturesSkeleton />
        ) : (
          <HomeQuickFeatures
            onAddTransaction={() => setModalVisible(true)}
            onAddTransfer={openTransferModal}
            onExportPDF={handleExportPdf}
            onFilterDue={() => handlePaymentStatusFilter("due")}
          />
        )}
      </>
    ),
    [
      accountsQuery.isLoading,
      accountsQuery.data,
      transactionsQuery.isLoading,
      totals,
      totalTransactionCount,
      setModalVisible,
      openTransferModal,
      handleExportPdf,
      handlePaymentStatusFilter,
    ],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.secondary }}>
      <ScreenHeader
        title={t("dashboard")}
        subtitle={
          activeOrganization
            ? `${activeOrganization.name} · ${
                activeOrganization.role.charAt(0).toUpperCase() +
                activeOrganization.role.slice(1)
              }`
            : t("trackFinancesEasily")
        }
        icon="analytics"
        backgroundColor={colors.bg.primary}
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
        headerContent={headerContent}
        filterSection={{
          hasActiveFilters,
          accounts: accountOptions,
          onReset: handleResetFilters,
          onApplyFilters: handleApplyFilters,
          categories: categoryOptions,
          counterparties: counterpartyOptions,
          vendors: vendorOptions,
        }}
        emptyState={{
          icon: "receipt-outline",
          title: t("noTransactionsYet"),
          description: t("startTrackingDescription"),
          actionButton: {
            label: t("addTransaction"),
            onPress: () => setModalVisible(true),
          },
        }}
        cardActions={{
          onCategoryPress: handleCategoryFilter,
          onCounterpartyPress: handleCounterpartyFilter,
          onVendorPress: handleVendorFilter,
          onForPartyPress: handleForPartyFilter,
          onViewHistory: setViewingVendorHistoryFor,
          onPaymentStatusPress: handlePaymentStatusFilter,
          onEdit: handleEditTransaction,
          onDelete: isDeleteModeActive ? handleDeleteTransaction : undefined,
          onAttachmentsPress: handleAttachmentsPress,
          onPayDue: setPayingDueTxn,
          onViewChain: setViewingChainFor,
        }}
      />

      {canCreateTransactions && (
        <FloatingActionButton
          onPress={() => setModalVisible(true)}
          icon="add"
          position="bottom-right"
        />
      )}

      <TransactionModal
        visible={isModalVisible}
        onClose={closeModal}
        onSubmit={handleTransactionSubmit}
        editingTransaction={editingTransaction}
        accountOptions={accountOptions}
        categoryOptions={modalCategoryOptions}
        counterpartyOptions={counterpartyOptions}
        isAccountsLoading={accountsQuery.isLoading}
        isCategoriesLoading={categoriesQuery.isLoading}
        isSubmitting={isSubmitting}
      />

      <TransferModal
        visible={isTransferModalVisible}
        onClose={closeTransferModal}
        onSubmit={handleTransferSubmit}
        accountOptions={accountOptions}
        counterpartyOptions={counterpartyOptions}
        isAccountsLoading={accountsQuery.isLoading}
        isSubmitting={isTransferSubmitting}
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
