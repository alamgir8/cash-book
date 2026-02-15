import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { FilterBar } from "@/components/filter-bar";
import { TransactionCard } from "@/components/transaction-card";
import { StatsCards } from "@/components/stats-cards";
import { HomeQuickFeatures } from "@/components/home-quick-features";
import { ScreenHeader } from "@/components/screen-header";
import { EmptyState } from "@/components/empty-state";
import { FloatingActionButton } from "@/components/floating-action-button";
import { TransactionModal } from "@/components/modals/transaction-modal";
import { TransferModal } from "@/components/modals/transfer-modal";
import {
  StatsCardsSkeleton,
  QuickFeaturesSkeleton,
  TransactionListSkeleton,
} from "@/components/skeletons";
import { LoadMoreButton } from "@/components/load-more-button";
import type {
  TransactionFormValues,
  TransferFormValues,
  SelectOption,
} from "@/components/modals/types";
import { exportTransactionsPdf } from "@/services/reports";
import {
  createTransaction,
  createTransfer,
  fetchCounterparties,
  fetchTransactions,
  updateTransaction,
  type Transaction,
  type TransactionFilters,
} from "@/services/transactions";
import { fetchAccounts } from "@/services/accounts";
import { fetchCategories } from "@/services/categories";
import { queryKeys } from "@/lib/queryKeys";
import { usePreferences } from "@/hooks/usePreferences";
import { useOrganization } from "@/hooks/useOrganization";
import { usePaginationCache } from "@/hooks/usePaginationCache";
import { useTheme } from "@/hooks/useTheme";

const defaultFilters: TransactionFilters = {
  range: "monthly",
  page: 1,
  limit: 20,
};

