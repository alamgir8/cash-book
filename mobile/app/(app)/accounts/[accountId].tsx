import { useCallback, useMemo, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import Toast from "react-native-toast-message";
import { FilterBar } from "@/components/filter-bar";
import { TransactionCard } from "@/components/transaction-card";
import { TransactionModal } from "@/components/modals/transaction-modal";
import { AttachmentViewerModal } from "@/components/transactions/attachment-viewer-modal";
import { DuePaymentModal } from "@/components/modals/due-payment-modal";
import { DueChainSheet } from "@/components/modals/due-chain-sheet";
import { VendorHistorySheet } from "@/components/modals/vendor-history-sheet";
import type { Transaction } from "@/services/transactions";
import {
  AccountHeader,
  AccountActions,
  AccountSummaryCard,
  AccountLoadMoreFooter,
  AccountEmptyState,
  ExportOptionsModal,
} from "@/components/accounts";
import type { ExportType } from "@/components/accounts";
import {
  exportTransactionsPdf,
  exportTransactionsByCategoryPdf,
  exportTransactionsByCounterpartyPdf,
} from "@/services/reports";
import { fetchCategories } from "@/services/categories";
import { fetchAccounts } from "@/services/accounts";
import {
  fetchCounterparties,
  fetchVendors,
  updateTransaction,
  deleteTransaction,
  type TransactionFilters,
} from "@/services/transactions";
import { queryKeys } from "@/lib/queryKeys";
import { usePreferences } from "@/hooks/use-preferences";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";
import { useOrganization } from "@/hooks/use-organization";
import { useDeleteMode } from "@/hooks/use-delete-mode";
import {
  translateCategoryName,
  translateCategoryGroup,
  translateFlow,
} from "@/lib/i18n/category-translations";
import { useAccountDetail, useAccountTransactions } from "@/hooks/use-accounts";
import { calculateAccountNetFlow } from "@/lib/account-utils";
import { refreshAppData } from "@/lib/refresh-app-data";
import {
  filterTransactionsByPartyFilters,
  serializeTransactionFilters,
} from "@/lib/transaction-filters";
import type { SelectOption } from "@/components/searchable-select";
import type { TransactionFormValues } from "@/components/modals/types";

const defaultFilters: TransactionFilters = {
  page: 1,
  limit: 50,
};

export default function AccountDetailScreen() {
  const { formatAmount, preferences } = usePreferences();
  const language = preferences.language ?? "en";
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { hasPermission } = useOrganization();
  const { isDeleteModeActive } = useDeleteMode();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const accountId = Array.isArray(params.accountId)
    ? params.accountId[0]
    : params.accountId;

  const canEditTransactions = hasPermission("edit_transactions");
  const canDeleteTransactions = hasPermission("delete_transactions");

  const [filters, setFilters] = useState<TransactionFilters>({
    ...defaultFilters,
    ...(accountId ? { accountId } : {}),
  });
  const [isModalVisible, setModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [viewingAttachmentsFor, setViewingAttachmentsFor] =
    useState<Transaction | null>(null);
  const [payingDueTxn, setPayingDueTxn] = useState<Transaction | null>(null);
  const [viewingChainFor, setViewingChainFor] = useState<Transaction | null>(
    null,
  );
  const [viewingVendorHistoryFor, setViewingVendorHistoryFor] =
    useState<Transaction | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportingType, setExportingType] = useState<ExportType | null>(null);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
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

  const vendorsQuery = useQuery({
    queryKey: queryKeys.vendors,
    queryFn: () => fetchVendors(),
  });

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: fetchAccounts,
  });

  const updateMutation = useMutation({
    mutationFn: updateTransaction,
    onSuccess: async (updated) => {
      setAllTransactions((prev) =>
        prev.map((txn) =>
          txn._id === editingTransaction?._id ? { ...txn, ...updated } : txn,
        ),
      );
      await refreshAppData(queryClient);
      setModalVisible(false);
      setEditingTransaction(null);
      Toast.show({ type: "success", text1: "Transaction updated" });
    },
    onError: () =>
      Toast.show({
        type: "error",
        text1: "Error updating transaction",
        text2: "Please try again.",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: async (_, transactionId) => {
      setAllTransactions((prev) =>
        prev.filter((txn) => txn._id !== transactionId),
      );
      await refreshAppData(queryClient);
      Toast.show({ type: "success", text1: "Transaction deleted" });
    },
    onError: () =>
      Toast.show({
        type: "error",
        text1: "Delete failed",
        text2: "Please try again.",
      }),
  });

  const accountOptions: SelectOption[] = useMemo(() => {
    const accounts = (accountsQuery.data ?? []) as {
      _id: string;
      name: string;
      kind: string;
    }[];
    return accounts.map((a) => ({
      value: a._id,
      label: a.name,
      subtitle: a.kind?.replace(/_/g, " "),
    }));
  }, [accountsQuery.data]);

  const categoryOptions: SelectOption[] = useMemo(() => {
    const categories = categoriesQuery.data ?? [];
    return categories.map((category) => {
      const flowLabel = category.flow === "credit" ? "Credit" : "Debit";
      return {
        value: category._id,
        label: translateCategoryName(category.name, language),
        subtitle: translateFlow(flowLabel, language),
        group: translateFlow(flowLabel, language),
      };
    });
  }, [categoriesQuery.data, language]);

  const modalCategoryOptions: SelectOption[] = useMemo(() => {
    const categories = categoriesQuery.data ?? [];
    return [
      {
        value: "",
        label: language === "bn" ? "কোনো ক্যাটাগরি নেই" : "No category",
      },
      ...categories.map((category) => {
        const rawGroup = category.type
          ? category.type.charAt(0).toUpperCase() +
            category.type.slice(1).replace(/_/g, " ")
          : "Other";
        return {
          value: category._id,
          label: translateCategoryName(category.name, language),
          group: translateCategoryGroup(
            category.type ?? "",
            rawGroup,
            language,
          ),
          flow: category.flow,
        };
      }),
    ];
  }, [categoriesQuery.data, language]);

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

  const vendorOptions: SelectOption[] = useMemo(() => {
    const parties = vendorsQuery.data ?? [];
    return parties
      .map((p) => ({ value: p._id, label: p.name }))
      .sort((a, b) =>
        a.label.toLowerCase().localeCompare(b.label.toLowerCase()),
      );
  }, [vendorsQuery.data]);

  // Alias for places that expect partyOptions
  const partyOptions = vendorOptions;

  const filterSignature = useMemo(
    () => JSON.stringify(serializeTransactionFilters(filters)),
    [filters],
  );

  const visibleTransactions = useMemo(
    () => filterTransactionsByPartyFilters(allTransactions, filters),
    [allTransactions, filters.for_party_id, filters.party_id],
  );

  // Update accumulated transactions when new data arrives
  useEffect(() => {
    if (
      !transactionsQuery.data ||
      transactionsQuery.isPending ||
      transactionsQuery.isFetching
    ) {
      return;
    }

    const freshData = (transactionsQuery.data as any)?.transactions ?? [];
    const pagination = (transactionsQuery.data as any)?.pagination;
    const currentPage = filters.page ?? 1;

    if (pagination && pagination.page !== currentPage) return;

    if (currentPage === 1) {
      setAllTransactions(freshData);
      if (pagination) {
        setHasMorePages(pagination.page < pagination.pages);
      }
    } else if (currentPage > 1) {
      setAllTransactions((prev) => {
        const existingIds = new Set(prev.map((t) => t._id));
        const newTransactions = freshData.filter(
          (t: Transaction) => !existingIds.has(t._id),
        );
        return [...prev, ...newTransactions];
      });

      if (pagination) {
        setHasMorePages(pagination.page < pagination.pages);
      }
      setLoadingMore(false);
    }
  }, [
    transactionsQuery.data,
    transactionsQuery.isPending,
    transactionsQuery.isFetching,
    filters.page,
    filterSignature,
  ]);

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
      "party_id",
      "for_party_id",
      "payment_status",
      "loan_filter",
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

  const handlePartyFilter = useCallback((partyId?: string) => {
    setAllTransactions([]);
    setHasMorePages(true);
    setFilters((prev) => ({
      ...prev,
      party_id: partyId || undefined,
      for_party_id: undefined,
      page: 1,
    }));
  }, []);

  const handleForPartyFilter = useCallback((forPartyId?: string) => {
    setAllTransactions([]);
    setHasMorePages(true);
    setFilters((prev) => ({
      ...prev,
      for_party_id: forPartyId || undefined,
      party_id: undefined,
      page: 1,
    }));
  }, []);

  const handleViewHistory = useCallback((txn: Transaction) => {
    setViewingVendorHistoryFor(txn);
  }, []);

  const handlePaymentStatusFilter = useCallback((status?: "paid" | "due") => {
    setAllTransactions([]);
    setHasMorePages(true);
    setFilters((prev) => ({
      ...prev,
      payment_status: status || undefined,
      loan_filter: undefined,
      page: 1,
    }));
  }, []);

  const handleEditTransaction = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setModalVisible(true);
  }, []);

  const handleDeleteTransaction = useCallback(
    (transaction: Transaction) => {
      Alert.alert(
        "Delete Transaction?",
        `Delete "${transaction.description || transaction.account?.name}" (${
          transaction.type === "credit" ? "+" : "-"
        }${transaction.amount})? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteMutation.mutate(transaction._id),
          },
        ],
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deleteMutation.mutate],
  );

  const handleAttachmentsPress = useCallback((transaction: Transaction) => {
    setViewingAttachmentsFor(transaction);
  }, []);

  const handleTransactionSubmit = async (values: TransactionFormValues) => {
    if (!editingTransaction) return;
    await updateMutation.mutateAsync({
      transactionId: editingTransaction._id,
      ...values,
      amount: Number(values.amount),
      date: values.date?.trim() || undefined,
      description: values.description?.trim() || undefined,
      comment: values.comment?.trim() || undefined,
      categoryId: values.categoryId || undefined,
      party: values.party || undefined,
      for_party: (values as any).for_party || undefined,
      payment_status: values.payment_status || "paid",
      due_date: values.due_date?.trim() || undefined,
    } as any);
  };

  const closeTransactionModal = useCallback(() => {
    setModalVisible(false);
    setEditingTransaction(null);
  }, []);

  const handleExport = async (type: ExportType) => {
    if (!accountId) return;
    try {
      setExporting(true);
      setExportingType(type);
      const { page, limit, ...filtersWithoutPagination } = filters;
      const exportFilters = { ...filtersWithoutPagination, accountId };

      switch (type) {
        case "pdf":
          await exportTransactionsPdf(exportFilters);
          break;
        case "by-category":
          await exportTransactionsByCategoryPdf(exportFilters);
          break;
        case "by-counterparty":
          await exportTransactionsByCounterpartyPdf(exportFilters);
          break;
      }

      Toast.show({ type: "success", text1: "PDF exported successfully" });
      setExportModalVisible(false);
    } catch (error) {
      Toast.show({ type: "error", text1: "Failed to export PDF" });
    } finally {
      setExporting(false);
      setExportingType(null);
    }
  };

  const handleRefresh = () => {
    setAllTransactions([]);
    setHasMorePages(true);
    setFilters((prev) => ({ ...prev, page: 1 }));
    void refreshAppData(queryClient);
  };

  const handleEdit = () => {
    router.push({
      pathname: "/(app)/accounts",
      params: { accountId },
    });
  };

  const lastActivityLabel = summary?.lastTransactionDate
    ? dayjs(summary.lastTransactionDate).format("MMM D, YYYY")
    : "No activity yet";

  const renderTransactionItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionCard
        transaction={item}
        onCategoryPress={handleCategoryFilter}
        onCounterpartyPress={handleCounterpartyFilter}
        onPartyPress={handlePartyFilter}
        onForPartyPress={handleForPartyFilter}
        onPaymentStatusPress={handlePaymentStatusFilter}
        onEdit={canEditTransactions ? handleEditTransaction : undefined}
        onDelete={
          canDeleteTransactions && isDeleteModeActive
            ? handleDeleteTransaction
            : undefined
        }
        onAttachmentsPress={handleAttachmentsPress}
        onPayDue={setPayingDueTxn}
        onViewChain={setViewingChainFor}
        onViewHistory={handleViewHistory}
      />
    ),
    [
      handleCategoryFilter,
      handleCounterpartyFilter,
      handlePartyFilter,
      handleForPartyFilter,
      handlePaymentStatusFilter,
      canEditTransactions,
      handleEditTransaction,
      canDeleteTransactions,
      isDeleteModeActive,
      handleDeleteTransaction,
      handleAttachmentsPress,
      setPayingDueTxn,
      setViewingChainFor,
      handleViewHistory,
    ],
  );

  const renderHeader = useCallback(() => {
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
          onExport={() => setExportModalVisible(true)}
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
          showVendorField
          vendors={vendorOptions}
          showPaymentStatusFilter
          onReset={handleResetFilters}
          onApplyFilters={() => {
            setAllTransactions([]);
            setHasMorePages(true);
            setFilters((prev) => ({ ...prev, page: 1 }));
            transactionsQuery.refetch();
          }}
        />
        {transactionsQuery.isFetching &&
          !transactionsQuery.isLoading &&
          !loadingMore && (
            <View
              className="flex-row items-center justify-center gap-2 py-2 rounded-xl"
              style={{ backgroundColor: colors.info + "15" }}
            >
              <ActivityIndicator size="small" color={colors.info} />
              <Text className="text-sm" style={{ color: colors.info }}>
                {t("loading")}
              </Text>
            </View>
          )}
      </View>
    );
  }, [
    account,
    lastActivityLabel,
    formatAmount,
    summary,
    netFlow,
    filters,
    handleFilterChange,
    hasActiveFilters,
    categoryOptions,
    counterpartyOptions,
    vendorOptions,
    handleResetFilters,
    transactionsQuery.isFetching,
    transactionsQuery.isLoading,
    transactionsQuery.refetch,
    loadingMore,
    colors,
    t,
    setAllTransactions,
    setHasMorePages,
    setFilters,
    router,
    handleEdit,
  ]);

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

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <FlatList
        data={visibleTransactions}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          gap: 16,
          paddingBottom: 80,
        }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={
          <AccountLoadMoreFooter
            hasMorePages={hasMorePages}
            loadingMore={loadingMore}
            isFetching={transactionsQuery.isFetching && filters.page !== 1}
            totalTransactions={visibleTransactions.length}
            onLoadMore={handleLoadMore}
          />
        }
        ListEmptyComponent={
          <AccountEmptyState isLoading={transactionsQuery.isLoading} />
        }
        renderItem={renderTransactionItem}
        refreshControl={
          <RefreshControl
            refreshing={transactionsQuery.isRefetching && filters.page === 1}
            onRefresh={handleRefresh}
            tintColor="#3b82f6"
          />
        }
      />

      <TransactionModal
        visible={isModalVisible}
        onClose={closeTransactionModal}
        onSubmit={handleTransactionSubmit}
        editingTransaction={editingTransaction}
        accountOptions={accountOptions}
        categoryOptions={modalCategoryOptions}
        counterpartyOptions={counterpartyOptions}
        vendorOptions={vendorOptions}
        partyOptions={partyOptions}
        isAccountsLoading={accountsQuery.isLoading}
        isCategoriesLoading={categoriesQuery.isLoading}
        isSubmitting={updateMutation.isPending}
      />

      <AttachmentViewerModal
        visible={!!viewingAttachmentsFor}
        onClose={() => setViewingAttachmentsFor(null)}
        transactionId={viewingAttachmentsFor?._id ?? ""}
        attachments={viewingAttachmentsFor?.attachments ?? []}
        canDelete={canEditTransactions}
      />

      <ExportOptionsModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        onExport={handleExport}
        exporting={exporting}
        exportingType={exportingType}
        accountName={account?.name}
        hasDateFilter={Boolean(
          filters.from || filters.to || filters.startDate || filters.endDate,
        )}
      />

      {payingDueTxn && (
        <DuePaymentModal
          visible={!!payingDueTxn}
          onClose={() => setPayingDueTxn(null)}
          dueTxn={payingDueTxn}
          accountOptions={accountOptions}
          onSuccess={() => {
            handleRefresh();
            setPayingDueTxn(null);
          }}
        />
      )}

      {viewingChainFor && (
        <DueChainSheet
          visible={!!viewingChainFor}
          onClose={() => setViewingChainFor(null)}
          transaction={viewingChainFor}
        />
      )}

      {viewingVendorHistoryFor && (
        <VendorHistorySheet
          visible={!!viewingVendorHistoryFor}
          onClose={() => setViewingVendorHistoryFor(null)}
          transaction={viewingVendorHistoryFor}
        />
      )}
    </View>
  );
}
