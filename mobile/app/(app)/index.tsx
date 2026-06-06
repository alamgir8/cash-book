import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { FilterBar } from "@/components/filter-bar";
import { TransactionCard } from "@/components/transaction-card";
import { StatsCards } from "@/components/stats-cards";
import { HomeQuickFeatures } from "@/components/home-quick-features";
import { ScreenHeader } from "@/components/screen-header";
import { EmptyState } from "@/components/empty-state";
import { FloatingActionButton } from "@/components/floating-action-button";
import { TransactionModal } from "@/components/modals/transaction-modal";
import { AttachmentViewerModal } from "@/components/transactions/attachment-viewer-modal";
import { TransferModal } from "@/components/modals/transfer-modal";
import { DuePaymentModal } from "@/components/modals/due-payment-modal";
import { DueChainSheet } from "@/components/modals/due-chain-sheet";
import { VendorHistorySheet } from "@/components/modals/vendor-history-sheet";
import {
  StatsCardsSkeleton,
  QuickFeaturesSkeleton,
  TransactionListSkeleton,
} from "@/components/skeletons";
import { LoadMoreButton } from "@/components/load-more-button";
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
    categoryOptions,
    counterpartyOptions,
    vendorOptions,
    totals,
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
    resetTransactionList,
    openTransferModal,
    handleExportPdf,
    handleTransactionSubmit,
    handleTransferSubmit,
    closeModal,
    closeTransferModal,
    DEFAULT_FILTERS,
  } = useDashboard();

  const renderTransactionItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionCard
        transaction={item}
        onCategoryPress={handleCategoryFilter}
        onCounterpartyPress={handleCounterpartyFilter}
        onVendorPress={handleVendorFilter}
        onPartyPress={handleVendorFilter}
        onForPartyPress={handleForPartyFilter}
        onViewHistory={setViewingVendorHistoryFor}
        onPaymentStatusPress={handlePaymentStatusFilter}
        onEdit={handleEditTransaction}
        onDelete={isDeleteModeActive ? handleDeleteTransaction : undefined}
        onAttachmentsPress={handleAttachmentsPress}
        onPayDue={setPayingDueTxn}
        onViewChain={setViewingChainFor}
      />
    ),
    [
      handleCategoryFilter,
      handleCounterpartyFilter,
      handleVendorFilter,
      handleForPartyFilter,
      handlePaymentStatusFilter,
      handleEditTransaction,
      handleDeleteTransaction,
      isDeleteModeActive,
      handleAttachmentsPress,
      setPayingDueTxn,
      setViewingChainFor,
      setViewingVendorHistoryFor,
    ],
  );

  const handleFilterDue = useCallback(
    () => handlePaymentStatusFilter("due"),
    [handlePaymentStatusFilter],
  );
  const handleAddTransaction = useCallback(
    () => setModalVisible(true),
    [setModalVisible],
  );
  const handleApplyFilters = useCallback(
    () => transactionsQuery.refetch(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactionsQuery.refetch],
  );

  const renderHeader = useMemo(() => {
    const transactionCount =
      (transactionsQuery.data as any)?.pagination?.total ??
      allTransactions.length;
    const accountCount = accountsQuery.data?.length || 0;

    return (
      <View className="gap-6">
        {accountsQuery.isLoading || transactionsQuery.isLoading ? (
          <StatsCardsSkeleton />
        ) : (
          <StatsCards
            totalDebit={totals.debit}
            totalCredit={totals.credit}
            transactionCount={transactionCount}
            accountCount={accountCount}
            isLoading={false}
          />
        )}

        {accountsQuery.isLoading ? (
          <QuickFeaturesSkeleton />
        ) : (
          <HomeQuickFeatures
            onAddTransaction={handleAddTransaction}
            onAddTransfer={openTransferModal}
            onExportPDF={handleExportPdf}
            onFilterDue={handleFilterDue}
          />
        )}

        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          hasActiveFilters={hasActiveFilters}
          accounts={accountOptions}
          onApplyFilters={handleApplyFilters}
          onReset={handleResetFilters}
          showCategoryField
          categories={categoryOptions}
          showCounterpartyField
          counterparties={counterpartyOptions}
          showVendorField
          vendors={vendorOptions}
          showPaymentStatusFilter
        />
      </View>
    );
  }, [
    transactionsQuery.data,
    transactionsQuery.isLoading,
    accountsQuery.data,
    accountsQuery.isLoading,
    totals,
    filters,
    hasActiveFilters,
    accountOptions,
    categoryOptions,
    counterpartyOptions,
    vendorOptions,
    handleAddTransaction,
    openTransferModal,
    handleExportPdf,
    handleFilterDue,
    handleFilterChange,
    handleApplyFilters,
    handleResetFilters,
    allTransactions.length,
  ]);

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

      <FlatList
        data={allTransactions}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 20,
          gap: 16,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={
              transactionsQuery.isRefetching && (filters.page ?? 1) === 1
            }
            onRefresh={handleResetFilters}
            tintColor="#1d4ed8"
            colors={["#1d4ed8"]}
          />
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          transactionsQuery.isLoading ? (
            <TransactionListSkeleton count={8} />
          ) : (
            <EmptyState
              icon="receipt-outline"
              title={t("noTransactionsYet")}
              description={t("startTrackingDescription")}
              actionButton={{
                label: t("addTransaction"),
                onPress: () => setModalVisible(true),
              }}
            />
          )
        }
        ListFooterComponent={
          allTransactions.length > 0 ? (
            <LoadMoreButton
              onPress={handleLoadMore}
              isLoading={loadingMore}
              hasMore={hasMorePages}
              totalCount={allTransactions.length}
            />
          ) : null
        }
        renderItem={renderTransactionItem}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
      />

      {canCreateTransactions && (
        <FloatingActionButton
          onPress={() => {
            setModalVisible(true);
          }}
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
        categoryOptions={categoryOptions}
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
            resetTransactionList();
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
