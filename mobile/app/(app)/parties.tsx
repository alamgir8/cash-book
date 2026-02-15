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
} from "react-native";
import { useRouter } from "expo-router";
import { toast } from "@/lib/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { useActiveOrgId, useOrganization } from "@/hooks/useOrganization";
import { useTheme } from "@/hooks/useTheme";
import { partiesApi, type Party, type PartyType } from "@/services/parties";
import { getApiErrorMessage } from "@/lib/api";

const TAB_OPTIONS: { value: PartyType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "customer", label: "Customers" },
  { value: "supplier", label: "Suppliers" },
];

export default function PartiesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizationId = useActiveOrgId();
  const { canManageParties, canManageCustomers, canManageSuppliers } =
    useOrganization();

  const [activeTab, setActiveTab] = useState<PartyType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["parties", organizationId, activeTab],
    queryFn: () =>
      partiesApi.list({
        organization: organizationId || undefined,
        type: activeTab === "all" ? undefined : activeTab,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: partiesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
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

  const handleDelete = useCallback(
    (party: Party) => {
      Alert.alert(
        "Delete Party",
        `Are you sure you want to delete "${party.name}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteMutation.mutate(party._id),
          },
        ],
      );
    },
    [deleteMutation],
  );

  const handleViewLedger = useCallback(
    (party: Party) => {
      router.push(`/parties/${party._id}/ledger`);
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
      <View className="flex-1 bg-white">
        <ScreenHeader title="Parties" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </View>
    );
  }

  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title="Parties"
        showBack
        rightAction={
          canManageParties ? (
            <TouchableOpacity
              className="p-2"
              onPress={() => router.push("/parties/new")}
            >
              <Ionicons name="add-circle" size={28} color={colors.info} />
            </TouchableOpacity>
          ) : undefined
        }
      />

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
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
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
                onPress={() => router.push("/parties/new")}
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
                onPress={() => router.push(`/parties/${party._id}`)}
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
                          router.push(`/parties/${party._id}/edit`)
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
                      <TouchableOpacity
                        className="flex-row items-center justify-center py-2 px-3 rounded-lg"
                        style={{ backgroundColor: colors.error + "20" }}
                        onPress={() => handleDelete(party)}
                      >
                        <Ionicons name="trash" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
