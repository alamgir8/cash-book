import { useEffect, useState } from "react";
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
import type { TransactionFilters } from "../services/transactions";
import { SearchableSelect, type SelectOption } from "./searchable-select";

const ranges = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

const quickFilters = [
  { label: "Today", value: "today" },
  { label: "Last 7 Days", value: "last7days" },
  { label: "Last 30 Days", value: "last30days" },
  { label: "This Month", value: "thismonth" },
  { label: "Last Month", value: "lastmonth" },
  { label: "This Year", value: "thisyear" },
];

const getDateRangeFromQuickFilter = (
  filter: string,
): { startDate: string; endDate: string } => {
  const today = new Date();
  const endDate = new Date(today);
  let startDate = new Date(today);

  switch (filter) {
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
  showTypeToggle?: boolean;
  showCategoryField?: boolean;
  categories?: SelectOption[];
  showCounterpartyField?: boolean;
  counterparties?: SelectOption[];
  hasActiveFilters?: boolean;
  onReset?: () => void;
  onApplyFilters?: () => void;
};

// Internal state for form inputs
type FilterForm = TransactionFilters & {
  searchInput?: string;
  accountNameInput?: string;
};

export const FilterBar = ({
  filters,
  onChange,
  showAccountField = true,
  showTypeToggle = false,
  showCategoryField = false,
  categories,
  showCounterpartyField = false,
  counterparties,
  hasActiveFilters,
  onReset,
  onApplyFilters,
}: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [formFilters, setFormFilters] = useState<FilterForm>({
    ...filters,
    searchInput: filters.search || "",
    accountNameInput: filters.accountName || "",
  });

  useEffect(() => {
    setFormFilters({
      ...filters,
      searchInput: filters.search ?? "",
      accountNameInput: filters.accountName ?? "",
    });
  }, [filters]);

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
          filters.type ||
          filters.search ||
          filters.q ||
          filters.accountName ||
          filters.minAmount !== undefined ||
          filters.maxAmount !== undefined ||
          filters.includeDeleted,
        );

  return (
    <View className="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm">
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
            onPress={() =>
              onChange({ ...filters, range: range.value, page: 1 })
            }
            className={`px-3 py-1.5 rounded-full border ${
              filters.range === range.value
                ? "bg-blue-50 border-blue-500"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                filters.range === range.value
                  ? "text-blue-700"
                  : "text-gray-600"
              }`}
            >
              {range.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          onPress={() => setExpanded((prev) => !prev)}
          className="flex-row items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50"
        >
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color="#3b82f6"
          />
          <Text className="text-gray-600 text-sm font-semibold">Filters</Text>
        </TouchableOpacity>

        {onReset && derivedHasActiveFilters ? (
          <TouchableOpacity
            onPress={() => {
              onReset();
              setExpanded(false);
            }}
            className="flex-row items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-red-50"
          >
            <Ionicons name="refresh" size={16} color="#dc2626" />
            <Text className="text-red-600 text-sm font-semibold">Reset</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {showTypeToggle ? (
        <View className="flex-row gap-2 mt-3">
          {[
            { label: "All", value: undefined },
            { label: "Credit", value: "credit" as const },
            { label: "Debit", value: "debit" as const },
          ].map((option) => {
            const isActive =
              option.value === undefined
                ? !filters.type
                : filters.type === option.value;
            return (
              <TouchableOpacity
                key={option.label}
                onPress={() =>
                  onChange({
                    ...filters,
                    type: option.value,
                    page: 1,
                  })
                }
                className={`flex-1 py-1.5 rounded-full border ${
                  isActive
                    ? option.value === "credit"
                      ? "border-green-500 bg-green-50"
                      : option.value === "debit"
                        ? "border-red-500 bg-red-50"
                        : "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <Text
                  className={`text-center text-sm font-semibold ${
                    isActive
                      ? option.value === "credit"
                        ? "text-green-700"
                        : option.value === "debit"
                          ? "text-red-600"
                          : "text-blue-700"
                      : "text-gray-600"
                  }`}
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
          {quickFilters.map((qf) => (
            <TouchableOpacity
              key={qf.value}
              onPress={() => {
                const dateRange = getDateRangeFromQuickFilter(qf.value);
                onChange({
                  ...filters,
                  ...dateRange,
                  page: 1,
                });
              }}
              className="px-3 py-1 rounded-full border border-purple-200 bg-purple-50"
            >
              <Text className="text-purple-700 text-xs font-semibold">
                {qf.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {expanded ? (
        <View className="mt-3 gap-3">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-gray-700 text-sm font-semibold mb-1.5">
                Start Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowStartDatePicker(true)}
                className="bg-gray-50 px-3 py-2.5 rounded-xl border border-gray-200 flex-row items-center justify-between"
              >
                <Text
                  className={`${
                    formFilters.startDate ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  {formFilters.startDate || "Select start date"}
                </Text>
                <Ionicons name="calendar-outline" size={16} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <Text className="text-gray-700 text-sm font-semibold mb-1.5">
                End Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowEndDatePicker(true)}
                className="bg-gray-50 px-3 py-2.5 rounded-xl border border-gray-200 flex-row items-center justify-between"
              >
                <Text
                  className={`${
                    formFilters.endDate ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  {formFilters.endDate || "Select end date"}
                </Text>
                <Ionicons name="calendar-outline" size={16} color="#6b7280" />
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

          <View className="flex-row gap-3">
            {showAccountField ? (
              <View className="flex-1">
                <Text className="text-gray-700 text-sm font-semibold mb-1.5">
                  Account Name
                </Text>
                <TextInput
                  value={formFilters.accountNameInput ?? ""}
                  onChangeText={(value) =>
                    setFormFilters({ ...formFilters, accountNameInput: value })
                  }
                  placeholder="Search account..."
                  placeholderTextColor="#9ca3af"
                  className="bg-gray-50 text-gray-900 px-3 py-2.5 rounded-xl border border-gray-200"
                />
              </View>
            ) : null}
          </View>

          {showCategoryField && categories ? (
            <View>
              <SearchableSelect
                label="Category"
                placeholder={
                  categories.length === 0
                    ? "No categories"
                    : "Filter by category"
                }
                value={formFilters.categoryId ?? ""}
                options={
                  categories.length > 0
                    ? [{ value: "", label: "All categories" }, ...categories]
                    : [{ value: "", label: "All categories" }]
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
                label="Counterparty"
                placeholder={
                  counterparties.length === 0
                    ? "No counterparties"
                    : "Filter by counterparty"
                }
                value={formFilters.counterparty ?? ""}
                options={
                  counterparties.length > 0
                    ? [
                        { value: "", label: "All counterparties" },
                        ...counterparties,
                      ]
                    : [{ value: "", label: "All counterparties" }]
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

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-gray-700 text-sm font-semibold mb-1.5">
                Amount Range
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
                  placeholder="Min"
                  placeholderTextColor="#9ca3af"
                  className="flex-1 bg-gray-50 text-gray-900 px-3 py-2.5 rounded-xl border border-gray-200"
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
                  placeholder="Max"
                  placeholderTextColor="#9ca3af"
                  className="flex-1 bg-gray-50 text-gray-900 px-3 py-2.5 rounded-xl border border-gray-200"
                />
              </View>
            </View>
          </View>

          <View>
            <Text className="text-gray-700 text-sm font-semibold mb-1.5">
              Search Keywords
            </Text>
            <TextInput
              value={formFilters.searchInput ?? ""}
              onChangeText={(value) =>
                setFormFilters({ ...formFilters, searchInput: value })
              }
              placeholder="Search description or comments..."
              placeholderTextColor="#9ca3af"
              className="bg-gray-50 text-gray-900 px-3 py-2.5 rounded-xl border border-gray-200"
            />
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3 pt-2">
            <ActionButton
              label="Apply Filters"
              onPress={() => {
                const { searchInput, accountNameInput, ...rest } = formFilters;
                const {
                  categoryId,
                  counterparty,
                  search: _ignoredSearch,
                  accountName: _ignoredAccountName,
                  ...other
                } = rest;
                const updatedFilters: TransactionFilters = {
                  ...other,
                  page: 1,
                };

                if (categoryId) {
                  updatedFilters.categoryId = categoryId;
                }

                if (counterparty) {
                  updatedFilters.counterparty = counterparty;
                }

                if (searchInput && searchInput.trim().length > 0) {
                  updatedFilters.search = searchInput.trim();
                }

                if (accountNameInput && accountNameInput.trim().length > 0) {
                  updatedFilters.accountName = accountNameInput.trim();
                }
                onChange(updatedFilters);
                onApplyFilters?.();
              }}
              variant="primary"
              size="small"
              icon="checkmark"
            />

            {onReset && (
              <ActionButton
                label="Reset"
                onPress={() => {
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
