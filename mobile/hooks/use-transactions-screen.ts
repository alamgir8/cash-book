/**
 * use-transactions-screen
 *
 * Encapsulates all business logic for the History / Transactions screen.
 * The screen component imports this hook and only contains JSX.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import Toast from "react-native-toast-message";
import {
  fetchTransactions,
  fetchCounterparties,
  fetchVendors,
  updateTransaction,
  deleteTransaction,
  type Transaction,
  type TransactionFilters,
} from "@/services/transactions";
import { exportTransactionsPdf } from "@/services/reports";
import { fetchCategories } from "@/services/categories";
import { fetchAccounts } from "@/services/accounts";
import { queryKeys } from "@/lib/queryKeys";
import { refreshAppData } from "@/lib/refresh-app-data";
import { useOrganization } from "@/hooks/use-organization";
import { useDeleteMode } from "@/hooks/use-delete-mode";
import type { SelectOption } from "@/components/searchable-select";
import type { TransactionFormValues } from "@/components/modals/types";

const DEFAULT_FILTERS: TransactionFilters = {
  page: 1,
  limit: 50,
};

const formatCategoryGroup = (type?: string) => {
  if (!type) return "Other";
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
};

export function useTransactionsScreen() {
  const searchParams = useLocalSearchParams<{ accountId?: string }>();
  const accountId = searchParams?.accountId as string | undefined;
  const queryClient = useQueryClient();
  const { hasPermission } = useOrganization();
  const { isDeleteModeActive } = useDeleteMode();

  const canEditTransactions = hasPermission("edit_transactions");
  const canDeleteTransactions = hasPermission("delete_transactions");
  const canExportData = hasPermission("export_data");

  // ── UI state ────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<TransactionFilters>({
    ...DEFAULT_FILTERS,
    ...(accountId ? { accountId } : {}),
  });
  const [exporting, setExporting] = useState(false);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [payingDueTxn, setPayingDueTxn] = useState<Transaction | null>(null);
  const [viewingChainFor, setViewingChainFor] = useState<Transaction | null>(
    null,
  );
  const [viewingAttachmentsFor, setViewingAttachmentsFor] =
    useState<Transaction | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
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

  const vendorsQuery = useQuery({
    queryKey: queryKeys.vendors,
    queryFn: () => fetchVendors(),
  });

  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () => fetchTransactions(filters),
    placeholderData: (prev) => prev,
  });

  // ── Pagination accumulation ───────────────────────────────────────────────
  useEffect(() => {
    if (!transactionsQuery.data || transactionsQuery.isLoading) return;

    const freshData = (transactionsQuery.data as any)?.transactions ?? [];
    const pagination = (transactionsQuery.data as any)?.pagination;

    if (filters.page === 1) {
      setAllTransactions(freshData);
      if (pagination) setHasMorePages(pagination.page < pagination.pages);
    } else if (filters.page && filters.page > 1) {
      setAllTransactions((prev) => {
        const existingIds = new Set(prev.map((t) => t._id));
        const next = freshData.filter(
          (t: Transaction) => !existingIds.has(t._id),
        );
        return [...prev, ...next];
      });
      if (pagination) setHasMorePages(pagination.page < pagination.pages);
      setLoadingMore(false);
    }
  }, [transactionsQuery.data, filters.page, transactionsQuery.isLoading]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: updateTransaction,
    onSuccess: async (updated) => {
      setAllTransactions((prev) =>
        prev.map((t) =>
          t._id === editingTransaction?._id ? { ...t, ...updated } : t,
        ),
      );
      await Promise.all([
        queryClient.invalidateQueries({
          predicate: (q) => q.queryKey[0] === "transactions",
        }),
        queryClient.invalidateQueries({
          predicate: (q) => q.queryKey[0] === "accounts",
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.counterparties }),
      ]);
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
      setAllTransactions((prev) => prev.filter((t) => t._id !== transactionId));
      await Promise.all([
        queryClient.invalidateQueries({
          predicate: (q) => q.queryKey[0] === "transactions",
        }),
        queryClient.invalidateQueries({
          predicate: (q) => q.queryKey[0] === "accounts",
        }),
      ]);
      Toast.show({ type: "success", text1: "Transaction deleted" });
    },
    onError: () =>
      Toast.show({
        type: "error",
        text1: "Delete failed",
        text2: "Please try again.",
      }),
  });

  // ── Derived options ───────────────────────────────────────────────────────
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

  const modalCategoryOptions: SelectOption[] = useMemo(() => {
    const cats = (categoriesQuery.data ?? []) as {
      _id: string;
      name: string;
      flow: string;
      type: string;
    }[];
    return [
      { value: "", label: "No category" },
      ...cats.map((c) => ({
        value: c._id,
        label: c.name,
        group: formatCategoryGroup(c.type),
        flow: c.flow,
      })),
    ];
  }, [categoriesQuery.data]);

  const categoryOptions: SelectOption[] = useMemo(() => {
    const cats = (categoriesQuery.data ?? []) as {
      _id: string;
      name: string;
      flow: string;
    }[];
    return cats.map((c) => ({
      value: c._id,
      label: c.name,
      subtitle: c.flow === "credit" ? "Credit" : "Debit",
      group: c.flow === "credit" ? "Credit" : "Debit",
    }));
  }, [categoriesQuery.data]);

  const counterpartyOptions: SelectOption[] = useMemo(() => {
    const api = counterpartiesQuery.data ?? [];
    const fromTxns = allTransactions
      .map((t) => t.counterparty?.trim())
      .filter((n): n is string => Boolean(n));
    const editing = editingTransaction?.counterparty?.trim();
    return [...new Set([...api, ...fromTxns, ...(editing ? [editing] : [])])]
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map((n) => ({ value: n, label: n }));
  }, [counterpartiesQuery.data, allTransactions, editingTransaction]);

  const vendorOptions: SelectOption[] = useMemo(() => {
    const api = vendorsQuery.data ?? [];
    const fromTxns = allTransactions
      .map((t) => t.vendor?.trim())
      .filter((n): n is string => Boolean(n));
    const editing = editingTransaction?.vendor?.trim();
    return [...new Set([...api, ...fromTxns, ...(editing ? [editing] : [])])]
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map((n) => ({ value: n, label: n }));
  }, [vendorsQuery.data, allTransactions, editingTransaction]);

  // ── Computed values ───────────────────────────────────────────────────────
  const summaryTotals = useMemo(
    () =>
      allTransactions.reduce(
        (acc, t) => {
          if (t.type === "credit") acc.credit += t.amount;
          else acc.debit += t.amount;
          return acc;
        },
        { debit: 0, credit: 0 },
      ),
    [allTransactions],
  );

  const totalTransactionCount =
    (transactionsQuery.data as any)?.pagination?.total ??
    allTransactions.length;

  const hasActiveFilters = useMemo(() => {
    if (filters.range && filters.range !== DEFAULT_FILTERS.range) return true;
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
      const val = filters[key];
      const def = DEFAULT_FILTERS[key];
      if (typeof val === "number") return val !== undefined && val !== def;
      if (typeof val === "boolean") return val !== undefined && val !== def;
      return val !== undefined && val !== "" && val !== def;
    });
  }, [filters]);

  // ── Handlers ──────────────────────────────────────────────────────────────
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
    // deleteMutation.mutate is stable across renders (TanStack Query internals)
    // using the whole `deleteMutation` object would recreate this callback every
    // render, defeating TransactionCard's memo() and causing the VirtualizedList
    // slow-update warning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deleteMutation.mutate],
  );

  const handleAttachmentsPress = useCallback(
    (t: Transaction) => setViewingAttachmentsFor(t),
    [],
  );

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

  const handleVendorPress = useCallback((vendor?: string) => {
    setAllTransactions([]);
    setHasMorePages(true);
    setFilters((prev) => ({ ...prev, vendor: vendor || undefined, page: 1 }));
  }, []);

  const handlePaymentStatusPress = useCallback((status?: "paid" | "due") => {
    setAllTransactions([]);
    setHasMorePages(true);
    setFilters((prev) => ({
      ...prev,
      payment_status: status || undefined,
      page: 1,
    }));
  }, []);

  const handleFilterChange = useCallback(
    (nextFilters: Partial<TransactionFilters>) => {
      setAllTransactions([]);
      setHasMorePages(true);
      setFilters((prev) => ({ ...prev, ...nextFilters, page: 1 }));
    },
    [],
  );

  const handleResetFilters = useCallback(() => {
    setAllTransactions([]);
    setHasMorePages(true);
    setFilters({ ...DEFAULT_FILTERS, ...(accountId ? { accountId } : {}) });
    transactionsQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMorePages || transactionsQuery.isFetching) return;
    setLoadingMore(true);
    setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }));
  }, [loadingMore, hasMorePages, transactionsQuery.isFetching]);

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
      counterparty: values.counterparty?.trim() || undefined,
      vendor: values.vendor?.trim() || undefined,
      payment_status: values.payment_status || "paid",
      due_date: values.due_date?.trim() || undefined,
    } as any);
  };

  const handleRefresh = useCallback(() => {
    setAllTransactions([]);
    setHasMorePages(true);
    setFilters((prev) => ({ ...prev, page: 1 }));
    void refreshAppData(queryClient);
  }, [queryClient]);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingTransaction(null);
  }, []);

  return {
    // route param
    accountId,
    // state
    filters,
    exporting,
    allTransactions,
    hasMorePages,
    loadingMore,
    isModalVisible,
    editingTransaction,
    payingDueTxn,
    viewingChainFor,
    viewingAttachmentsFor,
    // queries
    transactionsQuery,
    accountsQuery,
    categoriesQuery,
    // computed
    accountOptions,
    modalCategoryOptions,
    categoryOptions,
    counterpartyOptions,
    vendorOptions,
    summaryTotals,
    totalTransactionCount,
    hasActiveFilters,
    // permissions
    canEditTransactions,
    canDeleteTransactions,
    canExportData,
    isDeleteModeActive,
    // mutation state
    isUpdating: updateMutation.isPending,
    // setters
    setPayingDueTxn,
    setViewingChainFor,
    setViewingAttachmentsFor,
    setModalVisible,
    setFilters,
    // handlers
    handleEditTransaction,
    handleDeleteTransaction,
    handleAttachmentsPress,
    handleCategoryPress,
    handleCounterpartyPress,
    handleVendorPress,
    handlePaymentStatusPress,
    handleFilterChange,
    handleResetFilters,
    handleLoadMore,
    handleExport,
    handleTransactionSubmit,
    handleRefresh,
    closeModal,
    // constants
    DEFAULT_FILTERS,
  };
}
