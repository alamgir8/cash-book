import { useCallback, useMemo, useState, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import Toast from "react-native-toast-message";
import { FilterBar } from "../../../components/filter-bar";
import { TransactionCard } from "../../../components/transaction-card";
import { exportTransactionsPdf } from "../../../services/reports";
import {
  fetchAccountDetail,
  fetchAccountTransactions,
} from "../../../services/accounts";
import { fetchCategories } from "../../../services/categories";
import { queryKeys } from "../../../lib/queryKeys";
import type { TransactionFilters } from "../../../services/transactions";
import { usePreferences } from "@/hooks/usePreferences";
import type { SelectOption } from "../../../components/searchable-select";

const defaultFilters: TransactionFilters = {
  page: 1,
  limit: 20,
  // Removed financialScope to show ALL transactions regardless of category
};

export default function AccountDetailScreen() {
  const { formatAmount: prefFormatAmount } = usePreferences();
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const accountId = Array.isArray(params.accountId)
    ? params.accountId[0]
    : params.accountId;

  const [filters, setFilters] = useState<TransactionFilters>({
    ...defaultFilters,
    ...(accountId ? { accountId } : {}),
  });
  const [exporting, setExporting] = useState(false);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => fetchCategories(),
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

  const detailQuery = useQuery({
    queryKey: accountId
      ? queryKeys.accountDetail(accountId)
      : ["account", "detail"],
    queryFn: () => fetchAccountDetail(accountId!),
    enabled: Boolean(accountId),
  });

  const transactionsQuery = useQuery({
    queryKey: accountId
      ? queryKeys.accountTransactions(accountId, filters)
      : ["account", "transactions"],
    queryFn: () => fetchAccountTransactions(accountId!, filters),
    enabled: Boolean(accountId),
  });

  // console.log("Account Detail:", detailQuery.data);
  // console.log("Account Summary:", transactionsQuery.data);

  // Update accumulated transactions when new data arrives
  useEffect(() => {
    if (!transactionsQuery.data || transactionsQuery.isLoading) return;

    const freshData = (transactionsQuery.data as any)?.transactions ?? [];
    const pagination = (transactionsQuery.data as any)?.pagination;

    // console.log("📊 Account Pagination Info:", {
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
      // console.log("✅ Account Page 1: Set", freshData.length, "transactions");
    }
    // If page > 1, append to existing transactions
    else if (filters.page && filters.page > 1) {
      setAllTransactions((prev) => {
        const existingIds = new Set(prev.map((t) => t._id));
        const newTransactions = freshData.filter(
          (t: any) => !existingIds.has(t._id)
        );
        // console.log(
        //   "✅ Account Page",
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

  const account = detailQuery.data?.account;
  const summary = detailQuery.data?.summary;

  const netFlow = useMemo(() => summary?.net ?? 0, [summary]);

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

  const handleFilterChange = (next: TransactionFilters) => {
    setAllTransactions([]);
    setHasMorePages(true);
    setFilters((prev) => ({
      ...prev,
      ...next,
      page: 1,
      limit: next.limit ?? prev.limit,
    }));
  };

  const handleResetFilters = () => {
    setAllTransactions([]);
    setHasMorePages(true);
    setFilters({
      ...defaultFilters,
      ...(accountId ? { accountId } : {}),
    });
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMorePages || transactionsQuery.isFetching) return;

    setLoadingMore(true);
    setFilters((prev) => ({
      ...prev,
      page: (prev.page || 1) + 1,
    }));
  };

  const handleCategoryFilter = useCallback((categoryId?: string) => {
    setAllTransactions([]);
    setHasMorePages(true);
    setFilters((prev) => ({
      ...prev,
      categoryId: categoryId || undefined,
      counterparty: undefined,
      page: 1,
    }));
  }, []);

  const handleCounterpartyFilter = useCallback((counterparty?: string) => {
    setAllTransactions([]);
    setHasMorePages(true);
    setFilters((prev) => ({
      ...prev,
      counterparty: counterparty || undefined,
      categoryId: undefined,
      page: 1,
    }));
  }, []);

  const handleExport = async () => {
    if (!accountId) return;
    try {
      setExporting(true);
      await exportTransactionsPdf({ ...filters, accountId });
      Toast.show({ type: "success", text1: "PDF exported successfully" });
    } catch (error) {
      // console.error(error);
      Toast.show({ type: "error", text1: "Failed to export PDF" });
    } finally {
      setExporting(false);
    }
  };

  const handleRefresh = () => {
    setAllTransactions([]);
    setHasMorePages(true);
    setFilters((prev) => ({ ...prev, page: 1 }));
    detailQuery.refetch();
    transactionsQuery.refetch();
  };

  if (!accountId) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Text className="text-gray-500 text-base">
          Account not found. Please go back and try again.
        </Text>
      </View>
    );
  }

  if (detailQuery.isLoading && !detailQuery.data) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  const lastActivityLabel = summary?.lastTransactionDate
    ? dayjs(summary.lastTransactionDate).format("MMM D, YYYY")
    : "No activity yet";
  const netPositive = netFlow >= 0;

  const renderHeader = () => (
    <View className="gap-4">
      <View className="flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-white border border-slate-200 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={20} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900">
          {account?.name ?? "Account"}
        </Text>
      </View>

      <View className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-4">
            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-gray-500">
                Last activity: {lastActivityLabel}
              </Text>
            </View>
            {account?.description ? (
              <Text className="text-gray-600 text-sm mt-3 leading-5">
                {account.description}
              </Text>
            ) : null}
          </View>
          <View className="items-end">
            <Text className="text-gray-500 text-xs font-semibold uppercase">
              Balance
            </Text>
            <Text
              className={`text-3xl font-bold ${
                (account?.balance ?? 0) >= 0
                  ? "text-emerald-600"
                  : "text-rose-600"
              }`}
            >
              {prefFormatAmount(Math.abs(account?.balance ?? 0))}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3 mt-4">
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(app)/accounts",
                params: { accountId },
              })
            }
            className="flex-1 flex-row items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 bg-gray-50 active:bg-gray-100"
          >
            <Ionicons name="pencil" size={18} color="#334155" />
            <Text className="text-gray-700 font-semibold">Edit Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleExport}
            disabled={exporting}
            className="flex-1 flex-row items-center justify-center gap-2 bg-blue-500 rounded-xl py-2.5 active:opacity-90"
          >
            <Ionicons
              name={exporting ? "cloud-download" : "document-text-outline"}
              size={18}
              color="#fff"
            />
            <Text className="text-white font-semibold">
              {exporting ? "Exporting..." : "Export PDF"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <Text className="text-gray-900 font-bold text-lg mb-4">
          Account Summary
        </Text>
        <View className="flex-row gap-3">
          <View className="flex-1 bg-blue-50 rounded-xl p-3 border border-blue-100">
            <Text className="text-xs font-semibold text-blue-600 uppercase">
              Total Credit
            </Text>
            <Text className="text-xl font-bold text-blue-700 mt-1">
              {prefFormatAmount(summary?.totalCredit ?? 0)}
            </Text>
          </View>
          <View className="flex-1 bg-amber-50 rounded-xl p-3 border border-amber-100">
            <Text className="text-xs font-semibold text-amber-600 uppercase">
              Total Debit
            </Text>
            <Text className="text-xl font-bold text-amber-700 mt-1">
              {prefFormatAmount(summary?.totalDebit ?? 0)}
            </Text>
          </View>
        </View>
        <View className="flex-row gap-3 mt-3">
          <View
            className={`flex-1 rounded-xl p-3 border ${
              netPositive
                ? "bg-emerald-50 border-emerald-100"
                : "bg-rose-50 border-rose-100"
            }`}
          >
            <Text
              className={`text-xs font-semibold uppercase ${
                netPositive ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              Net Flow
            </Text>
            <Text
              className={`text-xl font-bold mt-1 ${
                netPositive ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {`${netPositive ? "+" : "-"}${prefFormatAmount(
                Math.abs(netFlow)
              )}`}
            </Text>
          </View>
          <View className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-200">
            <Text className="text-xs font-semibold text-gray-600 uppercase">
              Transactions
            </Text>
            <Text className="text-xl font-bold text-gray-700 mt-1">
              {summary?.totalTransactions ?? 0}
            </Text>
          </View>
        </View>
      </View>

      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        showFinancialScopeToggle
        hasActiveFilters={hasActiveFilters}
        showAccountField={false}
        showTypeToggle
        showCategoryField
        categories={categoryOptions}
        showCounterpartyField
        counterparties={counterpartyOptions}
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
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={allTransactions}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          gap: 16,
          paddingBottom: 80,
        }}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          transactionsQuery.isLoading ? (
            <ActivityIndicator color="#3b82f6" style={{ marginTop: 48 }} />
          ) : (
            <View className="items-center gap-3 bg-white rounded-2xl p-6 border border-gray-100 mt-6">
              <Ionicons
                name="document-text-outline"
                size={36}
                color="#94a3b8"
              />
              <Text className="text-gray-700 font-semibold">
                No transactions matching filters
              </Text>
              <Text className="text-gray-500 text-sm text-center">
                Adjust the filters or record a new transaction from the
                dashboard.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(app)")}
                className="px-4 py-2 rounded-full bg-blue-500 active:opacity-90"
              >
                <Text className="text-white font-semibold text-sm">
                  Go to Dashboard
                </Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TransactionCard
            transaction={item}
            onCategoryPress={handleCategoryFilter}
            onCounterpartyPress={handleCounterpartyFilter}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={transactionsQuery.isRefetching && filters.page === 1}
            onRefresh={handleRefresh}
            tintColor="#3b82f6"
          />
        }
      />
    </View>
  );
}
