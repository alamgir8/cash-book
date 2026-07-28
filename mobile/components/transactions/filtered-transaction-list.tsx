import { useCallback, useMemo, memo, type ReactNode } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { TransactionCard } from "@/components/transaction-card";
import { LoadMoreButton } from "@/components/load-more-button";
import { TransactionListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import {
  TransactionFilterSection,
  type TransactionFilterSectionProps,
} from "@/components/transactions/transaction-filter-section";
import type { Transaction } from "@/services/transactions";

export type TransactionCardActions = {
  onCategoryPress: (categoryName?: string) => void;
  onCounterpartyPress: (counterparty?: string) => void;
  onVendorPress: (partyName?: string) => void;
  onForPartyPress: (forPartyName?: string) => void;
  onPaymentStatusPress: (status?: "paid" | "due") => void;
  onViewHistory?: (transaction: Transaction) => void;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  onAttachmentsPress?: (transaction: Transaction) => void;
  onPayDue?: (transaction: Transaction) => void;
  onReturnLoan?: (transaction: Transaction) => void;
  onViewChain?: (transaction: Transaction) => void;
};

type EmptyStateConfig = {
  icon?: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
  title: string;
  description?: string;
  actionButton?: { label: string; onPress: () => void };
};

export type FilteredTransactionListProps = {
  transactions: Transaction[];
  filters: TransactionFilterSectionProps["filters"];
  filterSection: Omit<
    TransactionFilterSectionProps,
    "filters" | "onChange" | "isFetching" | "isLoading" | "loadingMore"
  >;
  onFilterChange: TransactionFilterSectionProps["onChange"];
  isLoading: boolean;
  isRefetching?: boolean;
  isFetching?: boolean;
  loadingMore?: boolean;
  hasMorePages: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
  cardActions: TransactionCardActions;
  /** Content rendered above the shared filter section (stats, account header, etc.). */
  headerContent?: ReactNode;
  emptyState?: EmptyStateConfig;
  showSkeletonOnEmpty?: boolean;
  skeletonCount?: number;
  contentPaddingBottom?: number;
  refreshTintColor?: string;
};

type RowProps = {
  item: Transaction;
  actions: TransactionCardActions;
};

const TransactionRow = memo(function TransactionRow({
  item,
  actions,
}: RowProps) {
  return (
    <TransactionCard
      transaction={item}
      onCategoryPress={actions.onCategoryPress}
      onCounterpartyPress={actions.onCounterpartyPress}
      onVendorPress={actions.onVendorPress}
      onPartyPress={actions.onVendorPress}
      onForPartyPress={actions.onForPartyPress}
      onViewHistory={actions.onViewHistory}
      onPaymentStatusPress={actions.onPaymentStatusPress}
      onEdit={actions.onEdit}
      onDelete={actions.onDelete}
      onAttachmentsPress={actions.onAttachmentsPress}
      onPayDue={actions.onPayDue}
      onReturnLoan={actions.onReturnLoan}
      onViewChain={actions.onViewChain}
    />
  );
});

export function FilteredTransactionList({
  transactions,
  filters,
  filterSection,
  onFilterChange,
  isLoading,
  isRefetching = false,
  isFetching = false,
  loadingMore = false,
  hasMorePages,
  onLoadMore,
  onRefresh,
  cardActions,
  headerContent,
  emptyState,
  showSkeletonOnEmpty = true,
  skeletonCount = 8,
  contentPaddingBottom = 120,
  refreshTintColor = "#1d4ed8",
}: FilteredTransactionListProps) {
  // Keep a stable actions ref so FlatList renderItem identity stays fixed
  const actionsRef = useMemo(() => cardActions, [
    cardActions.onCategoryPress,
    cardActions.onCounterpartyPress,
    cardActions.onVendorPress,
    cardActions.onForPartyPress,
    cardActions.onPaymentStatusPress,
    cardActions.onViewHistory,
    cardActions.onEdit,
    cardActions.onDelete,
    cardActions.onAttachmentsPress,
    cardActions.onPayDue,
    cardActions.onReturnLoan,
    cardActions.onViewChain,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionRow item={item} actions={actionsRef} />
    ),
    [actionsRef],
  );

  const keyExtractor = useCallback((item: Transaction) => item._id, []);

  const listHeader = useMemo(
    () => (
      <View className="gap-6">
        {headerContent}
        <TransactionFilterSection
          filters={filters}
          onChange={onFilterChange}
          isFetching={isFetching}
          isLoading={isLoading}
          loadingMore={loadingMore}
          {...filterSection}
        />
      </View>
    ),
    [
      headerContent,
      filters,
      onFilterChange,
      isFetching,
      isLoading,
      loadingMore,
      filterSection,
    ],
  );

  const listFooter = useMemo(
    () =>
      transactions.length > 0 ? (
        <LoadMoreButton
          onPress={onLoadMore}
          isLoading={loadingMore}
          hasMore={hasMorePages}
          totalCount={transactions.length}
        />
      ) : null,
    [transactions.length, onLoadMore, loadingMore, hasMorePages],
  );

  const listEmpty = useMemo(
    () =>
      isLoading && showSkeletonOnEmpty ? (
        <TransactionListSkeleton count={skeletonCount} />
      ) : emptyState ? (
        <EmptyState
          icon={emptyState.icon ?? "receipt-outline"}
          title={emptyState.title}
          description={emptyState.description}
          actionButton={emptyState.actionButton}
        />
      ) : null,
    [isLoading, showSkeletonOnEmpty, skeletonCount, emptyState],
  );

  return (
    <FlatList
      data={transactions}
      keyExtractor={keyExtractor}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingVertical: 20,
        gap: 16,
        paddingBottom: contentPaddingBottom,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching && (filters.page ?? 1) === 1}
          onRefresh={onRefresh}
          tintColor={refreshTintColor}
          colors={[refreshTintColor]}
        />
      }
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      ListFooterComponent={listFooter}
      renderItem={renderItem}
      removeClippedSubviews
      maxToRenderPerBatch={6}
      updateCellsBatchingPeriod={80}
      initialNumToRender={6}
      windowSize={5}
      // Faster tap response while scrolling is settling
      keyboardShouldPersistTaps="handled"
      // Avoid huge synchronous commits when filters change
      disableIntervalMomentum
    />
  );
}
