import { useCallback, useMemo, useState } from "react";
import { View, FlatList } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ScreenHeader } from "../../components/screen-header";
import { EmptyState } from "../../components/empty-state";
import { FilterBar } from "../../components/filter-bar";
import { TransactionCard } from "../../components/transaction-card";
import {
  fetchTransactions,
  type TransactionFilters,
} from "../../services/transactions";
import { useLocalSearchParams } from "expo-router";
import { fetchCategories } from "../../services/categories";
import { queryKeys } from "../../lib/queryKeys";
import type { SelectOption } from "../../components/searchable-select";

const defaultFilters: TransactionFilters = {
  range: "daily",
  page: 1,
  limit: 20,
};

export default function TransactionsScreen() {
  // Get accountId from search params - will be undefined if accessed directly from tab
  const searchParams = useLocalSearchParams<{ accountId?: string }>();
  const accountId = searchParams?.accountId;
  const [filters, setFilters] = useState<TransactionFilters>({
    ...defaultFilters,
    ...(accountId ? { accountId } : {}),
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories,
    queryFn: fetchCategories,
  });

  const categoryOptions: SelectOption[] = useMemo(() => {
    const categories = categoriesQuery.data ?? [];
    return categories.map((category) => ({
      value: category._id,
      label: category.name,
      subtitle: category.flow === "credit" ? "Credit" : "Debit",
      group: category.flow === "credit" ? "Credit" : "Debit",
    }));
  }, [categoriesQuery.data]);

  const transactionsQuery = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => fetchTransactions(filters),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const transactions = useMemo(() => {
    // Return empty array if no data or if there's an error
    if (!transactionsQuery.data) return [];
    return (transactionsQuery.data as any)?.transactions ?? [];
  }, [transactionsQuery.data]);

  const handleResetFilters = () => {
    const resetFilters: TransactionFilters = {
      ...defaultFilters,
      ...(accountId ? { accountId } : {}),
    };
    setFilters(resetFilters);
    transactionsQuery.refetch();
  };

  const handleCategoryPress = useCallback((categoryId?: string) => {
    setFilters((prev) => ({
      ...prev,
      categoryId: categoryId || undefined,
      page: 1,
    }));
  }, []);

  return (
    <View className="flex-1 bg-gray-50">
      <ScreenHeader
        title="Transactions"
        subtitle={accountId ? "Account transactions" : "All transactions"}
        icon="receipt"
      />

      {/* Filter Section */}
      <View className="px-4 py-3">
        <FilterBar
          filters={filters}
          onChange={(nextFilters) =>
            setFilters((prev) => ({ ...prev, ...nextFilters }))
          }
          showAccountField={!accountId}
          showTypeToggle={true}
          showCategoryField
          categories={categoryOptions}
          onReset={handleResetFilters}
          onApplyFilters={() => transactionsQuery.refetch()}
        />
      </View>

      {/* Transaction List */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TransactionCard
            transaction={item}
            onCategoryPress={handleCategoryPress}
          />
        )}
        contentContainerStyle={{
          padding: 16,
          gap: 8,
        }}
        // ListEmptyComponent={
        //   <EmptyState
        //     isLoading={transactionsQuery.isLoading}
        //     loadingText="Loading transactions..."
        //     icon="receipt-outline"
        //     title={
        //       accountId ? "No account transactions" : "No transactions found"
        //     }
        //     description={
        //       accountId
        //         ? "This account has no transactions yet"
        //         : "Start adding transactions to see them here or adjust your filters"
        //     }
        //   />
        // }
        refreshing={transactionsQuery.isFetching}
        onRefresh={() => transactionsQuery.refetch()}
      />
    </View>
  );
}
