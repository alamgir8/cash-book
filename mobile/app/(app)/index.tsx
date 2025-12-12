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
import { FilterBar } from "../../components/filter-bar";
import { TransactionCard } from "../../components/transaction-card";
import { StatsCards } from "../../components/stats-cards";
import { QuickActions } from "../../components/quick-actions";
import { ScreenHeader } from "../../components/screen-header";
import { EmptyState } from "../../components/empty-state";
import { FloatingActionButton } from "../../components/floating-action-button";
import { TransactionModal } from "../../components/modals/transaction-modal";
import { TransferModal } from "../../components/modals/transfer-modal";
import type {
  TransactionFormValues,
  TransferFormValues,
  SelectOption,
} from \"../../components/modals/types\";
import { exportTransactionsPdf } from "../../services/reports";
import {
  createTransaction,
  createTransfer,
  fetchCounterparties,
  fetchTransactions,
  updateTransaction,
  type Transaction,
  type TransactionFilters,
} from "../../services/transactions";
import { fetchAccounts } from "../../services/accounts";
import { fetchCategories } from "../../services/categories";
import { queryKeys } from "../../lib/queryKeys";
import { usePreferences } from "../../hooks/usePreferences";

const defaultFilters: TransactionFilters = {
  range: "monthly",
  page: 1,
  limit: 20,
};

export default function DashboardScreen() {
  const { formatAmount } = usePreferences();
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
    [accountsQuery.data, formatAmount]
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
    queryFn: fetchCounterparties,
  });

  const counterpartyOptions: SelectOption[] = useMemo(() => {
    const apiCounterparties = counterpartiesQuery.data ?? [];
    return apiCounterparties.map((name) => ({ value: name, label: name }));
  }, [counterpartiesQuery.data]);

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

  const handleEditTransaction = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setModalVisible(true);
  }, []);

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
      { debit: 0, credit: 0 }
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

  const renderTransactionItem = useCallback(
    ({ item }: { item: any }) => (
      <TransactionCard
        transaction={item}
        onCategoryPress={handleCategoryFilter}
        onCounterpartyPress={handleCounterpartyFilter}
        onEdit={handleEditTransaction}
      />
    ),
    [handleCategoryFilter, handleCounterpartyFilter, handleEditTransaction]
  );

  const renderHeader = () => {
    const transactionCount =
      (transactionsQuery.data as any)?.transactions?.length || 0;
    const accountCount = accountsQuery.data?.length || 0;

    return (
      <View className="gap-6">
        {/* Enhanced Statistics Cards */}
        <StatsCards
          totalDebit={totals.debit}
          totalCredit={totals.credit}
          transactionCount={transactionCount}
          accountCount={accountCount}
          isLoading={accountsQuery.isLoading || transactionsQuery.isLoading}
        />

        {/* Quick Actions */}
        <QuickActions
          onAddTransaction={() => setModalVisible(true)}
          onAddTransfer={openTransferModal}
          onAddAccount={() => {
            router.push("/(app)/accounts");
          }}
          onExportPDF={async () => {
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
          }}
          onVoiceInput={() => {
            setModalVisible(true);
          }}
        />

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
          showFinancialScopeToggle
        />
      </View>
    );
  };

  // console.log("transactionsQuery", transactionsQuery.data);

  return (
    <View className="flex-1 bg-gradient-to-b from-blue-50 to-gray-50">
      <ScreenHeader
        title="Dashboard"
        subtitle="Track your finances easily"
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
            onRefresh={() => transactionsQuery.refetch()}
            tintColor="#1d4ed8"
            colors={["#1d4ed8"]}
          />
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          transactionsQuery.isLoading ? (
            <View className="items-center mt-12">
              <ActivityIndicator color="#1d4ed8" size="large" />
              <Text className="text-gray-500 mt-4 text-base">
                Loading transactions...
              </Text>
            </View>
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
        renderItem={renderTransactionItem}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
      />

      <FloatingActionButton
        onPress={() => {
          setEditingTransaction(null);
          setModalVisible(true);
        }}
        icon="add"
        position="bottom-right"
      />

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
        isAccountsLoading={accountsQuery.isLoading}
        isSubmitting={createTransferMutation.isPending}
      />
    </View>
  );
}
