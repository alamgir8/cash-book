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
import { FilterBar } from "@/components/filter-bar";
import { TransactionCard } from "@/components/transaction-card";
import {
  AccountHeader,
  AccountActions,
  AccountSummaryCard,
  AccountLoadMoreFooter,
  AccountEmptyState,
} from "@/components/accounts";
import { exportTransactionsPdf } from "@/services/reports";
import { fetchCategories } from "@/services/categories";
import {
  fetchCounterparties,
  type TransactionFilters,
} from "@/services/transactions";
import { queryKeys } from "@/lib/queryKeys";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { useAccountDetail, useAccountTransactions } from "@/hooks/use-accounts";
import { calculateAccountNetFlow } from "@/lib/account-utils";
import type { SelectOption } from "@/components/searchable-select";

const defaultFilters: TransactionFilters = {
  page: 1,
  limit: 50,
};

export default function AccountDetailScreen() {
  const { formatAmount } = usePreferences();
  const router = useRouter();
  const { colors } = useTheme();
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

  // Use custom hooks
  const detailQuery = useAccountDetail(accountId!);
  const transactionsQuery = useAccountTransactions(accountId!, filters);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => fetchCategories(),
  });

  const counterpartiesQuery = useQuery({
    queryKey: queryKeys.counterparties,
    queryFn: () => fetchCounterparties(),
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

  const counterpartyOptions: SelectOption[] = useMemo(() => {
    const apiCounterparties = counterpartiesQuery.data ?? [];
    const txnCounterparties = allTransactions
      .map((txn) => txn.counterparty?.trim())
      .filter((name): name is string => Boolean(name));
    const allCounterparties = [
      ...new Set([...apiCounterparties, ...txnCounterparties]),
    ];
    return allCounterparties
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map((name) => ({ value: name, label: name }));
  }, [counterpartiesQuery.data, allTransactions]);

  // Update accumulated transactions when new data arrives
  useEffect(() => {
    if (!transactionsQuery.data || transactionsQuery.isLoading) return;

    const freshData = (transactionsQuery.data as any)?.transactions ?? [];
    const pagination = (transactionsQuery.data as any)?.pagination;

    if (filters.page === 1) {
      setAllTransactions(freshData);
      if (pagination) {
        setHasMorePages(pagination.page < pagination.pages);
      }
    } else if (filters.page && filters.page > 1) {
      setAllTransactions((prev) => {
        const existingIds = new Set(prev.map((t) => t._id));
        const newTransactions = freshData.filter(
          (t: any) => !existingIds.has(t._id),
        );
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

  const netFlow = useMemo(
    () => calculateAccountNetFlow(summary?.totalCredit, summary?.totalDebit),
    [summary],
  );

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

  const handleEdit = () => {
    router.push({
      pathname: "/(app)/accounts",
      params: { accountId },
    });
  };

  if (!accountId) {
    return (
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: colors.bg.primary }}
      >
        <Text className="text-base" style={{ color: colors.text.secondary }}>
          Account not found. Please go back and try again.
        </Text>
      </View>
    );
  }

  if (detailQuery.isLoading && !detailQuery.data) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: colors.bg.primary }}
      >
        <ActivityIndicator color={colors.info} size="large" />
      </View>
    );
  }

  const lastActivityLabel = summary?.lastTransactionDate
    ? dayjs(summary.lastTransactionDate).format("MMM D, YYYY")
    : "No activity yet";

  const renderHeader = () => {
    return (
      <View className="gap-4">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full border items-center justify-center"
            style={{
              backgroundColor: colors.bg.secondary,
              borderColor: colors.border,
            }}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={colors.text.primary}
            />
          </TouchableOpacity>
          <Text
            className="text-2xl font-bold"
            style={{ color: colors.text.primary }}
          >
            {account?.name ?? "Account"}
          </Text>
        </View>

        <AccountHeader
          account={account!}
          lastActivityLabel={lastActivityLabel}
          formatAmount={formatAmount}
        />

        <AccountActions
          onEdit={handleEdit}
          onExport={handleExport}
          exporting={exporting}
        />

        {summary && (
          <AccountSummaryCard
            summary={summary}
            netFlow={netFlow}
            formatAmount={formatAmount}
          />
        )}

        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
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
        ListFooterComponent={
          <AccountLoadMoreFooter
            hasMorePages={hasMorePages}
            loadingMore={loadingMore}
            isFetching={transactionsQuery.isFetching && filters.page !== 1}
            totalTransactions={allTransactions.length}
            onLoadMore={handleLoadMore}
          />
        }
        ListEmptyComponent={
          <AccountEmptyState isLoading={transactionsQuery.isLoading} />
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
