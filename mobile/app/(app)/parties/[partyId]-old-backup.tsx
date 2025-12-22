import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { toast } from "@/lib/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { partiesApi } from "@/services/parties";
import { getApiErrorMessage } from "@/lib/api";

export default function PartyDetailScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: party, isLoading } = useQuery({
    queryKey: ["party", partyId],
    queryFn: () => partiesApi.get(partyId!),
    enabled: !!partyId,
  });

  const deleteMutation = useMutation({
    mutationFn: partiesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      toast.success("Party deleted successfully");
      router.back();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const handleDelete = () => {
    Alert.alert(
      "Delete Party",
      `Are you sure you want to delete "${party?.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(partyId!),
        },
      ]
    );
  };

  const handleCall = () => {
    if (party?.phone) {
      Linking.openURL(`tel:${party.phone}`);
    }
  };

  const handleEmail = () => {
    if (party?.email) {
      Linking.openURL(`mailto:${party.email}`);
    }
  };

  const formatBalance = (balance: number) => {
    const absBalance = Math.abs(balance);
    const formatted = absBalance.toLocaleString();
    if (balance > 0) return `${formatted} Receivable`;
    if (balance < 0) return `${formatted} Payable`;
    return "Settled";
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return "text-green-600";
    if (balance < 0) return "text-red-600";
    return "text-gray-500";
  };

  if (isLoading || !party) {
    return (
      <View className="flex-1 bg-white">
        <ScreenHeader title="Party Details" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <ScreenHeader
        title="Party Details"
        showBack
        rightAction={
          <TouchableOpacity
            className="p-2"
            onPress={() => router.push(`/parties/${partyId}/edit`)}
          >
            <Ionicons name="pencil" size={22} color="#3B82F6" />
          </TouchableOpacity>
        }
      />

      <ScrollView className="flex-1">
        {/* Header Card */}
        <View className="bg-white p-6 border-b border-gray-100">
          <View className="flex-row items-center">
            <View
              className={`w-16 h-16 rounded-2xl items-center justify-center ${
                party.type === "customer" ? "bg-green-100" : "bg-orange-100"
              }`}
            >
              <Ionicons
                name={party.type === "customer" ? "person" : "storefront"}
                size={32}
                color={party.type === "customer" ? "#10B981" : "#F97316"}
              />
            </View>
            <View className="flex-1 ml-4">
              <View className="flex-row items-center">
                <Text className="text-xl font-bold text-gray-900 flex-1">
                  {party.name}
                </Text>
                <View
                  className={`px-3 py-1 rounded-full ${
                    party.type === "customer" ? "bg-green-100" : "bg-orange-100"
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
              <Text className="text-sm text-gray-500 mt-1">{party.code}</Text>
            </View>
          </View>

          {/* Balance */}
          <View className="mt-6 p-4 bg-gray-50 rounded-xl">
            <Text className="text-sm text-gray-500">Current Balance</Text>
            <Text
              className={`text-2xl font-bold mt-1 ${getBalanceColor(
                party.current_balance
              )}`}
            >
              {formatBalance(party.current_balance)}
            </Text>
          </View>

          {/* Quick Actions */}
          <View className="flex-row mt-4 gap-3">
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center py-3 bg-blue-500 rounded-xl"
              onPress={() => router.push(`/parties/${partyId}/ledger`)}
            >
              <Ionicons name="document-text" size={20} color="white" />
              <Text className="ml-2 text-white font-medium">View Ledger</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center py-3 bg-gray-100 rounded-xl"
              onPress={() => router.push(`/invoices/new?partyId=${partyId}`)}
            >
              <Ionicons name="receipt" size={20} color="#374151" />
              <Text className="ml-2 text-gray-700 font-medium">
                New Invoice
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Contact Info */}
        {(party.phone || party.email || party.address) && (
          <View className="bg-white p-4 mt-3 border-y border-gray-100">
            <Text className="text-sm font-semibold text-gray-900 mb-3">
              Contact Information
            </Text>

            {party.phone && (
              <TouchableOpacity
                className="flex-row items-center py-3 border-b border-gray-100"
                onPress={handleCall}
              >
                <View className="w-10 h-10 bg-blue-100 rounded-xl items-center justify-center">
                  <Ionicons name="call" size={20} color="#3B82F6" />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-sm text-gray-500">Phone</Text>
                  <Text className="text-base text-gray-900">{party.phone}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}

            {party.email && (
              <TouchableOpacity
                className="flex-row items-center py-3 border-b border-gray-100"
                onPress={handleEmail}
              >
                <View className="w-10 h-10 bg-purple-100 rounded-xl items-center justify-center">
                  <Ionicons name="mail" size={20} color="#8B5CF6" />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-sm text-gray-500">Email</Text>
                  <Text className="text-base text-gray-900">{party.email}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}

            {party.address && (
              <View className="flex-row items-center py-3">
                <View className="w-10 h-10 bg-green-100 rounded-xl items-center justify-center">
                  <Ionicons name="location" size={20} color="#10B981" />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-sm text-gray-500">Address</Text>
                  <Text className="text-base text-gray-900">
                    {typeof party.address === "string"
                      ? party.address
                      : [
                          party.address.street,
                          party.address.city,
                          party.address.state,
                          party.address.postal_code,
                          party.address.country,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Not specified"}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Business Info */}
        <View className="bg-white p-4 mt-3 border-y border-gray-100">
          <Text className="text-sm font-semibold text-gray-900 mb-3">
            Business Details
          </Text>

          <View className="flex-row">
            <View className="flex-1 pr-2">
              <Text className="text-sm text-gray-500">Tax ID</Text>
              <Text className="text-base text-gray-900 mt-1">
                {party.tax_id || "Not specified"}
              </Text>
            </View>
            <View className="flex-1 pl-2">
              <Text className="text-sm text-gray-500">Credit Limit</Text>
              <Text className="text-base text-gray-900 mt-1">
                {party.credit_limit
                  ? party.credit_limit.toLocaleString()
                  : "No limit"}
              </Text>
            </View>
          </View>

          <View className="flex-row mt-4">
            <View className="flex-1 pr-2">
              <Text className="text-sm text-gray-500">Payment Terms</Text>
              <Text className="text-base text-gray-900 mt-1">
                {party.payment_terms_days || "0"} days
              </Text>
            </View>
            <View className="flex-1 pl-2">
              <Text className="text-sm text-gray-500">Opening Balance</Text>
              <Text className="text-base text-gray-900 mt-1">
                {party.opening_balance
                  ? formatBalance(party.opening_balance)
                  : "0"}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {party.notes && (
          <View className="bg-white p-4 mt-3 border-y border-gray-100">
            <Text className="text-sm font-semibold text-gray-900 mb-2">
              Notes
            </Text>
            <Text className="text-base text-gray-600">{party.notes}</Text>
          </View>
        )}

        {/* Meta Info */}
        <View className="bg-white p-4 mt-3 border-y border-gray-100">
          <View className="flex-row">
            <View className="flex-1">
              <Text className="text-sm text-gray-500">Created</Text>
              <Text className="text-sm text-gray-700 mt-1">
                {new Date(party.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm text-gray-500">Last Updated</Text>
              <Text className="text-sm text-gray-700 mt-1">
                {new Date(party.updatedAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Delete Button */}
        <View className="p-4">
          <TouchableOpacity
            className="py-4 bg-red-50 rounded-xl border border-red-200"
            onPress={handleDelete}
          >
            <Text className="text-center text-red-600 font-medium">
              Delete Party
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
