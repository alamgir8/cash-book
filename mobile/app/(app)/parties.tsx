import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
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
import { refreshAppData } from "@/lib/refresh-app-data";
import { useActiveOrgId, useOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { partiesApi, type Party, type PartyType } from "@/services/parties";
import { getApiErrorMessage } from "@/lib/api";
import { useDeleteMode } from "@/hooks/use-delete-mode";

const TAB_OPTIONS: { value: PartyType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "customer", label: "Customers" },
  { value: "supplier", label: "Suppliers" },
];

export default function PartiesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizationId = useActiveOrgId();
  const { colors } = useTheme();
  const { canManageParties, canManageCustomers, canManageSuppliers } =
    useOrganization();
  const { isDeleteModeActive } = useDeleteMode();

  const [activeTab, setActiveTab] = useState<PartyType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mergeSource, setMergeSource] = useState<Party | null>(null);
  const [mergePickerVisible, setMergePickerVisible] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["parties", organizationId, activeTab],
    queryFn: () =>
      partiesApi.list({
        organization: organizationId || undefined,
        type: activeTab === "all" ? undefined : activeTab,
      }),
  });

  const mergeMutation = useMutation({
    mutationFn: ({
      sourceId,
      targetId,
    }: {
      sourceId: string;
      targetId: string;
    }) => partiesApi.merge(sourceId, targetId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      setMergeSource(null);
      setMergePickerVisible(false);
      toast.success("Parties merged", data.message);
    },
    onError: (error) => {
      Alert.alert("Merge failed", getApiErrorMessage(error));
    },
  });

  const parties = useMemo(() => {
    const list = data?.parties || [];
    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query) ||
        p.phone?.toLowerCase().includes(query),
    );
  }, [data?.parties, searchQuery]);

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
      // Show confirm immediately — no network wait before the dialog
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
                  const data = error?.response?.data;
                  if (data?.canMerge || data?.transactionCount > 0) {
                    Alert.alert(
                      "Cannot delete",
                      data?.message ||
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

  const handleViewLedger = useCallback(
    (party: Party) => {
      router.push(`/(app)/parties/${party._id}/ledger` as any);
    },
    [router],
  );

  const formatBalance = (balance: number) => {
    const absBalance = Math.abs(balance);
    const formatted = absBalance.toLocaleString();
    if (balance > 0) return `${formatted} receivable`;
    if (balance < 0) return `${formatted} payable`;
    return "0 (settled)";
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return "text-green-600";
    if (balance < 0) return "text-red-600";
    return "text-gray-500";
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        <ScreenHeader
          title="Customers & Suppliers"
          showBack
          onBack={() => router.push("/(app)/settings" as any)}
        />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.info} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title="Customers & Suppliers"
        showBack
        onBack={() => router.push("/(app)/settings" as any)}
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
      ) : canManageParties ? (
        <View
          className="mx-4 mt-3 flex-row items-center gap-2 rounded-xl px-3 py-3 border"
          style={{
            backgroundColor: colors.info + "12",
            borderColor: colors.info + "35",
          }}
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.info}
          />
          <Text
            className="flex-1 text-sm"
            style={{ color: colors.text.secondary }}
          >
            To delete or merge duplicate vendors, enable Delete Mode from
            Settings (tap the gear icon 6 times).
          </Text>
        </View>
      ) : null}

      {/* Search Bar */}
      <View
        className="px-4 py-2 border-b"
        style={{
          backgroundColor: colors.bg.secondary,
          borderColor: colors.border,
        }}
      >
        <View
          className="flex-row items-center rounded-lg px-3 py-2"
          style={{ backgroundColor: colors.bg.tertiary }}
        >
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            className="flex-1 ml-2 text-base"
            style={{
              color: colors.text.primary,
            }}
            placeholder="Search by name, code, or phone..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.text.tertiary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View
        className="flex-row border-b px-4 py-2"
        style={{
          backgroundColor: colors.bg.secondary,
          borderColor: colors.border,
        }}
      >
        {TAB_OPTIONS.map((tab) => (
          <TouchableOpacity
            key={tab.value}
            className="mr-2 px-4 py-2 rounded-full"
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
                  activeTab === tab.value ? "white" : colors.text.secondary,
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refreshAppData(queryClient)}
          />
        }
      >
        {parties.length === 0 ? (
          <View className="p-8 items-center">
            <Ionicons
              name="people-outline"
              size={64}
              color={colors.text.tertiary}
            />
            <Text
              className="text-lg font-medium mt-4"
              style={{ color: colors.text.secondary }}
            >
              No Parties Found
            </Text>
            <Text
              className="text-sm text-center mt-2"
              style={{ color: colors.text.tertiary }}
            >
              {canManageParties
                ? "Add customers and suppliers to track your business relationships."
                : "No parties available. Contact your organization admin to add parties."}
            </Text>
            {canManageParties && (
              <TouchableOpacity
                className="mt-6 px-6 py-3 rounded-lg"
                style={{ backgroundColor: colors.info }}
                onPress={() => router.push("/(app)/parties/new" as any)}
              >
                <Text className="text-white font-medium">Add Party</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className="px-4 py-4">
            {parties.map((party) => (
              <TouchableOpacity
                key={party._id}
                className="rounded-xl p-4 mb-3 border shadow-sm"
                style={{
                  backgroundColor: colors.bg.secondary,
                  borderColor: colors.border,
                }}
                onPress={() =>
                  router.push(`/(app)/parties/${party._id}` as any)
                }
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
                        party.type === "customer"
                          ? colors.success
                          : colors.warning
                      }
                    />
                  </View>
                  <View className="flex-1 ml-3">
                    <View className="flex-row items-center">
                      <Text
                        className="text-base font-semibold flex-1"
                        style={{ color: colors.text.primary }}
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
                      {party.code} {party.phone && `• ${party.phone}`}
                    </Text>
                    <Text
                      className="text-sm font-medium mt-1"
                      style={{
                        color:
                          getBalanceColor(party.current_balance) ===
                          "text-green-600"
                            ? colors.success
                            : getBalanceColor(party.current_balance) ===
                                "text-red-600"
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
                    onPress={() => handleViewLedger(party)}
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
                            <Ionicons
                              name="trash"
                              size={16}
                              color={colors.error}
                            />
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
            ))}
          </View>
        )}
      </ScrollView>

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
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className="text-lg font-bold flex-1"
                style={{ color: colors.text.primary }}
              >
                Merge "{mergeSource?.name}" into…
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setMergePickerVisible(false);
                  setMergeSource(null);
                }}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>
            </View>
            <Text
              className="text-sm mb-3"
              style={{ color: colors.text.secondary }}
            >
              Linked transactions will move to the selected party, then "
              {mergeSource?.name}" will be deleted.
            </Text>
            <FlatList
              data={mergeTargetOptions}
              keyExtractor={(item) => item._id}
              ListEmptyComponent={
                <Text
                  className="text-center py-8"
                  style={{ color: colors.text.tertiary }}
                >
                  No other parties available to merge into
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="py-3 border-b flex-row items-center justify-between"
                  style={{ borderColor: colors.border }}
                  disabled={mergeMutation.isPending}
                  onPress={() => {
                    if (!mergeSource) return;
                    Alert.alert(
                      "Confirm merge",
                      `Move all transactions from "${mergeSource.name}" to "${item.name}" and delete "${mergeSource.name}"?`,
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
                  <View>
                    <Text
                      className="text-base font-medium"
                      style={{ color: colors.text.primary }}
                    >
                      {item.name}
                    </Text>
                    <Text
                      className="text-xs mt-0.5"
                      style={{ color: colors.text.secondary }}
                    >
                      {item.code}
                    </Text>
                  </View>
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
