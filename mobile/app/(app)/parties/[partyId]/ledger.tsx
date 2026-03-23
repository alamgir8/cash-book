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
import { Ionicons } from "@expo/vector-icons";
import { toast } from "@/lib/toast";
import { ScreenHeader } from "@/components/screen-header";
import { PartyLedgerTable } from "@/components/parties";
import { useParty, usePartyLedger } from "@/hooks/use-parties";
import {
  formatLedgerDate,
  formatLedgerAmount,
  formatLedgerBalance,
} from "@/lib/party-utils";
import { exportPartyLedgerPdf } from "@/services/reports";
import { useTheme } from "@/hooks/useTheme";

export default function PartyLedgerScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [page, setPage] = useState(1);
  const [exportingPdf, setExportingPdf] = useState(false);
  const limit = 50;

  const { data: party } = useParty(partyId!);
  const { data, isLoading, refetch, isRefetching } = usePartyLedger(partyId!, {
    page,
    limit,
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

  if (isLoading) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg.secondary }}>
        <ScreenHeader title="Party Ledger" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.secondary }}>
      <ScreenHeader
        title={party?.name || "Party Ledger"}
        showBack
        rightAction={
          <TouchableOpacity
            className="flex-row items-center px-3 py-1.5 rounded-lg"
            style={{
              backgroundColor:
                ledgerEntries.length === 0 ? colors.bg.tertiary : colors.primary,
            }}
            onPress={handleExportPdf}
            disabled={exportingPdf || ledgerEntries.length === 0}
          >
            {exportingPdf ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons
                  name="download-outline"
                  size={18}
                  color={ledgerEntries.length === 0 ? colors.text.tertiary : "#ffffff"}
                />
                <Text
                  className="ml-1.5 text-sm font-semibold"
                  style={{
                    color:
                      ledgerEntries.length === 0 ? colors.text.tertiary : "#ffffff",
                  }}
                >
                  Export
                </Text>
              </>
            )}
          </TouchableOpacity>
        }
      />

      {/* Summary Cards */}
      <View className="px-4 pt-4">
        <View
          className="rounded-2xl shadow-sm border overflow-hidden"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          {/* Opening Balance */}
          <View
            className="px-4 py-3 border-b"
            style={{ borderColor: colors.border }}
          >
            <View className="flex-row items-center justify-between">
              <Text
                className="text-sm font-medium"
                style={{ color: colors.text.secondary }}
              >
                Opening Balance
              </Text>
              <Text
                className="text-base font-bold"
                style={{
                  color:
                    (data?.summary?.opening_balance || 0) > 0
                      ? colors.success
                      : (data?.summary?.opening_balance || 0) < 0
                      ? colors.error
                      : colors.text.primary,
                }}
              >
                {data?.summary?.opening_balance
                  ? formatLedgerBalance(data.summary.opening_balance)
                  : "0.00"}
              </Text>
            </View>
          </View>

          {/* Debit & Credit */}
          <View className="flex-row">
            <View
              className="flex-1 px-4 py-3 border-r"
              style={{ borderColor: colors.border }}
            >
              <Text
                className="text-xs mb-1"
                style={{ color: colors.text.tertiary }}
              >
                Total Debit
              </Text>
              <Text
                className="text-lg font-bold"
                style={{ color: colors.success }}
              >
                {data?.summary?.total_debit
                  ? formatLedgerAmount(data.summary.total_debit)
                  : "0.00"}
              </Text>
            </View>
            <View className="flex-1 px-4 py-3">
              <Text
                className="text-xs mb-1"
                style={{ color: colors.text.tertiary }}
              >
                Total Credit
              </Text>
              <Text
                className="text-lg font-bold"
                style={{ color: colors.error }}
              >
                {data?.summary?.total_credit
                  ? formatLedgerAmount(data.summary.total_credit)
                  : "0.00"}
              </Text>
            </View>
          </View>

          {/* Closing Balance */}
          <View
            className="px-4 py-3 border-t"
            style={{
              backgroundColor: colors.bg.tertiary,
              borderColor: colors.border,
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text
                className="text-sm font-semibold"
                style={{ color: colors.text.secondary }}
              >
                Closing Balance
              </Text>
              <Text
                className="text-xl font-bold"
                style={{
                  color:
                    (data?.summary?.closing_balance || 0) > 0
                      ? colors.success
                      : (data?.summary?.closing_balance || 0) < 0
                      ? colors.error
                      : colors.text.primary,
                }}
              >
                {data?.summary?.closing_balance
                  ? formatLedgerBalance(data.summary.closing_balance)
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
        <View className="pb-24">
          {ledgerEntries.length === 0 ? (
            <View
              className="rounded-2xl p-12 items-center border"
              style={{ backgroundColor: colors.card, borderColor: colors.border }}
            >
              <View
                className="w-20 h-20 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: colors.bg.tertiary }}
              >
                <Ionicons
                  name="document-text-outline"
                  size={40}
                  color={colors.text.tertiary}
                />
              </View>
              <Text
                className="text-base font-medium mb-1"
                style={{ color: colors.text.primary }}
              >
                No Ledger Entries
              </Text>
              <Text
                className="text-sm text-center"
                style={{ color: colors.text.tertiary }}
              >
                No transactions found for this party
              </Text>
            </View>
          ) : (
            <View
              className="rounded-2xl shadow-sm border overflow-hidden mb-4"
              style={{ backgroundColor: colors.card, borderColor: colors.border }}
            >
              {/* Opening Balance Row */}
              {data?.summary?.opening_balance !== 0 && (
                <View
                  className="flex-row px-3 py-3 border-b"
                  style={{
                    backgroundColor: colors.bg.tertiary,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    className="w-20 text-xs"
                    style={{ color: colors.text.tertiary }}
                  >
                    —
                  </Text>
                  <Text
                    className="flex-1 text-xs font-medium italic px-2"
                    style={{ color: colors.text.secondary }}
                  >
                    Opening Balance
                  </Text>
                  <Text
                    className="w-20 text-xs text-right"
                    style={{ color: colors.text.tertiary }}
                  >
                    —
                  </Text>
                  <Text
                    className="w-20 text-xs text-right px-2"
                    style={{ color: colors.text.tertiary }}
                  >
                    —
                  </Text>
                  <Text
                    className="w-24 text-xs font-bold text-right"
                    style={{
                      color:
                        (data?.summary?.opening_balance || 0) > 0
                          ? colors.success
                          : colors.error,
                    }}
                  >
                    {formatLedgerBalance(data?.summary?.opening_balance || 0)}
                  </Text>
                </View>
              )}

              {/* Ledger Entries */}
              {ledgerEntries.map((entry, index) => (
                <TouchableOpacity
                  key={entry._id || index}
                  className="flex-row px-3 py-3 border-b active:opacity-70"
                  style={{
                    borderColor: colors.border,
                    backgroundColor:
                      index % 2 === 0 ? colors.card : colors.bg.secondary,
                  }}
                  onPress={() => {
                    if (entry.invoice_id) {
                      router.push(`/invoices/${entry.invoice_id}` as any);
                    }
                  }}
                >
                  <Text
                    className="w-20 text-xs"
                    style={{ color: colors.text.secondary }}
                  >
                    {formatLedgerDate(entry.date)}
                  </Text>
                  <View className="flex-1 px-2">
                    <Text
                      className="text-xs font-medium"
                      numberOfLines={2}
                      style={{ color: colors.text.primary }}
                    >
                      {entry.description || entry.type}
                    </Text>
                    {entry.reference && (
                      <Text
                        className="text-xs mt-0.5"
                        style={{ color: colors.text.tertiary }}
                      >
                        {entry.reference}
                      </Text>
                    )}
                  </View>
                  <Text
                    className="w-20 text-xs font-semibold text-right"
                    style={{ color: colors.success }}
                  >
                    {entry.debit > 0 ? formatLedgerAmount(entry.debit) : "—"}
                  </Text>
                  <Text
                    className="w-20 text-xs font-semibold text-right px-2"
                    style={{ color: colors.error }}
                  >
                    {entry.credit > 0 ? formatLedgerAmount(entry.credit) : "—"}
                  </Text>
                  <Text
                    className="w-24 text-xs font-bold text-right"
                    style={{
                      color:
                        entry.running_balance > 0
                          ? colors.success
                          : entry.running_balance < 0
                          ? colors.error
                          : colors.text.secondary,
                    }}
                  >
                    {formatLedgerBalance(entry.running_balance)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Pagination */}
          {data?.pagination && data.pagination.pages > 1 && (
            <View className="flex-row items-center justify-center py-4 gap-3 mb-4">
              <TouchableOpacity
                className="px-5 py-2.5 rounded-xl"
                style={{
                  backgroundColor: page <= 1 ? colors.bg.tertiary : colors.primary,
                  borderWidth: page <= 1 ? 1 : 0,
                  borderColor: colors.border,
                }}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{
                    color: page <= 1 ? colors.text.tertiary : "#ffffff",
                  }}
                >
                  Previous
                </Text>
              </TouchableOpacity>
              <View
                className="px-4 py-2 rounded-xl border"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: colors.text.secondary }}
                >
                  {page} / {data.pagination.pages}
                </Text>
              </View>
              <TouchableOpacity
                className="px-5 py-2.5 rounded-xl"
                style={{
                  backgroundColor:
                    page >= data.pagination.pages
                      ? colors.bg.tertiary
                      : colors.primary,
                  borderWidth: page >= data.pagination.pages ? 1 : 0,
                  borderColor: colors.border,
                }}
                onPress={() =>
                  setPage((p) => Math.min(data.pagination.pages, p + 1))
                }
                disabled={page >= data.pagination.pages}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{
                    color:
                      page >= data.pagination.pages
                        ? colors.text.tertiary
                        : "#ffffff",
                  }}
                >
                  Next
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
