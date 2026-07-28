import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { toast } from "@/lib/toast";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { useOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import {
  partiesApi,
  type ListPartiesParams,
  type Party,
  type PartyType,
} from "@/services/parties";
import { getApiErrorMessage } from "@/lib/api";
import { useDeleteMode } from "@/hooks/use-delete-mode";
import { PartyListCard } from "@/components/parties/party-list-card";
import { MergeTargetRow } from "@/components/parties/merge-target-row";

const PAGE_SIZE = 30;
const MERGE_PAGE_SIZE = 30;

/** all = every org + personal; personal = no org; else org id */
type OrgFilter = "all" | "personal" | string;

function orgFilterParams(orgFilter: OrgFilter): Pick<
  ListPartiesParams,
  "organization" | "scope"
> {
  if (orgFilter === "all") return { scope: "all" };
  if (orgFilter === "personal") return { scope: "personal" };
  return { organization: orgFilter };
}

const TAB_OPTIONS: { value: PartyType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "customer", label: "Customers" },
  { value: "supplier", label: "Suppliers" },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "name", label: "Name A–Z" },
  { value: "-name", label: "Name Z–A" },
  { value: "-updatedAt", label: "Recently updated" },
  { value: "-createdAt", label: "Newest" },
  { value: "createdAt", label: "Oldest" },
  { value: "-current_balance", label: "Balance high" },
  { value: "current_balance", label: "Balance low" },
];

