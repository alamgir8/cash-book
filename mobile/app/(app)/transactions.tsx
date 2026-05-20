import { useCallback } from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { TransactionCard } from "@/components/transaction-card";
import { StatsCards } from "@/components/stats-cards";
import { TransactionModal } from "@/components/modals/transaction-modal";
import { AttachmentViewerModal } from "@/components/transactions/attachment-viewer-modal";
import { DuePaymentModal } from "@/components/modals/due-payment-modal";
import { DueChainSheet } from "@/components/modals/due-chain-sheet";
import type { Transaction } from "@/services/transactions";
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
    summaryTotals,
    totalTransactionCount,
    hasActiveFilters,
    canEditTransactions,
    canExportData,
    isDeleteModeActive,
    isUpdating,
    setPayingDueTxn,
    setViewingChainFor,
    setViewingAttachmentsFor,
    handleEditTransaction,
    handleDeleteTransaction,
    handleAttachmentsPress,
    handleCategoryPress,
    handleCounterpartyPress,
    handleVendorPress,
    handlePaymentStatusPress,
    handleFilterChange,
    handleResetFilters,
    handleLoadMore,
    handleExport,
    handleTransactionSubmit,
    handleRefresh,
    closeModal,
  } = useTransactionsScreen();

  const renderTransactionItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionCard
        transaction={item}
        onCategoryPress={handleCategoryPress}
        onCounterpartyPress={handleCounterpartyPress}
        onVendorPress={handleVendorPress}
        onPaymentStatusPress={handlePaymentStatusPress}
        onEdit={canEditTransactions ? handleEditTransaction : undefined}
        onDelete={isDeleteModeActive ? handleDeleteTransaction : undefined}
        onAttachmentsPress={handleAttachmentsPress}
        onPayDue={setPayingDueTxn}
        onViewChain={setViewingChainFor}
      />
    ),
    [
      handleCategoryPress,
      handleCounterpartyPress,
      handleVendorPress,
      handlePaymentStatusPress,
      handleEditTransaction,
      handleDeleteTransaction,
      canEditTransactions,
      isDeleteModeActive,
      handleAttachmentsPress,
      setPayingDueTxn,
      setViewingChainFor,
    ],
  );

  const renderHeader = () => (
    <View className="gap-6">
      <StatsCards
        totalDebit={summaryTotals.debit}
        totalCredit={summaryTotals.credit}
        transactionCount={totalTransactionCount}
        accountCount={accountsQuery.data?.length ?? 0}
        isLoading={transactionsQuery.isLoading}
      />
      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        hasActiveFilters={hasActiveFilters}
        showAccountField={!accountId}
        accounts={accountOptions}
        showTypeToggle={true}
        showCategoryField
        categories={categoryOptions}
        showCounterpartyField
        counterparties={counterpartyOptions}
        showVendorField
        vendors={vendorOptions}
        showPaymentStatusFilter
        onReset={handleResetFilters}
        onApplyFilters={() => transactionsQuery.refetch()}
      />
    </View>
  );

  const renderFooter = () => {
    if (!hasMorePages) {
      if (allTransactions.length > 0) {
        return (
          <View className="items-center py-6">
            <View
              className="rounded-full px-4 py-2"
              style={{ backgroundColor: colors.bg.tertiary }}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: colors.text.secondary }}
              >
                {t("allTransactionsLoaded")}
              </Text>
            </View>
          </View>
        );
      }
      return null;
    }

    if (loadingMore || (transactionsQuery.isFetching && filters.page !== 1)) {
      return (
        <View className="items-center py-6">
          <ActivityIndicator size="small" color={colors.info} />
          <Text
            className="text-sm mt-2"
            style={{ color: colors.text.secondary }}
          >
            {t("loadingMore")}
          </Text>
        </View>
      );
    }

    return (
      <View className="items-center py-6">
        <TouchableOpacity
          onPress={handleLoadMore}
          className="rounded-xl px-6 py-3 shadow-sm active:scale-95"
          style={{
            backgroundColor: colors.info,
            shadowColor: colors.info,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="arrow-down-circle" size={20} color="white" />
            <Text className="text-white font-semibold text-base">
              {t("loadMoreTransactions")}
            </Text>
          </View>
        </TouchableOpacity>
        <Text className="text-xs mt-2" style={{ color: colors.text.tertiary }}>
          {t("showing")} {allTransactions.length} {t("total")}
        </Text>
      </View>
    );
  };

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

      <FlatList
        data={allTransactions}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 20,
          gap: 16,
          paddingBottom: 120,
        }}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          !transactionsQuery.isLoading && allTransactions.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title={t("noTransactionsFound")}
              description={t("noTransactionsMatchFilters")}
            />
          ) : null
        }
        refreshing={transactionsQuery.isLoading && filters.page === 1}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
        renderItem={renderTransactionItem}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={20}
        windowSize={10}
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
          onSuccess={() => setPayingDueTxn(null)}
        />
      )}

      {viewingChainFor && (
        <DueChainSheet
          visible={!!viewingChainFor}
          onClose={() => setViewingChainFor(null)}
          transaction={viewingChainFor}
        />
      )}
    </View>
  );
}
