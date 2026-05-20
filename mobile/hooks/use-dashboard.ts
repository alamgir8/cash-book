/**
 * use-dashboard
 *
 * Encapsulates all business logic for the Dashboard (Home) screen.
 * The screen component imports this hook and only contains JSX.
 */
import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import {
  createTransaction,
  createTransfer,
  deleteTransaction,
  fetchCounterparties,
  fetchVendors,
  fetchTransactions,
  updateTransaction,
  type Transaction,
  type TransactionFilters,
} from "@/services/transactions";
import { fetchAccounts } from "@/services/accounts";
import { fetchCategories } from "@/services/categories";
import { exportTransactionsPdf } from "@/services/reports";
import { queryKeys } from "@/lib/queryKeys";
import { refreshAppData } from "@/lib/refresh-app-data";
import { usePreferences } from "@/hooks/use-preferences";
import { useOrganization } from "@/hooks/use-organization";
import { useDeleteMode } from "@/hooks/use-delete-mode";
import type {
  TransactionFormValues,
  TransferFormValues,
  SelectOption,
} from "@/components/modals/types";

const DEFAULT_FILTERS: TransactionFilters = {
  range: "monthly",
  page: 1,
  limit: 20,
};

export function useDashboard() {
  const { formatAmount } = usePreferences();
  const { canCreateTransactions, activeOrganization, hasPermission } =
    useOrganization();
  const canEditTransactions = hasPermission("edit_transactions");
  const { isDeleteModeActive } = useDeleteMode();
  const queryClient = useQueryClient();

  // ── UI state ────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isTransferModalVisible, setTransferModalVisible] = useState(false);
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

  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () => fetchTransactions(filters),
    placeholderData: (previousData) => previousData,
  });

  const counterpartiesQuery = useQuery({
    queryKey: queryKeys.counterparties,
    queryFn: () => fetchCounterparties(),
  });

  const vendorsQuery = useQuery({
    queryKey: queryKeys.vendors,
    queryFn: () => fetchVendors(),
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "transactions",
      }),
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "accounts",
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.counterparties }),
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      void invalidateAll();
      Toast.show({ type: "success", text1: "Transaction added" });
    },
    onError: () =>
      Toast.show({
        type: "error",
        text1: "Error saving transaction",
        text2: "Please try again.",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: updateTransaction,
    onSuccess: () => {
      setModalVisible(false);
      setEditingTransaction(null);
      void invalidateAll();
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
    onSuccess: () => {
      void Promise.all([
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

  const createTransferMutation = useMutation({
    mutationFn: createTransfer,
    onSuccess: () => {
      void invalidateAll();
      // NOTE: modal closes itself after attachment upload completes
      Toast.show({ type: "success", text1: "Transfer completed" });
    },
    onError: () =>
      Toast.show({
        type: "error",
        text1: "Error creating transfer",
        text2: "Please try again.",
      }),
  });

  // ── Derived options ───────────────────────────────────────────────────────
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
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const categoryOptions = useMemo(() => {
    const categories = (categoriesQuery.data ?? []) as {
      _id: string;
      name: string;
      flow: string;
      type: string;
    }[];
    return [
      { value: "", label: "No category" },
      ...categories.map((c) => ({
        value: c._id,
        label: c.name,
        group: formatCategoryGroup(c.type),
        flow: c.flow,
      })),
    ];
  }, [categoriesQuery.data]);

  const counterpartyOptions: SelectOption[] = useMemo(() => {
    const api = counterpartiesQuery.data ?? [];
    const fromTxns = (transactionsQuery.data?.transactions ?? [])
      .map((t) => t.counterparty?.trim())
      .filter((n): n is string => Boolean(n));
    const editing = editingTransaction?.counterparty?.trim();
    return [...new Set([...api, ...fromTxns, ...(editing ? [editing] : [])])]
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map((n) => ({ value: n, label: n }));
  }, [counterpartiesQuery.data, transactionsQuery.data, editingTransaction]);

  const vendorOptions: SelectOption[] = useMemo(() => {
    const api = vendorsQuery.data ?? [];
    const fromTxns = (transactionsQuery.data?.transactions ?? [])
      .map((t) => t.vendor?.trim())
      .filter((n): n is string => Boolean(n));
    const editing = editingTransaction?.vendor?.trim();
    return [...new Set([...api, ...fromTxns, ...(editing ? [editing] : [])])]
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map((n) => ({ value: n, label: n }));
  }, [vendorsQuery.data, transactionsQuery.data, editingTransaction]);

  // ── Computed values ───────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const txns = (transactionsQuery.data as any)?.transactions ?? [];
    return txns.reduce(
      (acc: { debit: number; credit: number }, txn: Transaction) => {
        acc[txn.type] += txn.amount;
        return acc;
      },
      { debit: 0, credit: 0 },
    );
  }, [transactionsQuery.data]);

  const hasActiveFilters = useMemo(() => {
    if (filters.range && filters.range !== DEFAULT_FILTERS.range) return true;
    const keys: (keyof TransactionFilters)[] = [
      "accountId",
      "categoryId",
      "counterparty",
      "vendor",
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
      const val = filters[key];
      const def = DEFAULT_FILTERS[key];
      if (typeof val === "number") return val !== undefined && val !== def;
      if (typeof val === "boolean") return val !== undefined && val !== def;
      return val !== undefined && val !== "" && val !== def;
    });
  }, [filters]);

  const totalTransactions = (transactionsQuery.data as any)?.total ?? 0;
  const currentTransactions =
    (transactionsQuery.data as any)?.transactions?.length ?? 0;
  const currentPage = filters.page ?? 1;
  const hasMore =
    currentTransactions + (currentPage - 1) * (filters.limit ?? 20) <
    totalTransactions;

  // ── Handlers ──────────────────────────────────────────────────────────────
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

  const handleAttachmentsPress = useCallback(
    (t: Transaction) => setViewingAttachmentsFor(t),
    [],
  );

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

  const handleVendorFilter = useCallback((vendor?: string) => {
    setFilters((prev) => ({ ...prev, vendor: vendor || undefined, page: 1 }));
  }, []);

  const handlePaymentStatusFilter = useCallback((status?: "paid" | "due") => {
    setFilters((prev) => ({
      ...prev,
      payment_status: status || undefined,
      loan_filter: undefined,
      page: 1,
    }));
  }, []);

  const handleLoadMore = useCallback(() => {
    setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }));
  }, []);

  const handleFilterChange = useCallback(
    (next: Partial<TransactionFilters>) => {
      setFilters((prev) => ({ ...prev, ...next }));
    },
    [],
  );

  const handleResetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
    void refreshAppData(queryClient);
  }, [queryClient]);

  const openTransferModal = useCallback(() => {
    if (accountsQuery.isLoading) {
      Toast.show({ type: "info", text1: "Loading accounts" });
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
  }, [accountsQuery.isLoading, accountOptions.length]);

  const handleExportPdf = useCallback(async () => {
    try {
      await exportTransactionsPdf(filters);
      Toast.show({ type: "success", text1: "PDF exported successfully!" });
    } catch {
      Toast.show({ type: "error", text1: "Failed to export PDF" });
    }
  }, [filters]);

  const handleTransactionSubmit = async (
    values: TransactionFormValues,
  ): Promise<{ _id: string } | void> => {
    const payload = {
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
    };

    if (editingTransaction) {
      await updateMutation.mutateAsync({
        transactionId: editingTransaction._id,
        ...payload,
      } as any);
    } else {
      const created = await createMutation.mutateAsync(payload as any);
      return { _id: created._id };
    }
  };

  const handleTransferSubmit = async (values: TransferFormValues) => {
    const transfer = await createTransferMutation.mutateAsync({
      fromAccountId: values.fromAccountId,
      toAccountId: values.toAccountId,
      amount: Number(values.amount),
      date: values.date?.trim() || undefined,
      description: values.description?.trim() || undefined,
      comment: values.comment?.trim() || undefined,
      counterparty: values.counterparty?.trim() || undefined,
    } as any);
    return transfer;
  };

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingTransaction(null);
  }, []);

  const closeTransferModal = useCallback(
    () => setTransferModalVisible(false),
    [],
  );

  return {
    // state
    filters,
    isModalVisible,
    isTransferModalVisible,
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
    categoryOptions,
    counterpartyOptions,
    vendorOptions,
    totals,
    hasActiveFilters,
    hasMore,
    currentTransactions,
    // org/permissions
    canCreateTransactions,
    canEditTransactions,
    activeOrganization,
    isDeleteModeActive,
    // mutations pending
    isSubmitting: createMutation.isPending || updateMutation.isPending,
    isTransferSubmitting: createTransferMutation.isPending,
    // setters
    setPayingDueTxn,
    setViewingChainFor,
    setViewingAttachmentsFor,
    setModalVisible,
    // handlers
    handleEditTransaction,
    handleDeleteTransaction,
    handleAttachmentsPress,
    handleCategoryFilter,
    handleCounterpartyFilter,
    handleVendorFilter,
    handlePaymentStatusFilter,
    handleLoadMore,
    handleFilterChange,
    handleResetFilters,
    openTransferModal,
    handleExportPdf,
    handleTransactionSubmit,
    handleTransferSubmit,
    closeModal,
    closeTransferModal,
    // constants
    DEFAULT_FILTERS,
  };
}
