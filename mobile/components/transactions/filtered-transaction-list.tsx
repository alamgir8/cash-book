import { useCallback, useMemo, type ReactNode } from "react";
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
  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionCard
        transaction={item}
        onCategoryPress={cardActions.onCategoryPress}
        onCounterpartyPress={cardActions.onCounterpartyPress}
        onVendorPress={cardActions.onVendorPress}
        onPartyPress={cardActions.onVendorPress}
        onForPartyPress={cardActions.onForPartyPress}
        onViewHistory={cardActions.onViewHistory}
        onPaymentStatusPress={cardActions.onPaymentStatusPress}
        onEdit={cardActions.onEdit}
        onDelete={cardActions.onDelete}
        onAttachmentsPress={cardActions.onAttachmentsPress}
        onPayDue={cardActions.onPayDue}
        onReturnLoan={cardActions.onReturnLoan}
        onViewChain={cardActions.onViewChain}
      />
    ),
    [cardActions],
  );

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

  const listFooter =
    transactions.length > 0 ? (
      <LoadMoreButton
        onPress={onLoadMore}
        isLoading={loadingMore}
        hasMore={hasMorePages}
        totalCount={transactions.length}
      />
    ) : null;

  const listEmpty =
    isLoading && showSkeletonOnEmpty ? (
      <TransactionListSkeleton count={skeletonCount} />
    ) : emptyState ? (
      <EmptyState
        icon={emptyState.icon ?? "receipt-outline"}
        title={emptyState.title}
        description={emptyState.description}
        actionButton={emptyState.actionButton}
      />
    ) : null;

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item._id}
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
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      initialNumToRender={10}
      windowSize={10}
    />
  );
}
