import { ActivityIndicator, Text, View } from "react-native";
import { FilterBar } from "@/components/filter-bar";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";
import type { TransactionFilters } from "@/services/transactions";
import type { SelectOption } from "@/components/searchable-select";

export type TransactionFilterSectionProps = {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  hasActiveFilters?: boolean;
  onReset?: () => void;
  onApplyFilters?: () => void;
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
  isFetching?: boolean;
  isLoading?: boolean;
  loadingMore?: boolean;
};

export function TransactionFilterSection({
  filters,
  onChange,
  hasActiveFilters,
  onReset,
  onApplyFilters,
  showAccountField,
  accounts,
  showTypeToggle,
  showCategoryField = true,
  categories,
  showCounterpartyField = true,
  counterparties,
  showVendorField = true,
  vendors,
  showPaymentStatusFilter = true,
  isFetching,
  isLoading,
  loadingMore,
}: TransactionFilterSectionProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View className="gap-4">
      <FilterBar
        filters={filters}
        onChange={onChange}
        hasActiveFilters={hasActiveFilters}
        showAccountField={showAccountField}
        accounts={accounts}
        showTypeToggle={showTypeToggle}
        showCategoryField={showCategoryField}
        categories={categories}
        showCounterpartyField={showCounterpartyField}
        counterparties={counterparties}
        showVendorField={showVendorField}
        vendors={vendors}
        showPaymentStatusFilter={showPaymentStatusFilter}
        onReset={onReset}
        onApplyFilters={onApplyFilters}
      />
      {isFetching && !isLoading && !loadingMore ? (
        <View
          className="flex-row items-center justify-center gap-2 py-2 rounded-xl"
          style={{ backgroundColor: colors.info + "15" }}
        >
          <ActivityIndicator size="small" color={colors.info} />
          <Text className="text-sm" style={{ color: colors.info }}>
            {t("loading")}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
