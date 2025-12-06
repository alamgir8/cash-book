import { useCallback, useMemo, useState, useEffect } from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../components/screen-header";
import { EmptyState } from "../../components/empty-state";
import { FilterBar } from "../../components/filter-bar";
import { TransactionCard } from "../../components/transaction-card";
import {
  fetchTransactions,
  type TransactionFilters,
} from "../../services/transactions";
import { exportTransactionsPdf } from "../../services/reports";
import { useLocalSearchParams } from "expo-router";
import { fetchCategories } from "../../services/categories";
import { queryKeys } from "../../lib/queryKeys";
import type { SelectOption } from "../../components/searchable-select";
import Toast from "react-native-toast-message";
const defaultFilters: TransactionFilters = {
  page: 1,
  limit: 20,
  // Removed financialScope to show ALL transactions regardless of category
};

export default function TransactionsScreen() {
  // Get accountId from search params - will be undefined if accessed directly from tab
  const searchParams = useLocalSearchParams<{ accountId?: string }>();
  const accountId = searchParams?.accountId;
  const [filters, setFilters] = useState<TransactionFilters>({
    ...defaultFilters,
    ...(accountId ? { accountId } : {}),
  });
  const [exporting, setExporting] = useState(false);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.all,
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

  // const transactionsQuery = useQuery({
  //   queryKey: ["transactions", filters],
  //   queryFn: () => fetchTransactions(filters),
  //   retry: false,
  //   refetchOnWindowFocus: false,
  // });

  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () => fetchTransactions(filters),
    placeholderData: (previousData) => previousData,
  });

  // Update accumulated transactions when new data arrives
  useEffect(() => {
    if (!transactionsQuery.data || transactionsQuery.isLoading) return;

    const freshData = (transactionsQuery.data as any)?.transactions ?? [];
    const pagination = (transactionsQuery.data as any)?.pagination;

    // console.log("📊 Pagination Info:", {
    //   currentPage: filters.page,
    //   totalPages: pagination?.pages,
    //   totalTransactions: pagination?.total,
    //   fetchedCount: freshData.length,
    //   hasMore: pagination ? pagination.page < pagination.pages : false,
    // });

    // If page is 1, replace all transactions (new search/filter)
    if (filters.page === 1) {
      setAllTransactions(freshData);
      if (pagination) {
        setHasMorePages(pagination.page < pagination.pages);
      }
      // console.log("✅ Page 1: Set", freshData.length, "transactions");
    }
    // If page > 1, append to existing transactions
    else if (filters.page && filters.page > 1) {
      setAllTransactions((prev) => {
        const existingIds = new Set(prev.map((t) => t._id));
        const newTransactions = freshData.filter(
          (t: any) => !existingIds.has(t._id)
        );
        // console.log(
        //   "✅ Page",
        //   filters.page,
        //   ": Added",
        //   newTransactions.length,
        //   "new transactions (total:",
        //   prev.length + newTransactions.length,
        //   ")"
        // );
        return [...prev, ...newTransactions];
      });

      if (pagination) {
        setHasMorePages(pagination.page < pagination.pages);
      }
      setLoadingMore(false);
    }
  }, [transactionsQuery.data, filters.page, transactionsQuery.isLoading]);

  const counterpartyOptions = useMemo(() => {
    const seen = new Set<string>();
    return allTransactions
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
  }, [allTransactions]);

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
    setAllTransactions([]);
    setHasMorePages(true);
    setFilters(resetFilters);
    transactionsQuery.refetch();
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMorePages || transactionsQuery.isFetching) return;

    setLoadingMore(true);
    setFilters((prev) => ({
      ...prev,
      page: (prev.page || 1) + 1,
    }));
  };

  const handleCategoryPress = useCallback((categoryId?: string) => {
    setAllTransactions([]);
    setHasMorePages(true);
    setFilters((prev) => ({
      ...prev,
      categoryId: categoryId || undefined,
      counterparty: undefined,
      page: 1,
    }));
  }, []);

  const handleCounterpartyPress = useCallback((counterparty?: string) => {
    setAllTransactions([]);
    setHasMorePages(true);
    setFilters((prev) => ({
      ...prev,
      counterparty: counterparty || undefined,
      categoryId: undefined,
      page: 1,
    }));
  }, []);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    try {
      setExporting(true);
      await exportTransactionsPdf(filters);
      Toast.show({ type: "success", text1: "PDF exported successfully" });
    } catch (error) {
      // console.error("Transactions export error", error);
      Toast.show({ type: "error", text1: "Failed to export PDF" });
    } finally {
      setExporting(false);
    }
  }, [exporting, filters]);

  const renderTransactionItem = useCallback(
    ({ item }: { item: any }) => (
      <TransactionCard
        transaction={item}
        onCategoryPress={handleCategoryPress}
        onCounterpartyPress={handleCounterpartyPress}
      />
    ),
    [handleCategoryPress, handleCounterpartyPress]
  );

  // console.log("transactions", transactions, "query", transactionsQuery.data);
  // console.log("transactionsQuery>>>>>", transactionsQuery.data);

  const renderHeader = () => {
    return (
      <View className="gap-6">
        {/* Filter Section */}
        <FilterBar
          filters={filters}
          onChange={(nextFilters) => {
            setAllTransactions([]);
            setHasMorePages(true);
            setFilters((prev) => ({ ...prev, ...nextFilters, page: 1 }));
          }}
          hasActiveFilters={hasActiveFilters}
          showAccountField={!accountId}
          showTypeToggle={true}
          showCategoryField
          categories={categoryOptions}
          showCounterpartyField
          counterparties={counterpartyOptions}
          showFinancialScopeToggle
          onReset={handleResetFilters}
          onApplyFilters={() => {
            setAllTransactions([]);
            setHasMorePages(true);
            setFilters((prev) => ({ ...prev, page: 1 }));
            transactionsQuery.refetch();
          }}
        />
      </View>
    );
  };

  const renderFooter = () => {
    if (!hasMorePages) {
      if (allTransactions.length > 0) {
        return (
          <View className="items-center py-6">
            <View className="bg-gray-100 rounded-full px-4 py-2">
              <Text className="text-gray-600 text-sm font-medium">
                ✓ All transactions loaded ({allTransactions.length} total)
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
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text className="text-gray-500 text-sm mt-2">Loading more...</Text>
        </View>
      );
    }

    return (
      <View className="items-center py-6">
        <TouchableOpacity
          onPress={handleLoadMore}
          className="bg-blue-500 rounded-xl px-6 py-3 shadow-sm active:scale-95"
          style={{
            shadowColor: "#3b82f6",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="arrow-down-circle" size={20} color="white" />
            <Text className="text-white font-semibold text-base">
              Load More Transactions
            </Text>
          </View>
        </TouchableOpacity>
        <Text className="text-gray-400 text-xs mt-2">
          Showing {allTransactions.length} transactions
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <ScreenHeader
        title="Transactions"
        subtitle={accountId ? "Account transactions" : "All transactions"}
        icon="receipt"
        actionButton={{
          label: exporting ? "Exporting..." : "Export PDF",
          onPress: handleExport,
          icon: "document-text",
          color: "green",
        }}
      />

      {/* Transaction List */}
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
              title="No transactions found"
              description="No transactions match your current filters"
            />
          ) : null
        }
        refreshing={transactionsQuery.isLoading && filters.page === 1}
        onRefresh={() => {
          setAllTransactions([]);
          setHasMorePages(true);
          setFilters((prev) => ({ ...prev, page: 1 }));
          transactionsQuery.refetch();
        }}
        showsVerticalScrollIndicator={false}
        renderItem={renderTransactionItem}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={20}
        windowSize={10}
      />
    </View>
  );
}
