import { useMemo } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { SelectOption } from "@/components/searchable-select";
import type { Transaction } from "@/services/transactions";
import type { Category } from "@/services/categories";
import {
  translateCategoryName,
  translateCategoryGroup,
  translateFlow,
} from "@/lib/i18n/category-translations";

const formatCategoryGroup = (type?: string) => {
  if (!type) return "Other";
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

type Options = {
  language: string;
  rawTransactions: Transaction[];
  editingCounterparty?: string;
  categoriesQuery: UseQueryResult<Category[]>;
  counterpartiesQuery: UseQueryResult<string[]>;
  vendorsQuery: UseQueryResult<{ _id: string; name: string }[]>;
  accountsQuery: UseQueryResult<
    { _id: string; name: string; kind?: string; balance?: number; currency_symbol?: string }[]
  >;
  formatAmount?: (amount: number, opts?: { showCurrency?: boolean }) => string;
  includeEmptyCategoryOption?: boolean;
};

export function useTransactionFilterOptions({
  language,
  rawTransactions,
  editingCounterparty,
  categoriesQuery,
  counterpartiesQuery,
  vendorsQuery,
  accountsQuery,
  formatAmount,
  includeEmptyCategoryOption = false,
}: Options) {
  const accountOptions: SelectOption[] = useMemo(() => {
    const accounts = accountsQuery.data ?? [];
    return accounts.map((account) => ({
      value: account._id,
      label: account.name,
      subtitle: formatAmount
        ? `${formatAmount(account.balance ?? 0)}${
            account.currency_symbol ? ` · ${account.currency_symbol}` : ""
          }`
        : account.kind?.replace(/_/g, " "),
    }));
  }, [accountsQuery.data, formatAmount]);

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
    const emptyOption = includeEmptyCategoryOption
      ? [
          {
            value: "",
            label: language === "bn" ? "কোনো ক্যাটাগরি নেই" : "No category",
          },
        ]
      : [];
    return [
      ...emptyOption,
      ...categories.map((category) => {
        const rawGroup = formatCategoryGroup(category.type);
        return {
          value: category._id,
          label: translateCategoryName(category.name, language),
          group: translateCategoryGroup(category.type, rawGroup, language),
          flow: category.flow,
        };
      }),
    ];
  }, [categoriesQuery.data, language, includeEmptyCategoryOption]);

  const counterpartyOptions: SelectOption[] = useMemo(() => {
    const api = counterpartiesQuery.data ?? [];
    const fromTxns = rawTransactions
      .map((t) => t.counterparty?.trim())
      .filter((name): name is string => Boolean(name));
    const editing = editingCounterparty?.trim();
    return [...new Set([...api, ...fromTxns, ...(editing ? [editing] : [])])]
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map((name) => ({ value: name, label: name }));
  }, [counterpartiesQuery.data, rawTransactions, editingCounterparty]);

  const vendorOptions: SelectOption[] = useMemo(() => {
    const parties = vendorsQuery.data ?? [];
    return parties
      .map((p) => ({ value: p._id, label: p.name }))
      .sort((a, b) =>
        a.label.toLowerCase().localeCompare(b.label.toLowerCase()),
      );
  }, [vendorsQuery.data]);

  return {
    accountOptions,
    categoryOptions,
    modalCategoryOptions,
    counterpartyOptions,
    vendorOptions,
    partyOptions: vendorOptions,
  };
}
