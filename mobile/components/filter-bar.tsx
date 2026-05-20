import { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { ActionButton } from "./action-button";
import { useTheme } from "../hooks/use-theme";
import { useTranslation } from "../hooks/use-translation";
import type { TransactionFilters } from "../services/transactions";
import { SearchableSelect, type SelectOption } from "./searchable-select";

const getDateRangeFromQuickFilter = (
  filter: string,
): { startDate: string; endDate: string } => {
  const today = new Date();
  let endDate = new Date(today);
  let startDate = new Date(today);

  switch (filter) {
    case "all":
      startDate = new Date(1970, 0, 1);
      break;
    case "today":
      startDate = new Date(today);
      break;
    case "last7days":
      startDate = new Date(today.setDate(today.getDate() - 7));
      break;
    case "last30days":
      startDate = new Date(today.setDate(today.getDate() - 30));
      break;
    case "thismonth":
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case "lastmonth":
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      startDate = lastMonth;
      endDate = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case "thisyear":
      startDate = new Date(today.getFullYear(), 0, 1);
      break;
  }

  const formatDate = (date: Date) => date.toISOString().split("T")[0];
  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
};

type Props = {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  showAccountField?: boolean;
  accounts?: SelectOption[];
  showTypeToggle?: boolean;
  showCategoryField?: boolean;
  categories?: SelectOption[];
  showCounterpartyField?: boolean;
  counterparties?: SelectOption[];
  showVendorField?: boolean;
  vendors?: SelectOption[];
  showPaymentStatusFilter?: boolean;
  hasActiveFilters?: boolean;
  onReset?: () => void;
  onApplyFilters?: () => void;
};

// Internal state for form inputs
type FilterForm = TransactionFilters & {
  searchInput?: string;
};

export const FilterBar = ({
  filters,
  onChange,
  showAccountField = true,
  accounts,
  showTypeToggle = false,
  showCategoryField = false,
  categories,
  showCounterpartyField = false,
  counterparties,
  showVendorField = false,
  vendors,
  showPaymentStatusFilter = false,
  hasActiveFilters,
  onReset,
  onApplyFilters,
}: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const ranges = [
    { label: t("daily"), value: "daily" },
    { label: t("weekly"), value: "weekly" },
    { label: t("monthly"), value: "monthly" },
    { label: t("yearly"), value: "yearly" },
  ];

  const quickFilters = [
    { label: t("filterAll"), value: "all" },
    { label: t("today"), value: "today" },
    { label: t("last7Days"), value: "last7days" },
    { label: t("last30Days"), value: "last30days" },
    { label: t("thisMonth"), value: "thismonth" },
    { label: t("lastMonth"), value: "lastmonth" },
    { label: t("thisYear"), value: "thisyear" },
  ];

  const [expanded, setExpanded] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [formFilters, setFormFilters] = useState<FilterForm>({
    ...filters,
    searchInput: filters.search || "",
  });
  // Track which quick-filter pill is currently active
  const [activeQuickFilter, setActiveQuickFilter] = useState<string>("all");
  // Prevent useEffect from resetting form while user is interacting
  const isUserInteracting = useRef(false);

  // Derive active quick filter from current filters (on external reset)
  const deriveQuickFilter = useCallback((f: TransactionFilters): string => {
    if (!f.startDate && !f.endDate) return "all";
    const today = new Date().toISOString().split("T")[0];
    if (f.startDate === today && (!f.endDate || f.endDate === today))
      return "today";
    return "custom";
  }, []);

  useEffect(() => {
    // Only sync from parent when the expanded panel is not open (to avoid
    // resetting in-progress form edits) OR when it's an external reset
    if (!expanded || !isUserInteracting.current) {
      setFormFilters({
        ...filters,
        searchInput: filters.search ?? "",
      });
      setActiveQuickFilter(deriveQuickFilter(filters));
    }
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Convert date strings to Date objects for the picker
  const startDate = formFilters.startDate
    ? new Date(formFilters.startDate)
    : new Date();
  const endDate = formFilters.endDate
    ? new Date(formFilters.endDate)
    : new Date();

  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0]; // YYYY-MM-DD format
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      setFormFilters({
        ...formFilters,
        startDate: formatDate(selectedDate),
      });
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      setFormFilters({
        ...formFilters,
        endDate: formatDate(selectedDate),
      });
    }
  };

  const derivedHasActiveFilters =
    typeof hasActiveFilters === "boolean"
      ? hasActiveFilters
      : Boolean(
          filters.startDate ||
          filters.endDate ||
          filters.accountId ||
          filters.categoryId ||
          filters.counterparty ||
          filters.vendor ||
          filters.payment_status ||
          filters.loan_filter ||
          filters.type ||
          filters.search ||
          filters.q ||
          filters.accountName ||
          filters.minAmount !== undefined ||
          filters.maxAmount !== undefined ||
          filters.includeDeleted,
        );

  return (
    <View
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
      }}
      className="rounded-2xl p-3 border shadow-sm"
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={{ paddingRight: 12 }}
        className="flex-row gap-2.5"
      >
        {ranges.map((range) => (
          <TouchableOpacity
            key={range.value}
            onPress={() => onChange({ range: range.value, page: 1 })}
            style={{
              backgroundColor:
                filters.range === range.value
                  ? colors.info
                  : colors.bg.tertiary,
              borderColor:
                filters.range === range.value ? colors.info : colors.border,
            }}
            className="px-3 py-1.5 rounded-full border"
          >
            <Text
              style={{
                color:
                  filters.range === range.value
                    ? "#ffffff"
                    : colors.text.primary,
              }}
              className="text-sm font-semibold"
            >
              {range.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          onPress={() => {
            const next = !expanded;
            setExpanded(next);
            if (next) {
              isUserInteracting.current = true;
            } else {
              isUserInteracting.current = false;
            }
          }}
          style={{
            backgroundColor: expanded ? colors.info + "20" : colors.bg.tertiary,
            borderColor: expanded ? colors.info : colors.border,
          }}
          className="flex-row items-center gap-1 px-3 py-1.5 rounded-full border"
        >
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.info}
          />
          <Text
            style={{ color: expanded ? colors.info : colors.text.primary }}
            className="text-sm font-semibold"
          >
            {t("filters")}
          </Text>
        </TouchableOpacity>

        {onReset && derivedHasActiveFilters ? (
          <TouchableOpacity
            onPress={() => {
              setActiveQuickFilter("all");
              isUserInteracting.current = false;
              onReset();
              setExpanded(false);
            }}
            style={{
              backgroundColor: colors.error + "20",
              borderColor: colors.error + "40",
            }}
            className="flex-row items-center gap-1 px-3 py-1.5 rounded-full border"
          >
            <Ionicons name="refresh" size={16} color={colors.error} />
            <Text
              style={{ color: colors.error }}
              className="text-sm font-semibold"
            >
              {t("reset")}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {showTypeToggle ? (
        <View className="flex-row gap-2 mt-3">
          {[
            { label: t("filterAll"), value: undefined },
            { label: t("filterCredit"), value: "credit" as const },
            { label: t("filterDebit"), value: "debit" as const },
          ].map((option) => {
            const isActive =
              option.value === undefined
                ? !filters.type
                : filters.type === option.value;
            const bgColor = isActive
              ? option.value === "credit"
                ? colors.success
                : option.value === "debit"
                  ? colors.error
                  : colors.info
              : colors.bg.tertiary;
            const borderColor = isActive
              ? option.value === "credit"
                ? colors.success
                : option.value === "debit"
                  ? colors.error
                  : colors.info
              : colors.border;
            const textColor = isActive ? "#ffffff" : colors.text.primary;

            return (
              <TouchableOpacity
                key={option.label}
                onPress={() =>
                  onChange({
                    type: option.value,
                    page: 1,
                  })
                }
                style={{
                  backgroundColor: bgColor,
                  borderColor,
                }}
                className="flex-1 py-1.5 rounded-full border"
              >
                <Text
                  style={{ color: textColor }}
                  className="text-center text-sm font-semibold"
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {/* Payment Status quick pills */}
      {showPaymentStatusFilter ? (
        <View className="flex-row flex-wrap gap-2 mt-3">
          {[
            {
              label: t("filterAll"),
              paymentStatus: undefined,
              loanFilter: undefined,
            },
            {
              label: t("filterPaid"),
              paymentStatus: "paid" as const,
              loanFilter: undefined,
            },
            {
              label: t("filterDue"),
              paymentStatus: "due" as const,
              loanFilter: undefined,
            },
            {
              label: t("filterLoanGiven"),
              paymentStatus: undefined,
              loanFilter: "loan_given" as const,
            },
            {
              label: t("filterLoanReceived"),
              paymentStatus: undefined,
              loanFilter: "loan_received" as const,
            },
          ].map((option) => {
            const isActive =
              option.paymentStatus === undefined &&
              option.loanFilter === undefined
                ? !filters.payment_status && !filters.loan_filter
                : option.paymentStatus
                  ? filters.payment_status === option.paymentStatus &&
                    !filters.loan_filter
                  : filters.loan_filter === option.loanFilter;
            const activeColor =
              option.paymentStatus === "due"
                ? "#d97706"
                : option.paymentStatus === "paid"
                  ? "#16a34a"
                  : option.loanFilter === "loan_given"
                    ? "#dc2626"
                    : option.loanFilter === "loan_received"
                      ? "#2563eb"
                      : colors.info;
            return (
              <TouchableOpacity
                key={option.label}
                onPress={() =>
                  onChange({
                    payment_status: option.paymentStatus,
                    loan_filter: option.loanFilter,
                    page: 1,
                  })
                }
                style={{
                  backgroundColor: isActive ? activeColor : colors.bg.tertiary,
                  borderColor: isActive ? activeColor : colors.border,
                }}
                className="px-3 py-1.5 rounded-full border"
              >
                <Text
                  style={{ color: isActive ? "#ffffff" : colors.text.primary }}
                  className="text-center text-sm font-semibold"
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {!expanded && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row gap-2 mt-3"
          contentContainerStyle={{ paddingRight: 12 }}
        >
          {quickFilters.map((qf) => {
            const isActive = activeQuickFilter === qf.value;

            return (
              <TouchableOpacity
                key={qf.value}
                onPress={() => {
                  setActiveQuickFilter(qf.value);
                  if (qf.value === "all") {
                    onChange({
                      startDate: undefined,
                      endDate: undefined,
                      page: 1,
                    });
                    return;
                  }
                  const dateRange = getDateRangeFromQuickFilter(qf.value);
                  onChange({
                    ...dateRange,
                    page: 1,
                  });
                }}
                style={{
                  backgroundColor: isActive
                    ? colors.warning
                    : colors.warning + "20",
                  borderColor: isActive
                    ? colors.warning
                    : colors.warning + "50",
                }}
                className="px-3 py-1 rounded-full border"
              >
                <Text
                  style={{ color: isActive ? "#ffffff" : colors.warning }}
                  className="text-xs font-semibold"
                >
                  {qf.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {expanded ? (
        <View className="mt-3 gap-3">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text
                style={{ color: colors.text.primary }}
                className="text-sm font-semibold mb-1.5"
              >
                {t("startDate")}
              </Text>
              <TouchableOpacity
                onPress={() => setShowStartDatePicker(true)}
                style={{
                  backgroundColor: colors.bg.tertiary,
                  borderColor: colors.border,
                }}
                className="px-3 py-2.5 rounded-xl border flex-row items-center justify-between"
              >
                <Text
                  style={{
                    color: formFilters.startDate
                      ? colors.text.primary
                      : colors.text.tertiary,
                  }}
                >
                  {formFilters.startDate || t("selectStartDate")}
                </Text>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <Text
                style={{ color: colors.text.primary }}
                className="text-sm font-semibold mb-1.5"
              >
                {t("endDate")}
              </Text>
              <TouchableOpacity
                onPress={() => setShowEndDatePicker(true)}
                style={{
                  backgroundColor: colors.bg.tertiary,
                  borderColor: colors.border,
                }}
                className="px-3 py-2.5 rounded-xl border flex-row items-center justify-between"
              >
                <Text
                  style={{
                    color: formFilters.endDate
                      ? colors.text.primary
                      : colors.text.tertiary,
                  }}
                >
                  {formFilters.endDate || t("selectEndDate")}
                </Text>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Pickers */}
          {showStartDatePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleStartDateChange}
            />
          )}
          {showEndDatePicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleEndDateChange}
            />
          )}

          {showAccountField && accounts ? (
            <View>
              <SearchableSelect
                label={t("accountFilter")}
                placeholder={
                  accounts.length === 0
                    ? t("noAccountsAvailable")
                    : t("filterByAccount")
                }
                value={formFilters.accountId ?? ""}
                options={
                  accounts.length > 0
                    ? [{ value: "", label: t("allAccounts") }, ...accounts]
                    : [{ value: "", label: t("allAccounts") }]
                }
                onSelect={(val) =>
                  setFormFilters({
                    ...formFilters,
                    accountId: val || undefined,
                  })
                }
                disabled={accounts.length === 0}
              />
            </View>
          ) : null}

          {showCategoryField && categories ? (
            <View>
              <SearchableSelect
                label={t("categoryFilter")}
                placeholder={
                  categories.length === 0
                    ? t("noCategoriesAvailable")
                    : t("filterByCategory")
                }
                value={formFilters.categoryId ?? ""}
                options={
                  categories.length > 0
                    ? [{ value: "", label: t("allCategories") }, ...categories]
                    : [{ value: "", label: t("allCategories") }]
                }
                onSelect={(val) =>
                  setFormFilters({
                    ...formFilters,
                    categoryId: val || undefined,
                  })
                }
                disabled={categories.length === 0}
              />
            </View>
          ) : null}

          {showCounterpartyField && counterparties ? (
            <View>
              <SearchableSelect
                label={t("counterpartyFilter")}
                placeholder={
                  counterparties.length === 0
                    ? t("allCounterparties")
                    : t("filterByCounterparty")
                }
                value={formFilters.counterparty ?? ""}
                options={
                  counterparties.length > 0
                    ? [
                        { value: "", label: t("allCounterparties") },
                        ...counterparties,
                      ]
                    : [{ value: "", label: t("allCounterparties") }]
                }
                onSelect={(val) =>
                  setFormFilters({
                    ...formFilters,
                    counterparty: val || undefined,
                  })
                }
                disabled={counterparties.length === 0}
              />
            </View>
          ) : null}

          {showVendorField && vendors ? (
            <View>
              <SearchableSelect
                label={t("vendorFilter")}
                placeholder={
                  vendors.length === 0 ? t("allVendors") : t("filterByVendor")
                }
                value={formFilters.vendor ?? ""}
                options={
                  vendors.length > 0
                    ? [{ value: "", label: t("allVendors") }, ...vendors]
                    : [{ value: "", label: t("allVendors") }]
                }
                onSelect={(val) =>
                  setFormFilters({
                    ...formFilters,
                    vendor: val || undefined,
                  })
                }
                disabled={vendors.length === 0}
              />
            </View>
          ) : null}

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text
                style={{ color: colors.text.primary }}
                className="text-sm font-semibold mb-1.5"
              >
                {t("amountRange")}
              </Text>
              <View className="flex-row gap-2">
                <TextInput
                  value={
                    formFilters.minAmount ? String(formFilters.minAmount) : ""
                  }
                  onChangeText={(value) =>
                    setFormFilters({
                      ...formFilters,
                      minAmount: value ? Number(value) : undefined,
                    })
                  }
                  keyboardType="numeric"
                  placeholder={t("minPlaceholder")}
                  placeholderTextColor={colors.text.tertiary}
                  style={{
                    backgroundColor: colors.bg.tertiary,
                    color: colors.text.primary,
                    borderColor: colors.border,
                  }}
                  className="flex-1 px-3 py-2.5 rounded-xl border"
                />
                <TextInput
                  value={
                    formFilters.maxAmount ? String(formFilters.maxAmount) : ""
                  }
                  onChangeText={(value) =>
                    setFormFilters({
                      ...formFilters,
                      maxAmount: value ? Number(value) : undefined,
                    })
                  }
                  keyboardType="numeric"
                  placeholder={t("maxPlaceholder")}
                  placeholderTextColor={colors.text.tertiary}
                  style={{
                    backgroundColor: colors.bg.tertiary,
                    color: colors.text.primary,
                    borderColor: colors.border,
                  }}
                  className="flex-1 px-3 py-2.5 rounded-xl border"
                />
              </View>
            </View>
          </View>

          <View>
            <Text
              style={{ color: colors.text.primary }}
              className="text-sm font-semibold mb-1.5"
            >
              {t("searchKeywords")}
            </Text>
            <TextInput
              value={formFilters.searchInput ?? ""}
              onChangeText={(value) =>
                setFormFilters({ ...formFilters, searchInput: value })
              }
              placeholder={t("searchDescriptionPlaceholder")}
              placeholderTextColor={colors.text.tertiary}
              style={{
                backgroundColor: colors.bg.tertiary,
                color: colors.text.primary,
                borderColor: colors.border,
              }}
              className="px-3 py-2.5 rounded-xl border"
            />
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3 pt-2">
            <ActionButton
              label={t("applyFilters")}
              onPress={() => {
                const { searchInput, ...rest } = formFilters;
                const {
                  categoryId,
                  counterparty,
                  vendor,
                  payment_status,
                  loan_filter,
                  accountId: selectedAccountId,
                  search: _ignoredSearch,
                  ...other
                } = rest;
                const updatedFilters: TransactionFilters = {
                  ...other,
                  page: 1,
                };

                if (selectedAccountId) {
                  updatedFilters.accountId = selectedAccountId;
                }
                if (categoryId) {
                  updatedFilters.categoryId = categoryId;
                }
                if (counterparty) {
                  updatedFilters.counterparty = counterparty;
                }
                if (vendor) {
                  updatedFilters.vendor = vendor;
                }
                if (payment_status) {
                  updatedFilters.payment_status = payment_status;
                }
                if (loan_filter) {
                  updatedFilters.loan_filter = loan_filter;
                }
                if (searchInput && searchInput.trim().length > 0) {
                  updatedFilters.search = searchInput.trim();
                }
                // Mark custom filter applied
                if (updatedFilters.startDate || updatedFilters.endDate) {
                  setActiveQuickFilter("custom");
                }
                isUserInteracting.current = false;
                onChange(updatedFilters);
                onApplyFilters?.();
                setExpanded(false);
              }}
              variant="primary"
              size="small"
              icon="checkmark"
            />

            {onReset && (
              <ActionButton
                label={t("reset")}
                onPress={() => {
                  setActiveQuickFilter("all");
                  isUserInteracting.current = false;
                  onReset();
                  setExpanded(false);
                }}
                variant="outline"
                size="small"
                icon="refresh"
              />
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
};
