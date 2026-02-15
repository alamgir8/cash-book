import { useCallback, useMemo, useState, useEffect } from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { TransactionCard } from "@/components/transaction-card";
import { TransactionModal } from "@/components/modals/transaction-modal";
import type { TransactionFormValues } from "@/components/modals/types";
import {
  fetchTransactions,
  fetchCounterparties,
  updateTransaction,
  type Transaction,
  type TransactionFilters,
} from "@/services/transactions";
import { exportTransactionsPdf } from "@/services/reports";
import { useLocalSearchParams } from "expo-router";
import { fetchCategories } from "@/services/categories";
import { fetchAccounts } from "@/services/accounts";
import { queryKeys } from "@/lib/queryKeys";
import { useOrganization } from "@/hooks/useOrganization";
import { useTheme } from "@/hooks/useTheme";
import type { SelectOption } from "@/components/searchable-select";
import Toast from "react-native-toast-message";
const defaultFilters: TransactionFilters = {
  page: 1,
  limit: 20,
  // Removed financialScope to show ALL transactions regardless of category
};

const formatCategoryGroup = (type?: string) => {
  if (!type) return "Other";
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
};

export default function TransactionsScreen() {
  // Get accountId from search params - will be undefined if accessed directly from tab
  const searchParams = useLocalSearchParams<{ accountId?: string }>();
  const accountId = searchParams?.accountId;
  const queryClient = useQueryClient();
  const { hasPermission } = useOrganization();
  const canEditTransactions = hasPermission("edit_transactions");
  const canDeleteTransactions = hasPermission("delete_transactions");
  const canExportData = hasPermission("export_data");
  const [filters, setFilters] = useState<TransactionFilters>({
    ...defaultFilters,
    ...(accountId ? { accountId } : {}),
  });
  const [exporting, setExporting] = useState(false);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: fetchAccounts,
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => fetchCategories(),
  });

  const counterpartiesQuery = useQuery({
    queryKey: queryKeys.counterparties,
    queryFn: () => fetchCounterparties(),
  });

  const updateMutation = useMutation({
    mutationFn: updateTransaction,
    onSuccess: async (updatedTransaction) => {
      // Update local transactions list immediately
      setAllTransactions((prev) =>
        prev.map((t) =>
          t._id === editingTransaction?._id
            ? { ...t, ...updatedTransaction }
            : t,
        ),
      );

      await Promise.all([
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === "transactions",
        }),
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === "accounts",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.counterparties,
        }),
      ]);
      setModalVisible(false);
      setEditingTransaction(null);
      Toast.show({ type: "success", text1: "Transaction updated" });
    },
    onError: () => {
      Toast.show({
        type: "error",
        text1: "Error updating transaction",
        text2: "Please try again.",
      });
    },
  });

  const accountOptions: SelectOption[] = useMemo(() => {
    const accounts = (accountsQuery.data ?? []) as {
      _id: string;
      name: string;
      kind: string;
    }[];
    return accounts.map((account) => ({
      value: account._id,
      label: account.name,
      subtitle: account.kind?.replace(/_/g, " "),
    }));
  }, [accountsQuery.data]);

  const modalCategoryOptions: SelectOption[] = useMemo(() => {
    const categories = (categoriesQuery.data ?? []) as {
      _id: string;
      name: string;
      flow: string;
      type: string;
    }[];
    return [
      { value: "", label: "No category" },
      ...categories.map((category) => ({
        value: category._id,
        label: category.name,
        group: formatCategoryGroup(category.type),
        flow: category.flow,
      })),
    ];
  }, [categoriesQuery.data]);

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
          (t: any) => !existingIds.has(t._id),
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

  // Combine API counterparties with counterparties from loaded transactions
  const counterpartyOptions: SelectOption[] = useMemo(() => {
    const apiCounterparties = counterpartiesQuery.data ?? [];

    // Also extract from current transactions as fallback
    const txnCounterparties = allTransactions
      .map((txn) => txn.counterparty?.trim())
      .filter((name): name is string => Boolean(name));

    // Also include the editing transaction's counterparty if it exists
    const editingCounterparty = editingTransaction?.counterparty?.trim();

    // Merge and deduplicate
    const allCounterparties = [
      ...new Set([
        ...apiCounterparties,
        ...txnCounterparties,
        ...(editingCounterparty ? [editingCounterparty] : []),
      ]),
    ];

    return allCounterparties
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map((name) => ({ value: name, label: name }));
  }, [counterpartiesQuery.data, allTransactions, editingTransaction]);

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
    } catch {
      Toast.show({ type: "error", text1: "Failed to export PDF" });
    } finally {
      setExporting(false);
    }
  }, [exporting, filters]);

  const handleEditTransaction = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingTransaction(null);
  }, []);

  const handleTransactionSubmit = async (values: TransactionFormValues) => {
    if (!editingTransaction) return;

    const payload = {
      ...values,
      amount: Number(values.amount),
      date: values.date?.trim() ? values.date.trim() : undefined,
      description: values.description?.trim()
        ? values.description.trim()
        : undefined,
      comment: values.comment?.trim() ? values.comment.trim() : undefined,
      categoryId: values.categoryId ? values.categoryId : undefined,
      counterparty: values.counterparty?.trim()
        ? values.counterparty.trim()
        : undefined,
    };

    await updateMutation.mutateAsync({
      transactionId: editingTransaction._id,
      ...payload,
    } as any);
  };

  const renderTransactionItem = useCallback(
    ({ item }: { item: any }) => (
      <TransactionCard
        transaction={item}
        onCategoryPress={handleCategoryPress}
        onCounterpartyPress={handleCounterpartyPress}
        onEdit={canEditTransactions ? handleEditTransaction : undefined}
      />
    ),
    [
      handleCategoryPress,
      handleCounterpartyPress,
      handleEditTransaction,
      canEditTransactions,
    ],
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

  const { colors } = useTheme();

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
          <ActivityIndicator size="small" color={colors.info} />
          <Text
            className="text-sm mt-2"
            style={{ color: colors.text.secondary }}
          >
            Loading more...
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
              Load More Transactions
            </Text>
          </View>
        </TouchableOpacity>
        <Text className="text-xs mt-2" style={{ color: colors.text.tertiary }}>
          Showing {allTransactions.length} transactions
        </Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title="Transactions"
        subtitle={accountId ? "Account transactions" : "All transactions"}
        icon="receipt"
        backgroundColor={colors.bg.secondary}
        actionButton={
          canExportData
            ? {
                label: exporting ? "Exporting..." : "Export PDF",
                onPress: handleExport,
                icon: "document-text",
                color: "green",
              }
            : undefined
        }
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
        isSubmitting={updateMutation.isPending}
      />
    </View>
  );
}
