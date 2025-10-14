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
  financialScope: "actual",
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
    queryFn: () => fetchCategories(),
  });

  const categoryOptions: SelectOption[] = useMemo(() => {
    const categories = (categoriesQuery.data ?? []) as {
      _id: string;
      name: string;
      flow: string;
    }[];
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

  const counterpartyOptions = useMemo(() => {
    const seen = new Set<string>();
    return transactions
      .map((txn) => txn.counterparty?.trim())
      .filter((name): name is string => Boolean(name))
      .filter((name) => {
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((name) => ({ value: name, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [transactions]);

  const hasActiveFilters = useMemo(() => {
    if (filters.range && filters.range !== defaultFilters.range) {
      return true;
    }
    const keys: (keyof TransactionFilters)[] = [
      "accountId",
      "categoryId",
      "counterparty",
      "financialScope",
      "type",
      "search",
      "accountName",
      "startDate",
      "endDate",
      "from",
      "to",
      "minAmount",
      "maxAmount",
      "includeDeleted",
    ];
    return keys.some((key) => {
      const value = filters[key];
      const defaultValue = defaultFilters[key];
      if (typeof value === "number") {
        return value !== undefined && value !== defaultValue;
      }
      if (typeof value === "boolean") {
        return value !== undefined && value !== defaultValue;
      }
      return value !== undefined && value !== "" && value !== defaultValue;
    });
  }, [filters]);

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
      counterparty: undefined,
      page: 1,
    }));
  }, []);

  const handleCounterpartyPress = useCallback((counterparty?: string) => {
    setFilters((prev) => ({
      ...prev,
      counterparty: counterparty || undefined,
      categoryId: undefined,
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
          hasActiveFilters={hasActiveFilters}
          showAccountField={!accountId}
          showTypeToggle={true}
          showCategoryField
          categories={categoryOptions}
          showCounterpartyField
          counterparties={counterpartyOptions}
          showFinancialScopeToggle
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
            onCounterpartyPress={handleCounterpartyPress}
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
