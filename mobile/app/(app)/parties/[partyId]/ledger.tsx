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
import { toast } from "../../../../lib/toast";
import { ScreenHeader } from "../../../../components/screen-header";
import { partiesApi } from "../../../../services/parties";
import { exportPartyLedgerPdf } from "../../../../services/reports";

export default function PartyLedgerScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [exportingPdf, setExportingPdf] = useState(false);
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

  const handleExportPdf = async () => {
    if (!party) {
      toast.error("Party information not loaded");
      return;
    }

    setExportingPdf(true);
    try {
      await exportPartyLedgerPdf(partyId!, party.name);
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    } finally {
      setExportingPdf(false);
    }
  };

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
      <View className="flex-1 bg-gray-50">
        <ScreenHeader title="Party Ledger" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <ScreenHeader
        title={party?.name || "Party Ledger"}
        showBack
        rightAction={
          <TouchableOpacity
            className="p-2"
            onPress={handleExportPdf}
            disabled={exportingPdf || ledgerEntries.length === 0}
          >
            {exportingPdf ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : (
              <Ionicons
                name="download-outline"
                size={24}
                color={ledgerEntries.length === 0 ? "#9CA3AF" : "#3B82F6"}
              />
            )}
          </TouchableOpacity>
        }
      />

      {/* Summary Cards */}
      <View className="px-4 pt-4">
        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Opening Balance */}
          <View className="px-4 py-3 border-b border-gray-100">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium text-gray-600">
                Opening Balance
              </Text>
              <Text
                className={`text-base font-bold ${
                  (data?.summary?.opening_balance || 0) > 0
                    ? "text-green-600"
                    : (data?.summary?.opening_balance || 0) < 0
                    ? "text-red-600"
                    : "text-gray-900"
                }`}
              >
                {data?.summary?.opening_balance
                  ? formatBalance(data.summary.opening_balance)
                  : "0.00"}
              </Text>
            </View>
          </View>

          {/* Debit & Credit */}
          <View className="flex-row">
            <View className="flex-1 px-4 py-3 border-r border-gray-100">
              <Text className="text-xs text-gray-500 mb-1">Total Debit</Text>
              <Text className="text-lg font-bold text-green-600">
                {data?.summary?.total_debit
                  ? formatAmount(data.summary.total_debit)
                  : "0.00"}
              </Text>
            </View>
            <View className="flex-1 px-4 py-3">
              <Text className="text-xs text-gray-500 mb-1">Total Credit</Text>
              <Text className="text-lg font-bold text-red-600">
                {data?.summary?.total_credit
                  ? formatAmount(data.summary.total_credit)
                  : "0.00"}
              </Text>
            </View>
          </View>

          {/* Closing Balance */}
          <View className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-gray-100">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-gray-700">
                Closing Balance
              </Text>
              <Text
                className={`text-xl font-bold ${
                  (data?.summary?.closing_balance || 0) > 0
                    ? "text-green-600"
                    : (data?.summary?.closing_balance || 0) < 0
                    ? "text-red-600"
                    : "text-gray-900"
                }`}
              >
                {data?.summary?.closing_balance
                  ? formatBalance(data.summary.closing_balance)
                  : "0.00"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Ledger Entries */}
      <ScrollView
        className="flex-1 px-4 mt-4"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {ledgerEntries.length === 0 ? (
          <View className="bg-white rounded-2xl p-12 items-center border border-gray-100">
            <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
              <Ionicons
                name="document-text-outline"
                size={40}
                color="#9CA3AF"
              />
            </View>
            <Text className="text-base font-medium text-gray-900 mb-1">
              No Ledger Entries
            </Text>
            <Text className="text-sm text-gray-500 text-center">
              No transactions found for this party
            </Text>
          </View>
        ) : (
          <View className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
            {/* Table Header */}
            <View className="flex-row bg-gradient-to-r from-gray-50 to-gray-100 px-3 py-3 border-b border-gray-200">
              <Text className="w-20 text-xs font-bold text-gray-700">Date</Text>
              <Text className="flex-1 text-xs font-bold text-gray-700 px-2">
                Particulars
              </Text>
              <Text className="w-20 text-xs font-bold text-gray-700 text-right">
                Debit
              </Text>
              <Text className="w-20 text-xs font-bold text-gray-700 text-right px-2">
                Credit
              </Text>
              <Text className="w-24 text-xs font-bold text-gray-700 text-right">
                Balance
              </Text>
            </View>

            {/* Opening Balance Row */}
            {data?.summary?.opening_balance !== 0 && (
              <View className="flex-row px-3 py-3 border-b border-gray-100 bg-blue-50">
                <Text className="w-20 text-xs text-gray-500">—</Text>
                <Text className="flex-1 text-xs font-medium text-gray-700 italic px-2">
                  Opening Balance
                </Text>
                <Text className="w-20 text-xs text-gray-500 text-right">—</Text>
                <Text className="w-20 text-xs text-gray-500 text-right px-2">
                  —
                </Text>
                <Text
                  className={`w-24 text-xs font-bold text-right ${
                    (data?.summary?.opening_balance || 0) > 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatBalance(data?.summary?.opening_balance || 0)}
                </Text>
              </View>
            )}

            {/* Ledger Entries */}
            {ledgerEntries.map((entry, index) => (
              <TouchableOpacity
                key={entry._id || index}
                className={`flex-row px-3 py-3 border-b border-gray-100 ${
                  index % 2 === 0 ? "bg-white" : "bg-gray-50"
                } active:bg-blue-50`}
                onPress={() => {
                  if (entry.invoice_id) {
                    router.push(`/invoices/${entry.invoice_id}` as any);
                  }
                }}
              >
                <Text className="w-20 text-xs text-gray-600">
                  {formatDate(entry.date)}
                </Text>
                <View className="flex-1 px-2">
                  <Text
                    className="text-xs font-medium text-gray-900"
                    numberOfLines={2}
                  >
                    {entry.description || entry.type}
                  </Text>
                  {entry.reference && (
                    <Text className="text-xs text-gray-400 mt-0.5">
                      {entry.reference}
                    </Text>
                  )}
                </View>
                <Text className="w-20 text-xs font-semibold text-green-600 text-right">
                  {entry.debit > 0 ? formatAmount(entry.debit) : "—"}
                </Text>
                <Text className="w-20 text-xs font-semibold text-red-600 text-right px-2">
                  {entry.credit > 0 ? formatAmount(entry.credit) : "—"}
                </Text>
                <Text
                  className={`w-24 text-xs font-bold text-right ${
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
          <View className="flex-row items-center justify-center py-4 gap-3 mb-4">
            <TouchableOpacity
              className={`px-5 py-2.5 rounded-xl ${
                page <= 1
                  ? "bg-gray-100 border border-gray-200"
                  : "bg-blue-500 shadow-sm"
              }`}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <Text
                className={`text-sm font-semibold ${
                  page <= 1 ? "text-gray-400" : "text-white"
                }`}
              >
                Previous
              </Text>
            </TouchableOpacity>
            <View className="px-4 py-2 bg-white rounded-xl border border-gray-200">
              <Text className="text-sm font-medium text-gray-700">
                {page} / {data.pagination.pages}
              </Text>
            </View>
            <TouchableOpacity
              className={`px-5 py-2.5 rounded-xl ${
                page >= data.pagination.pages
                  ? "bg-gray-100 border border-gray-200"
                  : "bg-blue-500 shadow-sm"
              }`}
              onPress={() =>
                setPage((p) => Math.min(data.pagination.pages, p + 1))
              }
              disabled={page >= data.pagination.pages}
            >
              <Text
                className={`text-sm font-semibold ${
                  page >= data.pagination.pages ? "text-gray-400" : "text-white"
                }`}
              >
                Next
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
