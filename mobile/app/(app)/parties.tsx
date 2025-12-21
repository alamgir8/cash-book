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
import { toast } from "../../lib/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../components/screen-header";
import { useActiveOrgId } from "../../hooks/useOrganization";
import { partiesApi, type Party, type PartyType } from "../../services/parties";
import { getApiErrorMessage } from "../../lib/api";

const TAB_OPTIONS: { value: PartyType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "customer", label: "Customers" },
  { value: "supplier", label: "Suppliers" },
];

export default function PartiesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizationId = useActiveOrgId();

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
        p.phone?.toLowerCase().includes(query)
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
        ]
      );
    },
    [deleteMutation]
  );

  const handleViewLedger = useCallback(
    (party: Party) => {
      router.push(`/parties/${party._id}/ledger`);
    },
    [router]
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

  return (
    <View className="flex-1 bg-gray-50">
      <ScreenHeader
        title="Parties"
        showBack
        rightAction={
          <TouchableOpacity
            className="p-2"
            onPress={() => router.push("/parties/new")}
          >
            <Ionicons name="add-circle" size={28} color="#3B82F6" />
          </TouchableOpacity>
        }
      />

      {/* Search Bar */}
      <View className="px-4 py-2 bg-white border-b border-gray-100">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            className="flex-1 ml-2 text-base text-gray-900"
            placeholder="Search by name, code, or phone..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-white border-b border-gray-100 px-4 py-2">
        {TAB_OPTIONS.map((tab) => (
          <TouchableOpacity
            key={tab.value}
            className={`mr-2 px-4 py-2 rounded-full ${
              activeTab === tab.value ? "bg-blue-500" : "bg-gray-100"
            }`}
            onPress={() => setActiveTab(tab.value)}
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === tab.value ? "text-white" : "text-gray-600"
              }`}
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
            <Ionicons name="people-outline" size={64} color="#D1D5DB" />
            <Text className="text-lg font-medium text-gray-500 mt-4">
              No Parties Found
            </Text>
            <Text className="text-sm text-gray-400 text-center mt-2">
              Add customers and suppliers to track your business relationships.
            </Text>
            <TouchableOpacity
              className="mt-6 bg-blue-500 px-6 py-3 rounded-lg"
              onPress={() => router.push("/parties/new")}
            >
              <Text className="text-white font-medium">Add Party</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="px-4 py-4">
            {parties.map((party) => (
              <TouchableOpacity
                key={party._id}
                className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm"
                onPress={() => router.push(`/parties/${party._id}`)}
              >
                <View className="flex-row items-start">
                  <View
                    className={`w-12 h-12 rounded-xl items-center justify-center ${
                      party.type === "customer"
                        ? "bg-green-100"
                        : "bg-orange-100"
                    }`}
                  >
                    <Ionicons
                      name={party.type === "customer" ? "person" : "storefront"}
                      size={24}
                      color={party.type === "customer" ? "#10B981" : "#F97316"}
                    />
                  </View>
                  <View className="flex-1 ml-3">
                    <View className="flex-row items-center">
                      <Text className="text-base font-semibold text-gray-900 flex-1">
                        {party.name}
                      </Text>
                      <View
                        className={`px-2 py-0.5 rounded-full ${
                          party.type === "customer"
                            ? "bg-green-100"
                            : "bg-orange-100"
                        }`}
                      >
                        <Text
                          className={`text-xs font-medium capitalize ${
                            party.type === "customer"
                              ? "text-green-700"
                              : "text-orange-700"
                          }`}
                        >
                          {party.type}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-sm text-gray-500 mt-0.5">
                      {party.code} {party.phone && `• ${party.phone}`}
                    </Text>
                    <Text
                      className={`text-sm font-medium mt-1 ${getBalanceColor(
                        party.current_balance
                      )}`}
                    >
                      {formatBalance(party.current_balance)}
                    </Text>
                  </View>
                </View>

                <View className="flex-row mt-3 pt-3 border-t border-gray-100 gap-2">
                  <TouchableOpacity
                    className="flex-1 flex-row items-center justify-center py-2 bg-gray-50 rounded-lg"
                    onPress={() => handleViewLedger(party)}
                  >
                    <Ionicons name="document-text" size={16} color="#6B7280" />
                    <Text className="ml-1 text-sm text-gray-600">Ledger</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 flex-row items-center justify-center py-2 bg-gray-50 rounded-lg"
                    onPress={() => router.push(`/parties/${party._id}/edit`)}
                  >
                    <Ionicons name="pencil" size={16} color="#6B7280" />
                    <Text className="ml-1 text-sm text-gray-600">Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-row items-center justify-center py-2 px-3 bg-red-50 rounded-lg"
                    onPress={() => handleDelete(party)}
                  >
                    <Ionicons name="trash" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
