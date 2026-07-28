import React, { useState, useMemo, useEffect, useCallback } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { toast } from "@/lib/toast";
import { ScreenHeader } from "@/components/screen-header";
import { LedgerEntryCard } from "@/components/parties/ledger-entry-card";
import { useParty, usePartyLedger } from "@/hooks/use-parties";
import {
  formatLedgerAmount,
  formatLedgerBalance,
} from "@/lib/party-utils";
import { exportPartyLedgerPdf } from "@/services/reports";
import { useTheme } from "@/hooks/use-theme";
import { safeGoBack } from "@/lib/navigation";
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
  const { colors } = useTheme();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "debit" | "credit">(
    "all",
  );
  const [sort, setSort] = useState("-date");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: party } = useParty(partyId!);
  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = usePartyLedger(partyId!, {
    limit: PAGE_SIZE,
    search: search || undefined,
    type: typeFilter,
    sort,
  });

  const entries = useMemo(
    () => data?.pages.flatMap((p) => p.entries || []) ?? [],
    [data],
  );

  const summary = data?.pages[0]?.summary;
  const totalCount = data?.pages[0]?.pagination?.total ?? 0;

  const goBack = useCallback(() => {
    safeGoBack(`/(app)/parties/${partyId}`, router);
  }, [partyId, router]);

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

  const renderEntry = useCallback(
    ({ item }: { item: LedgerEntry }) => (
      <LedgerEntryCard
        entry={item}
        onPress={
          item.invoice_id
            ? () => router.push(`/invoices/${item.invoice_id}` as any)
            : undefined
        }
      />
    ),
    [router],
  );

  const keyExtractor = useCallback(
    (item: LedgerEntry, i: number) => item._id || `row-${i}`,
    [],
  );

  const showInitialLoader = isLoading && !data;
  const closing = summary?.closing_balance || 0;

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.secondary }}>
      <ScreenHeader
        title={party?.name || "Party Ledger"}
        showBack
        onBack={goBack}
        backFallback={`/(app)/parties/${partyId}`}
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
              <Text
                className="text-xs uppercase font-semibold"
                style={{ color: colors.text.tertiary }}
              >
                Opening
              </Text>
              <Text
                className="text-base font-bold mt-1"
                style={{ color: colors.text.primary }}
              >
                {formatLedgerBalance(summary?.opening_balance || 0)}
              </Text>
            </View>
            <View
              className="flex-1 px-3 py-2.5 border-r"
              style={{ borderColor: colors.border }}
            >
              <Text
                className="text-xs uppercase font-semibold"
                style={{ color: colors.text.tertiary }}
              >
                Debit
              </Text>
              <Text
                className="text-base font-bold mt-1"
                style={{ color: colors.success }}
              >
                {formatLedgerAmount(summary?.total_debit || 0)}
              </Text>
            </View>
            <View className="flex-1 px-3 py-2.5">
              <Text
                className="text-xs uppercase font-semibold"
                style={{ color: colors.text.tertiary }}
              >
                Credit
              </Text>
              <Text
                className="text-base font-bold mt-1"
                style={{ color: colors.error }}
              >
                {formatLedgerAmount(summary?.total_credit || 0)}
              </Text>
            </View>
          </View>
          <View
            className="px-3 py-2.5 border-t flex-row justify-between items-center"
            style={{
              backgroundColor:
                closing > 0
                  ? colors.success + "12"
                  : closing < 0
                    ? colors.error + "12"
                    : colors.bg.tertiary,
              borderColor: colors.border,
            }}
          >
            <View>
              <Text
                className="text-xs font-semibold"
                style={{ color: colors.text.secondary }}
              >
                Closing Balance
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: colors.text.tertiary }}
              >
                After all ledger entries
              </Text>
            </View>
            <Text
              className="text-xl font-bold"
              style={{
                color:
                  closing > 0
                    ? colors.success
                    : closing < 0
                      ? colors.error
                      : colors.text.primary,
              }}
            >
              {formatLedgerBalance(closing)}
            </Text>
          </View>
        </View>
      </View>

      <View className="px-4 pt-3 pb-2 gap-2">
        <View
          className="flex-row items-center rounded-xl px-3"
          style={{ backgroundColor: colors.bg.tertiary, minHeight: 42 }}
        >
          <Ionicons name="search" size={16} color={colors.text.tertiary} />
          <TextInput
            className="flex-1 ml-2 text-sm"
            style={{ color: colors.text.primary, paddingVertical: 8 }}
            placeholder="Search description, notes, category..."
            placeholderTextColor={colors.text.tertiary}
            value={searchInput}
            onChangeText={setSearchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchInput.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchInput("");
                setSearch("");
              }}
            >
              <Ionicons
                name="close-circle"
                size={16}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
          {isFetching && !isFetchingNextPage ? (
            <ActivityIndicator
              size="small"
              color={colors.info}
              style={{ marginLeft: 6 }}
            />
          ) : null}
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
        <Text className="text-sm" style={{ color: colors.text.tertiary }}>
          Showing {entries.length}
          {totalCount ? ` of ${totalCount}` : ""}
        </Text>
      </View>

      {showInitialLoader ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.info} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={keyExtractor}
          renderItem={renderEntry}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={() => void refetch()}
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
            hasNextPage ? (
              <TouchableOpacity
                className="mt-1 mb-2 py-3 rounded-xl items-center"
                style={{ backgroundColor: colors.info }}
                disabled={isFetchingNextPage}
                onPress={() => void fetchNextPage()}
              >
                {isFetchingNextPage ? (
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
                End of ledger · Closing {formatLedgerBalance(closing)}
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
