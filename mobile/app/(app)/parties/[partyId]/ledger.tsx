import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "@/lib/toast";
import { ScreenHeader } from "@/components/screen-header";
import { useParty, usePartyLedger } from "@/hooks/use-parties";
import {
  formatLedgerDate,
  formatLedgerAmount,
  formatLedgerBalance,
} from "@/lib/party-utils";
import { exportPartyLedgerPdf } from "@/services/reports";
import { useTheme } from "@/hooks/use-theme";
import type { LedgerEntry } from "@/services/parties";

const PAGE_SIZE = 50;

const TYPE_FILTERS: { value: "all" | "debit" | "credit"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "debit", label: "Debit" },
  { value: "credit", label: "Credit" },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "-date", label: "Newest first" },
  { value: "date", label: "Oldest first" },
  { value: "-amount", label: "Amount high → low" },
  { value: "amount", label: "Amount low → high" },
];

export default function PartyLedgerScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "debit" | "credit">(
    "all",
  );
  const [sort, setSort] = useState("-date");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
    setEntries([]);
  }, [typeFilter, sort, partyId]);

  const { data: party } = useParty(partyId!);
  const { data, isLoading, isFetching, refetch, isRefetching } = usePartyLedger(
    partyId!,
    {
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      type: typeFilter,
      sort,
    },
  );

  useEffect(() => {
    if (!data?.entries) return;
    setEntries((prev) =>
      page === 1 ? data.entries : [...prev, ...data.entries],
    );
  }, [data, page]);

  const pagination = data?.pagination;
  const hasMore = Boolean(pagination && pagination.page < pagination.pages);

  const handleExportPdf = async () => {
    if (!party) {
      toast.error("Party information not loaded");
      return;
    }
    setExportingPdf(true);
    try {
      await exportPartyLedgerPdf(partyId!, party.name);
      toast.success("PDF exported successfully");
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const summary = data?.summary;

  const renderEntry = ({
    item,
    index,
  }: {
    item: LedgerEntry;
    index: number;
  }) => (
    <TouchableOpacity
      activeOpacity={item.invoice_id ? 0.7 : 1}
      onPress={() => {
        if (item.invoice_id) {
          router.push(`/invoices/${item.invoice_id}` as any);
        }
      }}
      style={{
        backgroundColor: index % 2 === 0 ? colors.bg.secondary : colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <View className="flex-row items-start justify-between mb-1">
        <Text
          className="text-xs font-medium"
          style={{ color: colors.text.tertiary }}
        >
          {formatLedgerDate(item.date)}
        </Text>
        <View
          className="px-2 py-0.5 rounded-full"
          style={{
            backgroundColor:
              item.type === "debit"
                ? colors.success + "18"
                : colors.error + "18",
          }}
        >
          <Text
            className="text-[10px] font-bold uppercase"
            style={{
              color: item.type === "debit" ? colors.success : colors.error,
            }}
          >
            {item.type}
            {item.payment_status === "due" ? " · due" : ""}
          </Text>
        </View>
      </View>

      <Text
        className="text-sm font-semibold mb-1"
        style={{ color: colors.text.primary }}
        numberOfLines={2}
      >
        {item.description || "Transaction"}
      </Text>

      {(item.category_name || item.account_name || item.reference) && (
        <View className="flex-row flex-wrap gap-x-3 gap-y-1 mb-1">
          {item.category_name ? (
            <Text className="text-xs" style={{ color: colors.text.secondary }}>
              <Ionicons name="pricetag-outline" size={11} /> {item.category_name}
            </Text>
          ) : null}
          {item.account_name ? (
            <Text className="text-xs" style={{ color: colors.text.secondary }}>
              <Ionicons name="wallet-outline" size={11} /> {item.account_name}
            </Text>
          ) : null}
          {item.reference ? (
            <Text className="text-xs" style={{ color: colors.text.secondary }}>
              Ref: {item.reference}
            </Text>
          ) : null}
        </View>
      )}

      {item.comment ? (
        <Text
          className="text-xs mb-2 italic"
          style={{ color: colors.text.tertiary }}
          numberOfLines={2}
        >
          {item.comment}
        </Text>
      ) : null}

      <View className="flex-row items-center justify-between mt-1">
        <View className="flex-row gap-4">
          <View>
            <Text
              className="text-[10px] uppercase"
              style={{ color: colors.text.tertiary }}
            >
              Debit
            </Text>
            <Text
              className="text-sm font-bold"
              style={{ color: colors.success }}
            >
              {item.debit > 0 ? formatLedgerAmount(item.debit) : "—"}
            </Text>
          </View>
          <View>
            <Text
              className="text-[10px] uppercase"
              style={{ color: colors.text.tertiary }}
            >
              Credit
            </Text>
            <Text className="text-sm font-bold" style={{ color: colors.error }}>
              {item.credit > 0 ? formatLedgerAmount(item.credit) : "—"}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text
            className="text-[10px] uppercase"
            style={{ color: colors.text.tertiary }}
          >
            Balance
          </Text>
          <Text
            className="text-sm font-bold"
            style={{
              color:
                item.running_balance > 0
                  ? colors.success
                  : item.running_balance < 0
                    ? colors.error
                    : colors.text.secondary,
            }}
          >
            {formatLedgerBalance(item.running_balance)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.secondary }}>
      <ScreenHeader
        title={party?.name || "Party Ledger"}
        showBack
        onBack={() => router.back()}
        rightAction={
          <TouchableOpacity
            className="flex-row items-center px-3 py-1.5 rounded-lg"
            style={{
              backgroundColor:
                entries.length === 0 ? colors.bg.tertiary : colors.info,
            }}
            onPress={handleExportPdf}
            disabled={exportingPdf || entries.length === 0}
          >
            {exportingPdf ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name="download-outline"
                  size={18}
                  color={entries.length === 0 ? colors.text.tertiary : "#fff"}
                />
                <Text
                  className="ml-1.5 text-sm font-semibold"
                  style={{
                    color:
                      entries.length === 0 ? colors.text.tertiary : "#fff",
                  }}
                >
                  Export
                </Text>
              </>
            )}
          </TouchableOpacity>
        }
      />

      {/* Summary */}
      <View className="px-4 pt-3">
        <View
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          <View className="flex-row">
            <View
              className="flex-1 px-3 py-2.5 border-r"
              style={{ borderColor: colors.border }}
            >
              <Text className="text-[10px]" style={{ color: colors.text.tertiary }}>
                Opening
              </Text>
              <Text
                className="text-sm font-bold"
                style={{ color: colors.text.primary }}
              >
                {formatLedgerBalance(summary?.opening_balance || 0)}
              </Text>
            </View>
            <View
              className="flex-1 px-3 py-2.5 border-r"
              style={{ borderColor: colors.border }}
            >
              <Text className="text-[10px]" style={{ color: colors.text.tertiary }}>
                Debit
              </Text>
              <Text
                className="text-sm font-bold"
                style={{ color: colors.success }}
              >
                {formatLedgerAmount(summary?.total_debit || 0)}
              </Text>
            </View>
            <View className="flex-1 px-3 py-2.5">
              <Text className="text-[10px]" style={{ color: colors.text.tertiary }}>
                Credit
              </Text>
              <Text className="text-sm font-bold" style={{ color: colors.error }}>
                {formatLedgerAmount(summary?.total_credit || 0)}
              </Text>
            </View>
          </View>
          <View
            className="px-3 py-2.5 border-t flex-row justify-between"
            style={{
              backgroundColor: colors.bg.tertiary,
              borderColor: colors.border,
            }}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.text.secondary }}
            >
              Closing Balance
            </Text>
            <Text
              className="text-base font-bold"
              style={{
                color:
                  (summary?.closing_balance || 0) > 0
                    ? colors.success
                    : (summary?.closing_balance || 0) < 0
                      ? colors.error
                      : colors.text.primary,
              }}
            >
              {formatLedgerBalance(summary?.closing_balance || 0)}
            </Text>
          </View>
        </View>
      </View>

      {/* Search / filter / sort */}
      <View className="px-4 pt-3 pb-2 gap-2">
        <View
          className="flex-row items-center rounded-xl px-3"
          style={{ backgroundColor: colors.bg.tertiary, minHeight: 42 }}
        >
          <Ionicons name="search" size={16} color={colors.text.tertiary} />
          <TextInput
            className="flex-1 ml-2 text-sm"
            style={{ color: colors.text.primary, paddingVertical: 8 }}
            placeholder="Search description, notes, ref..."
            placeholderTextColor={colors.text.tertiary}
            value={searchInput}
            onChangeText={setSearchInput}
            autoCorrect={false}
          />
          {searchInput.length > 0 && (
            <TouchableOpacity onPress={() => setSearchInput("")}>
              <Ionicons
                name="close-circle"
                size={16}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row">
            {TYPE_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.value}
                className="mr-2 px-3 py-1.5 rounded-full"
                style={{
                  backgroundColor:
                    typeFilter === f.value ? colors.info : colors.bg.tertiary,
                }}
                onPress={() => setTypeFilter(f.value)}
              >
                <Text
                  className="text-xs font-medium"
                  style={{
                    color:
                      typeFilter === f.value ? "#fff" : colors.text.secondary,
                  }}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            className="flex-row items-center px-3 py-1.5 rounded-full gap-1"
            style={{ backgroundColor: colors.bg.tertiary }}
            onPress={() => setSortMenuOpen(true)}
          >
            <Ionicons
              name="swap-vertical"
              size={14}
              color={colors.text.secondary}
            />
            <Text
              className="text-xs font-medium"
              style={{ color: colors.text.secondary }}
            >
              Sort
            </Text>
          </TouchableOpacity>
        </View>
        {pagination?.total != null ? (
          <Text className="text-xs" style={{ color: colors.text.tertiary }}>
            Showing {entries.length} of {pagination.total}
          </Text>
        ) : null}
      </View>

      {isLoading && page === 1 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.info} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, i) => item._id || String(i)}
          renderItem={renderEntry}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 40,
          }}
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && page === 1}
              onRefresh={() => {
                setPage(1);
                void refetch();
                void queryClient.invalidateQueries({
                  queryKey: ["party", partyId],
                });
              }}
            />
          }
          ListEmptyComponent={
            <View
              className="rounded-2xl p-10 items-center border mt-2"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <Ionicons
                name="document-text-outline"
                size={40}
                color={colors.text.tertiary}
              />
              <Text
                className="text-base font-medium mt-3"
                style={{ color: colors.text.primary }}
              >
                No ledger entries
              </Text>
              <Text
                className="text-sm text-center mt-1"
                style={{ color: colors.text.tertiary }}
              >
                {search || typeFilter !== "all"
                  ? "Try a different search or filter"
                  : "No transactions found for this party"}
              </Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                className="mt-3 mb-2 py-3 rounded-xl items-center"
                style={{ backgroundColor: colors.info }}
                disabled={isFetching}
                onPress={() => setPage((p) => p + 1)}
              >
                {isFetching && page > 1 ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">
                    Load more (+{PAGE_SIZE})
                  </Text>
                )}
              </TouchableOpacity>
            ) : entries.length > 0 ? (
              <Text
                className="text-center text-xs py-3"
                style={{ color: colors.text.tertiary }}
              >
                End of ledger
              </Text>
            ) : null
          }
        />
      )}

      <Modal
        visible={sortMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortMenuOpen(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
          activeOpacity={1}
          onPress={() => setSortMenuOpen(false)}
        >
          <View
            style={{
              marginTop: "auto",
              backgroundColor: colors.bg.primary,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 16,
            }}
          >
            <Text
              className="text-lg font-bold mb-3"
              style={{ color: colors.text.primary }}
            >
              Sort ledger
            </Text>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                className="py-3 border-b flex-row justify-between"
                style={{ borderColor: colors.border }}
                onPress={() => {
                  setSort(opt.value);
                  setSortMenuOpen(false);
                }}
              >
                <Text style={{ color: colors.text.primary }}>{opt.label}</Text>
                {sort === opt.value ? (
                  <Ionicons name="checkmark" size={18} color={colors.info} />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
