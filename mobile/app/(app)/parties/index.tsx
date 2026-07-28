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
} from "react-native";
import { useRouter } from "expo-router";
import { toast } from "@/lib/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { useActiveOrgId, useOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { partiesApi, type Party, type PartyType } from "@/services/parties";
import { getApiErrorMessage } from "@/lib/api";
import { useDeleteMode } from "@/hooks/use-delete-mode";

const PAGE_SIZE = 50;

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
  const organizationId = useActiveOrgId();
  const { colors } = useTheme();
  const { canManageParties } = useOrganization();
  const { isDeleteModeActive } = useDeleteMode();

  const [activeTab, setActiveTab] = useState<PartyType | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("-updatedAt");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [parties, setParties] = useState<Party[]>([]);
  const [mergeSource, setMergeSource] = useState<Party | null>(null);
  const [mergePickerVisible, setMergePickerVisible] = useState(false);

  // Debounce search → server query
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
    setParties([]);
  }, [activeTab, sort, organizationId]);

  const { data, isLoading, isFetching, refetch, isRefetching } = useQuery({
    queryKey: ["parties", organizationId, activeTab, search, sort, page],
    queryFn: () =>
      partiesApi.list({
        organization: organizationId || undefined,
        type: activeTab === "all" ? undefined : activeTab,
        search: search || undefined,
        sort,
        page,
        limit: PAGE_SIZE,
      }),
  });

  useEffect(() => {
    if (!data?.parties) return;
    setParties((prev) =>
      page === 1 ? data.parties : [...prev, ...data.parties],
    );
  }, [data, page]);

  const pagination = data?.pagination;
  const hasMore = Boolean(
    pagination && pagination.page < pagination.pages,
  );

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
      setMergeSource(null);
      setMergePickerVisible(false);
      setPage(1);
      toast.success("Parties merged", result.message);
    },
    onError: (error) => {
      Alert.alert("Merge failed", getApiErrorMessage(error));
    },
  });

  const mergeTargetOptions = useMemo(
    () => parties.filter((p) => p._id !== mergeSource?._id),
    [parties, mergeSource],
  );

  const startMergeFlow = useCallback((party: Party) => {
    setMergeSource(party);
    setMergePickerVisible(true);
  }, []);

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
                  setParties((prev) => prev.filter((p) => p._id !== party._id));
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

  const formatBalance = (balance: number) => {
    const absBalance = Math.abs(balance);
    const formatted = absBalance.toLocaleString();
    if (balance > 0) return `${formatted} receivable`;
    if (balance < 0) return `${formatted} payable`;
    return "0 (settled)";
  };

  const goBackToSettings = () => router.replace("/(app)/settings" as any);

  const renderParty = ({ item: party }: { item: Party }) => (
    <TouchableOpacity
      className="rounded-xl p-4 mb-3 border"
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
      }}
      onPress={() => router.push(`/(app)/parties/${party._id}` as any)}
    >
      <View className="flex-row items-start">
        <View
          className="w-12 h-12 rounded-xl items-center justify-center"
          style={{
            backgroundColor:
              party.type === "customer"
                ? colors.success + "20"
                : colors.warning + "20",
          }}
        >
          <Ionicons
            name={party.type === "customer" ? "person" : "storefront"}
            size={24}
            color={
              party.type === "customer" ? colors.success : colors.warning
            }
          />
        </View>
        <View className="flex-1 ml-3">
          <View className="flex-row items-center">
            <Text
              className="text-base font-semibold flex-1"
              style={{ color: colors.text.primary }}
              numberOfLines={1}
            >
              {party.name}
            </Text>
            <View
              className="px-2 py-0.5 rounded-full"
              style={{
                backgroundColor:
                  party.type === "customer"
                    ? colors.success + "20"
                    : colors.warning + "20",
              }}
            >
              <Text
                className="text-xs font-medium capitalize"
                style={{
                  color:
                    party.type === "customer"
                      ? colors.success
                      : colors.warning,
                }}
              >
                {party.type}
              </Text>
            </View>
          </View>
          <Text
            className="text-sm mt-0.5"
            style={{ color: colors.text.secondary }}
          >
            {party.code}
            {party.phone ? ` • ${party.phone}` : ""}
          </Text>
          <Text
            className="text-sm font-medium mt-1"
            style={{
              color:
                party.current_balance > 0
                  ? colors.success
                  : party.current_balance < 0
                    ? colors.error
                    : colors.text.secondary,
            }}
          >
            {formatBalance(party.current_balance)}
          </Text>
        </View>
      </View>

      <View
        className="flex-row mt-3 pt-3 gap-2 border-t"
        style={{ borderColor: colors.border }}
      >
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center py-2 rounded-lg"
          style={{ backgroundColor: colors.bg.tertiary }}
          onPress={() =>
            router.push(`/(app)/parties/${party._id}/ledger` as any)
          }
        >
          <Ionicons
            name="document-text"
            size={16}
            color={colors.text.secondary}
          />
          <Text
            className="ml-1 text-sm"
            style={{ color: colors.text.secondary }}
          >
            Ledger
          </Text>
        </TouchableOpacity>
        {canManageParties && (
          <>
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center py-2 rounded-lg"
              style={{ backgroundColor: colors.bg.tertiary }}
              onPress={() =>
                router.push(`/(app)/parties/${party._id}/edit` as any)
              }
            >
              <Ionicons
                name="pencil"
                size={16}
                color={colors.text.secondary}
              />
              <Text
                className="ml-1 text-sm"
                style={{ color: colors.text.secondary }}
              >
                Edit
              </Text>
            </TouchableOpacity>
            {isDeleteModeActive ? (
              <>
                <TouchableOpacity
                  className="flex-row items-center justify-center py-2 px-3 rounded-lg gap-1"
                  style={{ backgroundColor: colors.warning + "20" }}
                  onPress={() => startMergeFlow(party)}
                >
                  <Ionicons
                    name="git-merge-outline"
                    size={16}
                    color={colors.warning}
                  />
                  <Text
                    className="text-sm font-medium"
                    style={{ color: colors.warning }}
                  >
                    Merge
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-row items-center justify-center py-2 px-3 rounded-lg gap-1"
                  style={{ backgroundColor: colors.error + "20" }}
                  onPress={() => handleDelete(party)}
                >
                  <Ionicons name="trash" size={16} color={colors.error} />
                  <Text
                    className="text-sm font-medium"
                    style={{ color: colors.error }}
                  >
                    Delete
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </>
        )}
      </View>
    </TouchableOpacity>
  );

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
            Delete Mode on — use Merge for duplicates, or Delete unused parties.
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
        {pagination?.total != null ? (
          <Text className="text-xs" style={{ color: colors.text.tertiary }}>
            Showing {parties.length} of {pagination.total}
          </Text>
        ) : null}
      </View>

      {isLoading && page === 1 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.info} />
        </View>
      ) : (
        <FlatList
          data={parties}
          keyExtractor={(item) => item._id}
          renderItem={renderParty}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && page === 1}
              onRefresh={() => {
                setPage(1);
                void refetch();
              }}
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
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                className="mt-2 mb-4 py-3 rounded-xl items-center"
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
            ) : parties.length > 0 ? (
              <Text
                className="text-center text-xs py-3"
                style={{ color: colors.text.tertiary }}
              >
                All parties loaded
              </Text>
            ) : null
          }
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
        onRequestClose={() => {
          setMergePickerVisible(false);
          setMergeSource(null);
        }}
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
            onPress={() => {
              setMergePickerVisible(false);
              setMergeSource(null);
            }}
          />
          <View
            style={{
              maxHeight: "70%",
              backgroundColor: colors.bg.primary,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 16,
            }}
          >
            <Text
              className="text-lg font-bold mb-2"
              style={{ color: colors.text.primary }}
            >
              Merge "{mergeSource?.name}" into…
            </Text>
            <FlatList
              data={mergeTargetOptions}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="py-3 border-b flex-row items-center justify-between"
                  style={{ borderColor: colors.border }}
                  onPress={() => {
                    if (!mergeSource) return;
                    Alert.alert(
                      "Confirm merge",
                      `Move all transactions from "${mergeSource.name}" to "${item.name}"?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Merge",
                          style: "destructive",
                          onPress: () =>
                            mergeMutation.mutate({
                              sourceId: mergeSource._id,
                              targetId: item._id,
                            }),
                        },
                      ],
                    );
                  }}
                >
                  <Text style={{ color: colors.text.primary }}>{item.name}</Text>
                  <Ionicons
                    name="git-merge-outline"
                    size={18}
                    color={colors.warning}
                  />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
