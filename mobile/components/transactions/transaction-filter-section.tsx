import { View } from "react-native";
import { FilterBar } from "@/components/filter-bar";
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
  /** @deprecated Unused — pull-to-refresh covers loading UX */
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
}: TransactionFilterSectionProps) {
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
    </View>
  );
}
