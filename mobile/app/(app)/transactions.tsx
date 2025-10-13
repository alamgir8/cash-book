import { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ScreenHeader } from "../../components/screen-header";
import { EmptyState } from "../../components/empty-state";
import { ActionButton } from "../../components/action-button";
import { TransactionCard } from "../../components/transaction-card";
import { fetchTransactions } from "../../services/transactions";
import { useLocalSearchParams } from "expo-router";

export default function TransactionsScreen() {
  const { accountId } = useLocalSearchParams<{ accountId?: string }>();
  const [selectedFilter, setSelectedFilter] = useState<"all" | "debit" | "credit">("all");
  const [selectedPeriod, setSelectedPeriod] = useState<"all" | "today" | "week" | "month">("all");

  // Fetch transactions with filters
  const transactionsQuery = useQuery({
    queryKey: ["transactions", accountId, selectedFilter, selectedPeriod],
    queryFn: () => {
      const filters: any = {};
      
      if (accountId) {
        filters.accountId = accountId;
      }
      
      if (selectedFilter !== "all") {
        filters.type = selectedFilter;
      }

      // Date filtering
      if (selectedPeriod !== "all") {
        const now = dayjs();
        switch (selectedPeriod) {
          case "today":
            filters.startDate = now.startOf("day").toISOString();
            filters.endDate = now.endOf("day").toISOString();
            break;
          case "week":
            filters.startDate = now.startOf("week").toISOString();
            filters.endDate = now.endOf("week").toISOString();
            break;
          case "month":
            filters.startDate = now.startOf("month").toISOString();
            filters.endDate = now.endOf("month").toISOString();
            break;
        }
      }

      return fetchTransactions(filters);
    },
  });

  const transactions = useMemo(() => {
    return (transactionsQuery.data as any)?.transactions ?? [];
  }, [transactionsQuery.data]);

  const resetFilters = () => {
    setSelectedFilter("all");
    setSelectedPeriod("all");
  };

  const hasActiveFilters = selectedFilter !== "all" || selectedPeriod !== "all";

  const FilterButton = ({ 
    label, 
    active, 
    onPress 
  }: { 
    label: string; 
    active: boolean; 
    onPress: () => void; 
  }) => (
    <TouchableOpacity
      onPress={onPress}
      className={`px-4 py-2 rounded-full border ${
        active 
          ? "bg-blue-600 border-blue-600" 
          : "bg-white border-gray-300"
      }`}
    >
      <Text className={`text-sm font-medium ${
        active ? "text-white" : "text-gray-700"
      }`}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-gray-50">
      <ScreenHeader
        title="Transactions"
        subtitle={accountId ? "Account transactions" : "All transactions"}
        icon="receipt"
      />

      {/* Filter Section */}
      <View className="bg-white px-4 py-4 border-b border-gray-200">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-gray-900 font-semibold text-base">Filters</Text>
          {hasActiveFilters && (
            <TouchableOpacity
              onPress={resetFilters}
              className="flex-row items-center gap-1"
            >
              <Ionicons name="refresh" size={16} color="#6b7280" />
              <Text className="text-gray-500 text-sm">Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Type Filter */}
        <View className="mb-3">
          <Text className="text-gray-700 text-sm font-medium mb-2">Type</Text>
          <View className="flex-row gap-2">
            <FilterButton
              label="All"
              active={selectedFilter === "all"}
              onPress={() => setSelectedFilter("all")}
            />
            <FilterButton
              label="Income"
              active={selectedFilter === "credit"}
              onPress={() => setSelectedFilter("credit")}
            />
            <FilterButton
              label="Expense"
              active={selectedFilter === "debit"}
              onPress={() => setSelectedFilter("debit")}
            />
          </View>
        </View>

        {/* Period Filter */}
        <View>
          <Text className="text-gray-700 text-sm font-medium mb-2">Period</Text>
          <View className="flex-row gap-2 flex-wrap">
            <FilterButton
              label="All Time"
              active={selectedPeriod === "all"}
              onPress={() => setSelectedPeriod("all")}
            />
            <FilterButton
              label="Today"
              active={selectedPeriod === "today"}
              onPress={() => setSelectedPeriod("today")}
            />
            <FilterButton
              label="This Week"
              active={selectedPeriod === "week"}
              onPress={() => setSelectedPeriod("week")}
            />
            <FilterButton
              label="This Month"
              active={selectedPeriod === "month"}
              onPress={() => setSelectedPeriod("month")}
            />
          </View>
        </View>
      </View>

      {/* Transaction List */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <TransactionCard transaction={item} />}
        contentContainerStyle={{
          padding: 16,
          gap: 8,
        }}
        ListEmptyComponent={
          <EmptyState
            isLoading={transactionsQuery.isLoading}
            loadingText="Loading transactions..."
            icon="receipt-outline"
            title={hasActiveFilters ? "No matching transactions" : "No transactions found"}
            description={
              hasActiveFilters
                ? "Try adjusting your filters to see more results"
                : "Start adding transactions to see them here"
            }
            actionButton={hasActiveFilters ? {
              label: "Clear Filters",
              onPress: resetFilters
            } : undefined}
          />
        }
        refreshing={transactionsQuery.isFetching}
        onRefresh={() => transactionsQuery.refetch()}
      />
    </View>
  );
}
