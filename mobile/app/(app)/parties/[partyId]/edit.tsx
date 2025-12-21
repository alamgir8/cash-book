import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../../../components/screen-header";
import { partiesApi, type PartyType } from "../../../../services/parties";
import { getApiErrorMessage } from "../../../../lib/api";
import { Ionicons } from "@expo/vector-icons";

type FormData = {
  name: string;
  type: PartyType;
  code: string;
  phone: string;
  email: string;
  address: string;
  tax_number: string;
  credit_limit: string;
  credit_days: string;
  notes: string;
};

export default function EditPartyScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<FormData>({
    name: "",
    type: "customer",
    code: "",
    phone: "",
    email: "",
    address: "",
    tax_number: "",
    credit_limit: "",
    credit_days: "",
    notes: "",
  });

  const { data: party, isLoading: isLoadingParty } = useQuery({
    queryKey: ["party", partyId],
    queryFn: () => partiesApi.get(partyId!),
    enabled: !!partyId,
  });

  useEffect(() => {
    if (party) {
      setFormData({
        name: party.name,
        type: party.type,
        code: party.code,
        phone: party.phone || "",
        email: party.email || "",
        address: party.address || "",
        tax_number: party.tax_number || "",
        credit_limit: party.credit_limit?.toString() || "",
        credit_days: party.credit_days?.toString() || "",
        notes: party.notes || "",
      });
    }
  }, [party]);

  const mutation = useMutation({
    mutationFn: (data: Parameters<typeof partiesApi.update>[1]) =>
      partiesApi.update(partyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      queryClient.invalidateQueries({ queryKey: ["party", partyId] });
      Alert.alert("Success", "Party updated successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (error) => {
      Alert.alert("Error", getApiErrorMessage(error));
    },
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      Alert.alert("Error", "Please enter a party name");
      return;
    }

    mutation.mutate({
      name: formData.name.trim(),
      type: formData.type,
      code: formData.code.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      email: formData.email.trim() || undefined,
      address: formData.address.trim() || undefined,
      tax_number: formData.tax_number.trim() || undefined,
      credit_limit: formData.credit_limit
        ? parseFloat(formData.credit_limit)
        : undefined,
      credit_days: formData.credit_days
        ? parseInt(formData.credit_days, 10)
        : undefined,
      notes: formData.notes.trim() || undefined,
    });
  };

  const updateField = <K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoadingParty) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <ScreenHeader title="Edit Party" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScreenHeader title="Edit Party" showBack />

      <ScrollView className="flex-1 p-4">
        {/* Party Type */}
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
          <Text className="text-sm font-medium text-gray-700 mb-3">
            Party Type
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              className={`flex-1 flex-row items-center justify-center py-3 rounded-lg border-2 ${
                formData.type === "customer"
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 bg-white"
              }`}
              onPress={() => updateField("type", "customer")}
            >
              <Ionicons
                name="person"
                size={20}
                color={formData.type === "customer" ? "#10B981" : "#9CA3AF"}
              />
              <Text
                className={`ml-2 font-medium ${
                  formData.type === "customer"
                    ? "text-green-700"
                    : "text-gray-500"
                }`}
              >
                Customer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 flex-row items-center justify-center py-3 rounded-lg border-2 ${
                formData.type === "supplier"
                  ? "border-orange-500 bg-orange-50"
                  : "border-gray-200 bg-white"
              }`}
              onPress={() => updateField("type", "supplier")}
            >
              <Ionicons
                name="storefront"
                size={20}
                color={formData.type === "supplier" ? "#F97316" : "#9CA3AF"}
              />
              <Text
                className={`ml-2 font-medium ${
                  formData.type === "supplier"
                    ? "text-orange-700"
                    : "text-gray-500"
                }`}
              >
                Supplier
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Basic Info */}
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
          <Text className="text-sm font-semibold text-gray-900 mb-4">
            Basic Information
          </Text>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Name *
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
              placeholder="Enter party name"
              value={formData.name}
              onChangeText={(v) => updateField("name", v)}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">Code</Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
              placeholder="Party code"
              value={formData.code}
              onChangeText={(v) => updateField("code", v)}
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
            />
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Phone
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
                placeholder="Phone number"
                value={formData.phone}
                onChangeText={(v) => updateField("phone", v)}
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Email
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
                placeholder="Email address"
                value={formData.email}
                onChangeText={(v) => updateField("email", v)}
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>
        </View>

        {/* Address & Tax */}
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
          <Text className="text-sm font-semibold text-gray-900 mb-4">
            Address & Tax
          </Text>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Address
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
              placeholder="Full address"
              value={formData.address}
              onChangeText={(v) => updateField("address", v)}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={2}
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Tax Number / GST / VAT
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
              placeholder="Tax identification number"
              value={formData.tax_number}
              onChangeText={(v) => updateField("tax_number", v)}
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Credit Settings */}
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
          <Text className="text-sm font-semibold text-gray-900 mb-4">
            Credit Settings
          </Text>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Credit Limit
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
                placeholder="0"
                value={formData.credit_limit}
                onChangeText={(v) => updateField("credit_limit", v)}
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Credit Days
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
                placeholder="30"
                value={formData.credit_days}
                onChangeText={(v) => updateField("credit_days", v)}
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        {/* Notes */}
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
          <Text className="text-sm font-medium text-gray-700 mb-1">Notes</Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
            placeholder="Additional notes..."
            value={formData.notes}
            onChangeText={(v) => updateField("notes", v)}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          className={`py-4 rounded-xl mb-8 ${
            mutation.isPending ? "bg-blue-300" : "bg-blue-500"
          }`}
          onPress={handleSubmit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-center text-white font-semibold text-base">
              Update Party
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
