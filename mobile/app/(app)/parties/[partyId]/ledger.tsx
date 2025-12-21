import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../../../components/screen-header";
import { partiesApi } from "../../../../services/parties";

export default function PartyLedgerScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const limit = 50;

  const { data: party } = useQuery({
    queryKey: ["party", partyId],
    queryFn: () => partiesApi.get(partyId!),
    enabled: !!partyId,
  });

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["partyLedger", partyId, page],
    queryFn: () => partiesApi.getLedger(partyId!, { page, limit }),
    enabled: !!partyId,
  });

  const ledgerEntries = useMemo(() => data?.entries || [], [data?.entries]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatAmount = (amount: number) => {
    return Math.abs(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatBalance = (balance: number) => {
    const absBalance = Math.abs(balance);
    const formatted = absBalance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (balance > 0) return `${formatted} Dr`;
    if (balance < 0) return `${formatted} Cr`;
    return "0.00";
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <ScreenHeader title="Party Ledger" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScreenHeader title={party?.name || "Party Ledger"} showBack />

      {/* Summary Card */}
      <View className="bg-white p-4 border-b border-gray-100">
        <View className="flex-row">
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Opening Balance</Text>
            <Text className="text-base font-semibold text-gray-900 mt-1">
              {data?.summary?.opening_balance
                ? formatBalance(data.summary.opening_balance)
                : "0.00"}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Total Debit</Text>
            <Text className="text-base font-semibold text-green-600 mt-1">
              {data?.summary?.total_debit
                ? formatAmount(data.summary.total_debit)
                : "0.00"}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Total Credit</Text>
            <Text className="text-base font-semibold text-red-600 mt-1">
              {data?.summary?.total_credit
                ? formatAmount(data.summary.total_credit)
                : "0.00"}
            </Text>
          </View>
        </View>
        <View className="mt-4 p-3 bg-gray-50 rounded-lg">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-gray-600">Closing Balance</Text>
            <Text
              className={`text-lg font-bold ${
                (data?.summary?.closing_balance || 0) > 0
                  ? "text-green-600"
                  : (data?.summary?.closing_balance || 0) < 0
                  ? "text-red-600"
                  : "text-gray-600"
              }`}
            >
              {data?.summary?.closing_balance
                ? formatBalance(data.summary.closing_balance)
                : "0.00"}
            </Text>
          </View>
        </View>
      </View>

      {/* Ledger Entries */}
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {/* Table Header */}
        <View className="flex-row bg-gray-100 px-4 py-3 border-b border-gray-200">
          <Text className="w-20 text-xs font-semibold text-gray-600">Date</Text>
          <Text className="flex-1 text-xs font-semibold text-gray-600">
            Particulars
          </Text>
          <Text className="w-20 text-xs font-semibold text-gray-600 text-right">
            Debit
          </Text>
          <Text className="w-20 text-xs font-semibold text-gray-600 text-right">
            Credit
          </Text>
          <Text className="w-24 text-xs font-semibold text-gray-600 text-right">
            Balance
          </Text>
        </View>

        {ledgerEntries.length === 0 ? (
          <View className="p-8 items-center">
            <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
            <Text className="text-base text-gray-500 mt-4">
              No ledger entries found
            </Text>
          </View>
        ) : (
          <View className="bg-white">
            {/* Opening Balance Row */}
            {data?.summary?.opening_balance !== 0 && (
              <View className="flex-row px-4 py-3 border-b border-gray-100 bg-gray-50">
                <Text className="w-20 text-xs text-gray-500">-</Text>
                <Text className="flex-1 text-xs text-gray-600 italic">
                  Opening Balance
                </Text>
                <Text className="w-20 text-xs text-gray-600 text-right">-</Text>
                <Text className="w-20 text-xs text-gray-600 text-right">-</Text>
                <Text
                  className={`w-24 text-xs font-medium text-right ${
                    (data?.summary?.opening_balance || 0) > 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatBalance(data?.summary?.opening_balance || 0)}
                </Text>
              </View>
            )}

            {ledgerEntries.map((entry, index) => (
              <TouchableOpacity
                key={entry._id || index}
                className={`flex-row px-4 py-3 border-b border-gray-100 ${
                  index % 2 === 0 ? "bg-white" : "bg-gray-50"
                }`}
                onPress={() => {
                  if (entry.invoice_id) {
                    router.push(`/invoices/${entry.invoice_id}` as any);
                  }
                }}
              >
                <Text className="w-20 text-xs text-gray-600">
                  {formatDate(entry.date)}
                </Text>
                <View className="flex-1 pr-2">
                  <Text className="text-xs text-gray-900" numberOfLines={2}>
                    {entry.description || entry.type}
                  </Text>
                  {entry.reference && (
                    <Text className="text-xs text-gray-400 mt-0.5">
                      Ref: {entry.reference}
                    </Text>
                  )}
                </View>
                <Text className="w-20 text-xs text-green-600 text-right">
                  {entry.debit > 0 ? formatAmount(entry.debit) : "-"}
                </Text>
                <Text className="w-20 text-xs text-red-600 text-right">
                  {entry.credit > 0 ? formatAmount(entry.credit) : "-"}
                </Text>
                <Text
                  className={`w-24 text-xs font-medium text-right ${
                    entry.running_balance > 0
                      ? "text-green-600"
                      : entry.running_balance < 0
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}
                >
                  {formatBalance(entry.running_balance)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Pagination */}
        {data?.pagination && data.pagination.pages > 1 && (
          <View className="flex-row items-center justify-center py-4 gap-4">
            <TouchableOpacity
              className={`px-4 py-2 rounded-lg ${
                page <= 1 ? "bg-gray-100" : "bg-blue-500"
              }`}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <Text
                className={`text-sm font-medium ${
                  page <= 1 ? "text-gray-400" : "text-white"
                }`}
              >
                Previous
              </Text>
            </TouchableOpacity>
            <Text className="text-sm text-gray-600">
              Page {page} of {data.pagination.pages}
            </Text>
            <TouchableOpacity
              className={`px-4 py-2 rounded-lg ${
                page >= data.pagination.pages ? "bg-gray-100" : "bg-blue-500"
              }`}
              onPress={() =>
                setPage((p) => Math.min(data.pagination.pages, p + 1))
              }
              disabled={page >= data.pagination.pages}
            >
              <Text
                className={`text-sm font-medium ${
                  page >= data.pagination.pages ? "text-gray-400" : "text-white"
                }`}
              >
                Next
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
