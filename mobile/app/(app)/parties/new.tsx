import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../../components/screen-header";
import { useActiveOrgId } from "../../../hooks/useOrganization";
import { partiesApi, type PartyType } from "../../../services/parties";
import { getApiErrorMessage } from "../../../lib/api";

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
  opening_balance: string;
  opening_balance_type: "receivable" | "payable";
  notes: string;
};

export default function NewPartyScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizationId = useActiveOrgId();

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
    opening_balance: "",
    opening_balance_type: "receivable",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: partiesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      Alert.alert("Success", "Party created successfully", [
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

    const openingBalance = parseFloat(formData.opening_balance) || 0;
    const balanceValue =
      formData.opening_balance_type === "payable"
        ? -Math.abs(openingBalance)
        : Math.abs(openingBalance);

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
      opening_balance: balanceValue,
      notes: formData.notes.trim() || undefined,
      organization: organizationId || undefined,
    });
  };

  const updateField = <K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScreenHeader title="New Party" showBack />

      <ScrollView className="flex-1 p-4">
        {/* Party Type */}
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
          <Text className="text-sm font-medium text-gray-700 mb-3">
            Party Type *
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
              placeholder="Auto-generated if empty"
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

        {/* Opening Balance */}
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
          <Text className="text-sm font-semibold text-gray-900 mb-4">
            Opening Balance
          </Text>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Amount
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
              placeholder="0.00"
              value={formData.opening_balance}
              onChangeText={(v) => updateField("opening_balance", v)}
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />
          </View>

          <Text className="text-sm font-medium text-gray-700 mb-2">
            Balance Type
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              className={`flex-1 py-3 rounded-lg border-2 ${
                formData.opening_balance_type === "receivable"
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 bg-white"
              }`}
              onPress={() => updateField("opening_balance_type", "receivable")}
            >
              <Text
                className={`text-center font-medium ${
                  formData.opening_balance_type === "receivable"
                    ? "text-green-700"
                    : "text-gray-500"
                }`}
              >
                Receivable (they owe)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 py-3 rounded-lg border-2 ${
                formData.opening_balance_type === "payable"
                  ? "border-red-500 bg-red-50"
                  : "border-gray-200 bg-white"
              }`}
              onPress={() => updateField("opening_balance_type", "payable")}
            >
              <Text
                className={`text-center font-medium ${
                  formData.opening_balance_type === "payable"
                    ? "text-red-700"
                    : "text-gray-500"
                }`}
              >
                Payable (we owe)
              </Text>
            </TouchableOpacity>
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
              Create Party
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