export default function PartiesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { canManageParties, organizations } = useOrganization();
  const { isDeleteModeActive } = useDeleteMode();

  const [orgFilter, setOrgFilter] = useState<OrgFilter>("all");
  const [activeTab, setActiveTab] = useState<PartyType | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("-updatedAt");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [mergeSource, setMergeSource] = useState<Party | null>(null);
  const [mergePickerVisible, setMergePickerVisible] = useState(false);
  const [mergeSearchInput, setMergeSearchInput] = useState("");
  const [mergeSearch, setMergeSearch] = useState("");

  const orgScopeParams = useMemo(
    () => orgFilterParams(orgFilter),
    [orgFilter],
  );

  const orgFilterChips = useMemo(
    () => [
      { value: "all" as const, label: "All" },
      { value: "personal" as const, label: "Personal" },
      ...organizations.map((org) => ({
        value: org.id,
        label: org.name,
      })),
    ],
    [organizations],
  );

  // Debounce search → server query (avoids request storms)
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Debounce merge-target search
  useEffect(() => {
    const t = setTimeout(() => setMergeSearch(mergeSearchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [mergeSearchInput]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["parties", orgFilter, activeTab, search, sort, PAGE_SIZE],
    queryFn: ({ pageParam, signal }) =>
      partiesApi.list(
        {
          ...orgScopeParams,
          type: activeTab === "all" ? undefined : activeTab,
          search: search || undefined,
          sort,
          page: pageParam,
          limit: PAGE_SIZE,
        },
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const p = last?.pagination;
      if (!p) return undefined;
      return p.page < p.pages ? p.page + 1 : undefined;
    },
    retry: 1,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const parties = useMemo(
    () => data?.pages.flatMap((p) => p.parties || []) ?? [],
    [data],
  );
  const totalCount = data?.pages[0]?.pagination?.total;

  const mergeMutation = useMutation({
    mutationFn: ({
      sourceId,
      targetId,
    }: {
      sourceId: string;
      targetId: string;
    }) => partiesApi.merge(sourceId, targetId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      queryClient.invalidateQueries({ queryKey: ["parties-merge-targets"] });
      setMergeSource(null);
      setMergePickerVisible(false);
      setMergeSearchInput("");
      setMergeSearch("");
      toast.success(
        "Merge complete",
        result.message ||
          "Links moved. Source party was kept — delete it if you no longer need it.",
      );
    },
    onError: (error) => {
      Alert.alert("Merge failed", getApiErrorMessage(error));
    },
  });
  const mergePending = mergeMutation.isPending;
  const mergeMutate = mergeMutation.mutate;

  const {
    data: mergeTargetsData,
    isLoading: mergeTargetsLoading,
    isFetchingNextPage: mergeLoadingMore,
    isFetching: mergeTargetsFetching,
    hasNextPage: mergeHasMore,
    fetchNextPage: fetchMoreMergeTargets,
  } = useInfiniteQuery({
    queryKey: [
      "parties-merge-targets",
      orgFilter,
      mergeSource?._id,
      mergeSearch,
    ],
    queryFn: ({ pageParam, signal }) =>
      partiesApi.list(
        {
          ...orgScopeParams,
          search: mergeSearch || undefined,
          sort: "name",
          page: pageParam,
          limit: MERGE_PAGE_SIZE,
        },
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const p = last?.pagination;
      if (!p) return undefined;
      return p.page < p.pages ? p.page + 1 : undefined;
    },
    enabled: mergePickerVisible && Boolean(mergeSource),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: 1,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const mergeTargetOptions = useMemo(
    () =>
      (mergeTargetsData?.pages.flatMap((p) => p.parties || []) || []).filter(
        (p) => p._id !== mergeSource?._id,
      ),
    [mergeTargetsData, mergeSource],
  );

  const closeMergePicker = useCallback(() => {
    setMergePickerVisible(false);
    setMergeSource(null);
    setMergeSearchInput("");
    setMergeSearch("");
  }, []);

  const startMergeFlow = useCallback((party: Party) => {
    // Open modal immediately for snappy press feedback; load query after paint
    setMergeSource(party);
    setMergeSearchInput("");
    setMergeSearch("");
    setMergePickerVisible(true);
  }, []);

  const confirmMergeInto = useCallback(
    (target: Party) => {
      if (!mergeSource) return;
      Alert.alert(
        "Confirm merge",
        `Move all transactions/invoices from "${mergeSource.name}" to "${target.name}"?\n\n"${mergeSource.name}" will NOT be deleted automatically.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Merge",
            onPress: () =>
              mergeMutate({
                sourceId: mergeSource._id,
                targetId: target._id,
              }),
          },
        ],
      );
    },
    [mergeSource, mergeMutate],
  );

  const handleDelete = useCallback(
    (party: Party) => {
      Alert.alert(
        "Delete party?",
        `Remove "${party.name}"?\n\nIf it has linked transactions, you'll be offered a merge option instead.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  await partiesApi.delete(party._id);
                  queryClient.invalidateQueries({ queryKey: ["parties"] });
                  toast.success("Party deleted", `"${party.name}" was removed`);
                } catch (error: any) {
                  const errData = error?.response?.data;
                  if (errData?.canMerge || errData?.transactionCount > 0) {
                    Alert.alert(
                      "Cannot delete",
                      errData?.message ||
                        `"${party.name}" has linked transactions. Merge into another party first.`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Merge into another…",
                          onPress: () => startMergeFlow(party),
                        },
                      ],
                    );
                  } else {
                    toast.error(getApiErrorMessage(error));
                  }
                }
              })();
            },
          },
        ],
      );
    },
    [queryClient, startMergeFlow],
  );

  const goBackToSettings = useCallback(
    () => router.replace("/(app)/settings" as any),
    [router],
  );

  const onOpenParty = useCallback(
    (party: Party) => {
      router.push(`/(app)/parties/${party._id}` as any);
    },
    [router],
  );
  const onLedgerParty = useCallback(
    (party: Party) => {
      router.push(`/(app)/parties/${party._id}/ledger` as any);
    },
    [router],
  );
  const onEditParty = useCallback(
    (party: Party) => {
      router.push(`/(app)/parties/${party._id}/edit` as any);
    },
    [router],
  );

  const handlePullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await refetch();
    } finally {
      setPullRefreshing(false);
    }
  }, [refetch]);

  const listFooter = useMemo(() => {
    if (hasNextPage) {
      return (
        <TouchableOpacity
          className="mt-2 mb-4 py-3 rounded-xl items-center"
          style={{ backgroundColor: colors.info }}
          disabled={isFetchingNextPage}
          onPress={() => {
            if (!isFetchingNextPage) void fetchNextPage();
          }}
        >
          {isFetchingNextPage ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold">
              Load more (+{PAGE_SIZE})
            </Text>
          )}
        </TouchableOpacity>
      );
    }
    if (parties.length > 0) {
      return (
        <Text
          className="text-center text-xs py-3"
          style={{ color: colors.text.tertiary }}
        >
          All parties loaded
        </Text>
      );
    }
    return null;
  }, [
    hasNextPage,
    isFetchingNextPage,
    parties.length,
    colors.info,
    colors.text.tertiary,
    fetchNextPage,
  ]);

  const renderParty = useCallback(
    ({ item }: { item: Party }) => (
      <PartyListCard
        party={item}
        canManage={!!canManageParties}
        showDeleteActions={isDeleteModeActive}
        onOpen={onOpenParty}
        onLedger={onLedgerParty}
        onEdit={onEditParty}
        onMerge={startMergeFlow}
        onDelete={handleDelete}
      />
    ),
    [
      canManageParties,
      isDeleteModeActive,
      onOpenParty,
      onLedgerParty,
      onEditParty,
      startMergeFlow,
      handleDelete,
    ],
  );

  const renderMergeTarget = useCallback(
    ({ item }: { item: Party }) => (
      <MergeTargetRow
        party={item}
        disabled={mergePending}
        onSelect={confirmMergeInto}
      />
    ),
    [mergePending, confirmMergeInto],
  );

  const mergeListFooter = useMemo(() => {
    if (mergeHasMore) {
      return (
        <TouchableOpacity
          className="mt-3 mb-2 py-3 rounded-xl items-center"
          style={{ backgroundColor: colors.info }}
          disabled={mergeLoadingMore}
          onPress={() => {
            if (!mergeLoadingMore) void fetchMoreMergeTargets();
          }}
        >
          {mergeLoadingMore ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold">Load more</Text>
          )}
        </TouchableOpacity>
      );
    }
    if (mergeTargetOptions.length > 0) {
      return (
        <Text
          className="text-center text-xs py-3"
          style={{ color: colors.text.tertiary }}
        >
          All parties loaded
        </Text>
      );
    }
    return null;
  }, [
    mergeHasMore,
    mergeLoadingMore,
    mergeTargetOptions.length,
    colors.info,
    colors.text.tertiary,
    fetchMoreMergeTargets,
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title="Customers & Suppliers"
        showBack
        onBack={goBackToSettings}
        rightAction={
          canManageParties ? (
            <TouchableOpacity
              className="p-2"
              onPress={() => router.push("/(app)/parties/new" as any)}
            >
              <Ionicons name="add-circle" size={28} color={colors.info} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {isDeleteModeActive ? (
        <View
          className="mx-4 mt-3 flex-row items-center gap-2 rounded-xl px-3 py-3 border"
          style={{
            backgroundColor: colors.error + "12",
            borderColor: colors.error + "40",
          }}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text
            className="flex-1 text-sm"
            style={{ color: colors.text.primary }}
          >
            Delete Mode on — Merge moves links to another party (keeps both). Delete unused parties separately.
          </Text>
        </View>
      ) : null}

      {/* Search + sort */}
      <View
        className="px-4 py-2 border-b gap-2"
        style={{
          backgroundColor: colors.bg.secondary,
          borderColor: colors.border,
        }}
      >
        <View
          className="flex-row items-center rounded-xl px-3"
          style={{
            backgroundColor: colors.bg.tertiary,
            minHeight: 44,
          }}
        >
          <Ionicons name="search" size={18} color={colors.text.tertiary} />
          <TextInput
            className="flex-1 ml-2 text-base"
            style={{ color: colors.text.primary, paddingVertical: 10 }}
            placeholder="Search by name, code, or phone..."
            value={searchInput}
            onChangeText={setSearchInput}
            placeholderTextColor={colors.text.tertiary}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchInput.length > 0 && (
            <TouchableOpacity onPress={() => setSearchInput("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 8 }}
        >
          {orgFilterChips.map((chip) => {
            const selected = orgFilter === chip.value;
            return (
              <TouchableOpacity
                key={chip.value}
                className="mr-2 px-3 py-1.5 rounded-full"
                style={{
                  backgroundColor: selected ? colors.info : colors.bg.tertiary,
                  maxWidth: 160,
                }}
                onPress={() => setOrgFilter(chip.value)}
              >
                <Text
                  className="text-sm font-medium"
                  numberOfLines={1}
                  style={{
                    color: selected ? "#fff" : colors.text.secondary,
                  }}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View className="flex-row items-center justify-between">
          <View className="flex-row flex-1">
            {TAB_OPTIONS.map((tab) => (
              <TouchableOpacity
                key={tab.value}
                className="mr-2 px-3 py-1.5 rounded-full"
                style={{
                  backgroundColor:
                    activeTab === tab.value ? colors.info : colors.bg.tertiary,
                }}
                onPress={() => setActiveTab(tab.value)}
              >
                <Text
                  className="text-sm font-medium"
                  style={{
                    color:
                      activeTab === tab.value
                        ? "#fff"
                        : colors.text.secondary,
                  }}
                >
                  {tab.label}
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
              size={16}
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
        {totalCount != null ? (
          <Text className="text-xs" style={{ color: colors.text.tertiary }}>
            Showing {parties.length} of {totalCount}
          </Text>
        ) : null}
      </View>

      {isLoading && !data ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.info} />
        </View>
      ) : (
        <FlatList
          data={parties}
          keyExtractor={(item) => item._id}
          renderItem={renderParty}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={7}
          updateCellsBatchingPeriod={80}
          removeClippedSubviews={false}
          maintainVisibleContentPosition={undefined}
          refreshControl={
            <RefreshControl
              refreshing={pullRefreshing}
              onRefresh={() => void handlePullRefresh()}
              tintColor={colors.info}
            />
          }
          ListEmptyComponent={
            <View className="py-16 items-center">
              <Ionicons
                name="people-outline"
                size={56}
                color={colors.text.tertiary}
              />
              <Text
                className="text-base font-medium mt-3"
                style={{ color: colors.text.secondary }}
              >
                {search ? "No matching parties" : "No parties found"}
              </Text>
            </View>
          }
          ListFooterComponent={listFooter}
        />
      )}

      {/* Sort sheet */}
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
              Sort by
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

      {/* Merge picker */}
      <Modal
        visible={mergePickerVisible}
        animationType="slide"
        transparent
        onRequestClose={closeMergePicker}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(17, 24, 39, 0.4)",
          }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={closeMergePicker}
          />
          <View
            style={{
              maxHeight: "75%",
              backgroundColor: colors.bg.primary,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 16,
            }}
          >
            <View className="flex-row items-start justify-between mb-1">
              <View className="flex-1 pr-3">
                <Text
                  className="text-lg font-bold"
                  style={{ color: colors.text.primary }}
                >
                  Merge "{mergeSource?.name}" into…
                </Text>
                <Text
                  className="text-xs mt-1"
                  style={{ color: colors.text.tertiary }}
                >
                  Moves linked transactions/invoices. "{mergeSource?.name}"{" "}
                  stays — delete it afterward if you want.
                </Text>
              </View>
              <TouchableOpacity
                onPress={closeMergePicker}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.bg.tertiary,
                }}
              >
                <Ionicons name="close" size={20} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View
              className="flex-row items-center rounded-xl px-3 mb-3 mt-3"
              style={{
                backgroundColor: colors.bg.tertiary,
                minHeight: 44,
              }}
            >
              <Ionicons name="search" size={18} color={colors.text.tertiary} />
              <TextInput
                className="flex-1 ml-2 text-base"
                style={{ color: colors.text.primary, paddingVertical: 10 }}
                placeholder="Search party to merge into…"
                placeholderTextColor={colors.text.tertiary}
                value={mergeSearchInput}
                onChangeText={setMergeSearchInput}
                autoCorrect={false}
                autoCapitalize="none"
                autoFocus
                returnKeyType="search"
              />
              {mergeSearchInput.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    setMergeSearchInput("");
                    setMergeSearch("");
                  }}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={colors.text.tertiary}
                  />
                </TouchableOpacity>
              ) : null}
              {mergeTargetsFetching && !mergeLoadingMore ? (
                <ActivityIndicator
                  size="small"
                  color={colors.info}
                  style={{ marginLeft: 6 }}
                />
              ) : null}
            </View>

            <FlatList
              data={mergeTargetOptions}
              keyExtractor={(item) => item._id}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={15}
              maxToRenderPerBatch={12}
              windowSize={6}
              updateCellsBatchingPeriod={40}
              removeClippedSubviews={false}
              ListEmptyComponent={
                <View className="py-10 items-center">
                  <Text style={{ color: colors.text.tertiary }}>
                    {mergeTargetsLoading
                      ? "Searching…"
                      : mergeSearch
                        ? "No matching parties"
                        : "No other parties found"}
                  </Text>
                </View>
              }
              renderItem={renderMergeTarget}
              ListFooterComponent={mergeListFooter}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