export default function DashboardScreen() {
  const { formatAmount } = usePreferences();
  const { canCreateTransactions, activeOrganization } = useOrganization();
  const { mergeTransactionPages } = usePaginationCache();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TransactionFilters>(defaultFilters);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isTransferModalVisible, setTransferModalVisible] = useState(false);
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

  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () => fetchTransactions(filters),
    placeholderData: (previousData) => previousData,
  });

  const createMutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: async () => {
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
      Toast.show({ type: "success", text1: "Transaction added" });
    },
    onError: () => {
      Toast.show({
        type: "error",
        text1: "Error saving transaction",
        text2: "Please try again.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateTransaction,
    onSuccess: async () => {
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

  const createTransferMutation = useMutation({
    mutationFn: createTransfer,
    onSuccess: async () => {
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
      setTransferModalVisible(false);
      Toast.show({ type: "success", text1: "Transfer completed" });
    },
    onError: (error) => {
      console.error("Transfer creation error:", error);
      Toast.show({
        type: "error",
        text1: "Error creating transfer",
        text2: "Please try again.",
      });
    },
  });

  const accountOptions = useMemo(
    () =>
      (accountsQuery.data ?? []).map((account) => ({
        value: account._id,
        label: account.name,
        subtitle: `${formatAmount(account.balance)}${
          account.currency_symbol ? ` · ${account.currency_symbol}` : ""
        }`,
      })),
    [accountsQuery.data, formatAmount],
  );

  const formatCategoryGroup = (type: string) =>
    type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  const categoryOptions = useMemo(() => {
    const categories = (categoriesQuery.data ?? []) as {
      _id: string;
      name: string;
      flow: string;
      type: string;
    }[];
    // Return all categories - the modal will filter by type
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

  const counterpartiesQuery = useQuery({
    queryKey: queryKeys.counterparties,
    queryFn: () => fetchCounterparties(),
  });

  // Combine API counterparties with counterparties from loaded transactions
  const counterpartyOptions: SelectOption[] = useMemo(() => {
    const apiCounterparties = counterpartiesQuery.data ?? [];

    // Also extract from current transactions as fallback
    const txnCounterparties = (transactionsQuery.data?.transactions ?? [])
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
  }, [counterpartiesQuery.data, transactionsQuery.data, editingTransaction]);

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

  const openTransferModal = () => {
    if (accountsQuery.isLoading) {
      Toast.show({
        type: "info",
        text1: "Loading accounts",
        text2: "Please wait a moment.",
      });
      return;
    }
    if (accountOptions.length < 2) {
      Toast.show({
        type: "info",
        text1: "Add another account to transfer funds",
      });
      return;
    }
    setTransferModalVisible(true);
  };

  const handleEditTransaction = useCallback(
    (transaction: Transaction) => {
      if (!canCreateTransactions) {
        Toast.show({
          type: "error",
          text1: "Permission Denied",
          text2: "You don't have permission to edit transactions",
        });
        return;
      }
      setEditingTransaction(transaction);
      setModalVisible(true);
    },
    [canCreateTransactions],
  );

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingTransaction(null);
  }, []);

  const closeTransferModal = useCallback(() => {
    setTransferModalVisible(false);
  }, []);

  const totals = useMemo(() => {
    const data = transactionsQuery.data as any;
    if (!data?.transactions) return { debit: 0, credit: 0 };
    return data.transactions.reduce(
      (acc: any, txn: any) => {
        acc[txn.type] += txn.amount;
        return acc;
      },
      { debit: 0, credit: 0 },
    );
  }, [transactionsQuery.data]);

  const handleTransactionSubmit = async (values: TransactionFormValues) => {
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

    if (editingTransaction) {
      await updateMutation.mutateAsync({
        transactionId: editingTransaction._id,
        ...payload,
      } as any);
    } else {
      await createMutation.mutateAsync(payload as any);
    }
  };

  const handleTransferSubmit = async (values: TransferFormValues) => {
    const payload = {
      fromAccountId: values.fromAccountId,
      toAccountId: values.toAccountId,
      amount: Number(values.amount),
      date: values.date?.trim() ? values.date.trim() : undefined,
      description: values.description?.trim()
        ? values.description.trim()
        : undefined,
      comment: values.comment?.trim() ? values.comment.trim() : undefined,
      counterparty: values.counterparty?.trim()
        ? values.counterparty.trim()
        : undefined,
    };

    await createTransferMutation.mutateAsync(payload as any);
  };

  const handleCategoryFilter = useCallback((categoryId?: string) => {
    setFilters((prev) => ({
      ...prev,
      categoryId: categoryId || undefined,
      counterparty: undefined,
      page: 1,
    }));
  }, []);

  const handleCounterpartyFilter = useCallback((counterparty?: string) => {
    setFilters((prev) => ({
      ...prev,
      counterparty: counterparty || undefined,
      categoryId: undefined,
      page: 1,
    }));
  }, []);

  const handleLoadMore = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      page: (prev.page ?? 1) + 1,
    }));
  }, []);

  const totalTransactions = (transactionsQuery.data as any)?.total || 0;
  const currentTransactions =
    (transactionsQuery.data as any)?.transactions?.length || 0;
  const currentPage = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const hasMore =
    currentTransactions + (currentPage - 1) * limit < totalTransactions;

  const renderTransactionItem = useCallback(
    ({ item }: { item: any }) => (
      <TransactionCard
        transaction={item}
        onCategoryPress={handleCategoryFilter}
        onCounterpartyPress={handleCounterpartyFilter}
        onEdit={handleEditTransaction}
      />
    ),
    [handleCategoryFilter, handleCounterpartyFilter, handleEditTransaction],
  );

  const renderHeader = () => {
    const transactionCount =
      (transactionsQuery.data as any)?.transactions?.length || 0;
    const accountCount = accountsQuery.data?.length || 0;

    const handleExportPDF = async () => {
      try {
        await exportTransactionsPdf(filters);
        Toast.show({
          type: "success",
          text1: "PDF exported successfully!",
        });
      } catch (error) {
        console.error(error);
        Toast.show({ type: "error", text1: "Failed to export PDF" });
      }
    };

    return (
      <View className="gap-6">
        {/* Enhanced Statistics Cards */}
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

        {/* Quick Features Grid - bKash Style */}
        {accountsQuery.isLoading ? (
          <QuickFeaturesSkeleton />
        ) : (
          <HomeQuickFeatures
            onAddTransaction={() => setModalVisible(true)}
            onAddTransfer={openTransferModal}
            onExportPDF={handleExportPDF}
          />
        )}

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
          hasActiveFilters={hasActiveFilters}
          onApplyFilters={() => transactionsQuery.refetch()}
          onReset={() => {
            setFilters({ ...defaultFilters });
            transactionsQuery.refetch();
          }}
          showCategoryField
          categories={categoryOptions}
          showCounterpartyField
          counterparties={counterpartyOptions}
        />
      </View>
    );
  };

  // console.log("transactionsQuery", transactionsQuery.data);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title="Dashboard"
        subtitle={
          activeOrganization
            ? `${activeOrganization.name} · ${
                activeOrganization.role.charAt(0).toUpperCase() +
                activeOrganization.role.slice(1)
              }`
            : "Track your finances easily"
        }
        icon="analytics"
      />

      <FlatList
        data={(transactionsQuery.data as any)?.transactions ?? []}
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
            refreshing={transactionsQuery.isRefetching}
            onRefresh={() => {
              setFilters({ ...defaultFilters });
              transactionsQuery.refetch();
            }}
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
              title="No transactions yet"
              description="Start tracking your finances by adding your first transaction"
              actionButton={{
                label: "Add Transaction",
                onPress: () => setModalVisible(true),
              }}
            />
          )
        }
        ListFooterComponent={
          currentTransactions > 0 ? (
            <LoadMoreButton
              onPress={handleLoadMore}
              isLoading={transactionsQuery.isLoading && filters.page !== 1}
              hasMore={hasMore}
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
            setEditingTransaction(null);
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
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <TransferModal
        visible={isTransferModalVisible}
        onClose={closeTransferModal}
        onSubmit={handleTransferSubmit}
        accountOptions={accountOptions}
        counterpartyOptions={counterpartyOptions}
        isAccountsLoading={accountsQuery.isLoading}
        isSubmitting={createTransferMutation.isPending}
      />
    </View>
  );
}
