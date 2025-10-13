import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import Toast from "react-native-toast-message";
import { FilterBar } from "../../../components/filter-bar";
import { TransactionCard } from "../../../components/transaction-card";
import { exportTransactionsPdf } from "../../../services/reports";
import {
  fetchAccountDetail,
  fetchAccountTransactions,
} from "../../../services/accounts";
import { queryKeys } from "../../../lib/queryKeys";
import type { TransactionFilters } from "../../../services/transactions";

const defaultFilters: TransactionFilters = {
  range: "monthly",
  page: 1,
  limit: 50,
};

const formatAmount = (value: number) =>
  `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function AccountDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const accountId = Array.isArray(params.accountId)
    ? params.accountId[0]
    : params.accountId;

  const [filters, setFilters] = useState<TransactionFilters>({
    ...defaultFilters,
  });
  const [exporting, setExporting] = useState(false);

  const detailQuery = useQuery({
    queryKey: accountId ? queryKeys.accountDetail(accountId) : ["account", "detail"],
    queryFn: () => fetchAccountDetail(accountId!),
    enabled: Boolean(accountId),
  });

  const transactionsQuery = useQuery({
    queryKey: accountId
      ? queryKeys.accountTransactions(accountId, filters)
      : ["account", "transactions"],
    queryFn: () => fetchAccountTransactions(accountId!, filters),
    enabled: Boolean(accountId),
  });

  const account = detailQuery.data?.account;
  const summary = detailQuery.data?.summary;
  const transactions = transactionsQuery.data?.transactions ?? [];

  const netFlow = useMemo(() => {
    if (!summary) return 0;
    return (summary.totalCredit ?? 0) - (summary.totalDebit ?? 0);
  }, [summary]);

  const handleFilterChange = (next: TransactionFilters) => {
    setFilters((prev) => ({
      ...prev,
      ...next,
      limit: next.limit ?? prev.limit,
    }));
  };

  const handleResetFilters = () => {
    setFilters({ ...defaultFilters });
  };

  const handleExport = async () => {
    if (!accountId) return;
    try {
      setExporting(true);
      await exportTransactionsPdf({ ...filters, accountId });
      Toast.show({ type: "success", text1: "PDF exported successfully" });
    } catch (error) {
      console.error(error);
      Toast.show({ type: "error", text1: "Failed to export PDF" });
    } finally {
      setExporting(false);
    }
  };

  const handleRefresh = () => {
    detailQuery.refetch();
    transactionsQuery.refetch();
  };

  if (!accountId) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Text className="text-gray-500 text-base">
          Account not found. Please go back and try again.
        </Text>
      </View>
    );
  }

  if (detailQuery.isLoading && !detailQuery.data) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  const lastActivityLabel = summary?.lastTransactionDate
    ? dayjs(summary.lastTransactionDate).format("MMM D, YYYY")
    : "No activity yet";
  const netPositive = netFlow >= 0;

  const renderHeader = () => (
    <View className="gap-4">
      <View className="flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-white border border-gray-200 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={20} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900">
          {account?.name ?? "Account"}
        </Text>
      </View>

      <View className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-4">
            <View className="flex-row items-center gap-2">
              <View
                className={`px-3 py-1 rounded-full ${
                  account?.type === "credit"
                    ? "bg-green-50 border border-green-200"
                    : "bg-blue-50 border border-blue-200"
                }`}
              >
                <Text
                  className={`text-xs font-semibold uppercase ${
                    account?.type === "credit"
                      ? "text-green-700"
                      : "text-blue-600"
                  }`}
                >
                  {account?.type ?? "Account"}
                </Text>
              </View>
              <Text className="text-xs text-gray-500">
                Last activity: {lastActivityLabel}
              </Text>
            </View>
            {account?.description ? (
              <Text className="text-gray-600 text-sm mt-3 leading-5">
                {account.description}
              </Text>
            ) : null}
          </View>
          <View className="items-end">
            <Text className="text-gray-500 text-xs font-semibold uppercase">
              Balance
            </Text>
            <Text
              className={`text-3xl font-bold ${
                (account?.balance ?? 0) >= 0
                  ? "text-emerald-600"
                  : "text-rose-600"
              }`}
            >
              {formatAmount(Math.abs(account?.balance ?? 0))}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3 mt-4">
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(app)/accounts",
                params: { accountId },
              })
            }
            className="flex-1 flex-row items-center justify-center gap-2 border border-gray-200 rounded-xl py-3 bg-gray-50"
          >
            <Ionicons name="pencil" size={18} color="#334155" />
            <Text className="text-gray-700 font-semibold">Edit Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleExport}
            disabled={exporting}
            className="flex-1 flex-row items-center justify-center gap-2 bg-blue-500 rounded-xl py-3"
          >
            <Ionicons
              name={exporting ? "cloud-download" : "document-text-outline"}
              size={18}
              color="#fff"
            />
            <Text className="text-white font-semibold">
              {exporting ? "Exporting..." : "Export PDF"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <Text className="text-gray-900 font-bold text-lg mb-4">
          Account Summary
        </Text>
        <View className="flex-row gap-3">
          <View className="flex-1 bg-blue-50 rounded-xl p-3 border border-blue-100">
            <Text className="text-xs font-semibold text-blue-600 uppercase">
              Total Credit
            </Text>
            <Text className="text-xl font-bold text-blue-700 mt-1">
              {formatAmount(summary?.totalCredit ?? 0)}
            </Text>
          </View>
          <View className="flex-1 bg-amber-50 rounded-xl p-3 border border-amber-100">
            <Text className="text-xs font-semibold text-amber-600 uppercase">
              Total Debit
            </Text>
            <Text className="text-xl font-bold text-amber-700 mt-1">
              {formatAmount(summary?.totalDebit ?? 0)}
            </Text>
          </View>
        </View>
        <View className="flex-row gap-3 mt-3">
          <View
            className={`flex-1 rounded-xl p-3 border ${
              netPositive
                ? "bg-emerald-50 border-emerald-100"
                : "bg-rose-50 border-rose-100"
            }`}
          >
            <Text
              className={`text-xs font-semibold uppercase ${
                netPositive ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              Net Flow
            </Text>
            <Text
              className={`text-xl font-bold mt-1 ${
                netPositive ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {`${netPositive ? "+" : "-"}${formatAmount(Math.abs(netFlow))}`}
            </Text>
          </View>
          <View className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-200">
            <Text className="text-xs font-semibold text-gray-600 uppercase">
              Transactions
            </Text>
            <Text className="text-xl font-bold text-gray-700 mt-1">
              {summary?.totalTransactions ?? 0}
            </Text>
          </View>
        </View>
      </View>

      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        showAccountField={false}
        showTypeToggle
        onReset={handleResetFilters}
      />
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={transactions}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          transactionsQuery.isLoading ? (
            <ActivityIndicator color="#3b82f6" style={{ marginTop: 48 }} />
          ) : (
            <View className="items-center gap-3 bg-white rounded-2xl p-6 border border-gray-100 mt-6">
              <Ionicons name="document-text-outline" size={36} color="#94a3b8" />
              <Text className="text-gray-700 font-semibold">
                No transactions matching filters
              </Text>
              <Text className="text-gray-500 text-sm text-center">
                Adjust the filters or record a new transaction from the dashboard.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(app)")}
                className="px-4 py-2 rounded-full bg-blue-500"
              >
                <Text className="text-white font-semibold">
                  Go to Dashboard
                </Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item }) => <TransactionCard transaction={item} />}
        refreshControl={
          <RefreshControl
            refreshing={transactionsQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor="#3b82f6"
          />
        }
      />
    </View>
  );
}
