import React, { useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Organization } from "@/services/organizations";

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
];

const STATUS_OPTIONS = [
  {
    value: "active",
    label: "Active",
    color: "#10b981",
    icon: "checkmark-circle",
  },
  {
    value: "suspended",
    label: "Suspended",
    color: "#f59e0b",
    icon: "pause-circle",
  },
  { value: "archived", label: "Archived", color: "#ef4444", icon: "archive" },
];

// Zod validation schema
const settingsSchema = z.object({
  currency: z.string(),
  status: z.enum(["active", "suspended", "archived"]),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface OrganizationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  organization: Organization | null;
  onSubmit: (data: { settings: { currency: string }; status: string }) => void;
  isLoading?: boolean;
}

export function OrganizationSettingsModal({
  visible,
  onClose,
  organization,
  onSubmit,
  isLoading = false,
}: OrganizationSettingsModalProps) {
  const { control, handleSubmit, reset, watch } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      currency: "USD",
      status: "active",
    },
  });

  const selectedStatus = watch("status");

  useEffect(() => {
    if (visible && organization) {
      reset({
        currency:
          organization.settings?.currency_code ||
          organization.settings?.currency ||
          "USD",
        status: organization.status || "active",
      });
    }
  }, [visible, organization, reset]);

  const handleFormSubmit = (data: SettingsFormData) => {
    if (data.status === "archived") {
      Alert.alert(
        "Archive Organization",
        "Archiving will disable access for all members. Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Archive",
            style: "destructive",
            onPress: () => {
              onSubmit({
                settings: { currency: data.currency },
                status: data.status,
              });
            },
          },
        ]
      );
    } else {
      onSubmit({
        settings: { currency: data.currency },
        status: data.status,
      });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View
            className="bg-white rounded-t-3xl flex-1"
            style={{ maxHeight: "92%" }}
          >
            {/* Header */}
            <View className="flex-row justify-between items-center p-6 pb-4 border-b border-gray-100">
              <View>
                <Text className="text-gray-900 text-xl font-bold">
                  Organization Settings
                </Text>
                <Text className="text-gray-500 text-sm">
                  Update currency and status
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="flex-1 px-6 py-4"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <View className="gap-6">
                {/* Currency Selection */}
                <View>
                  <Text className="text-slate-700 mb-3 text-sm font-semibold">
                    Currency
                  </Text>
                  <Controller
                    control={control}
                    name="currency"
                    render={({ field: { onChange, value } }) => (
                      <View className="flex-row flex-wrap gap-2">
                        {CURRENCIES.map((currency) => (
                          <TouchableOpacity
                            key={currency.code}
                            className={`px-4 py-3 rounded-xl border-2 flex-row items-center ${
                              value === currency.code
                                ? "bg-blue-50 border-blue-500"
                                : "bg-slate-50 border-slate-200"
                            }`}
                            onPress={() => onChange(currency.code)}
                          >
                            <Text
                              className={`text-lg font-bold mr-2 ${
                                value === currency.code
                                  ? "text-blue-600"
                                  : "text-slate-500"
                              }`}
                            >
                              {currency.symbol}
                            </Text>
                            <Text
                              className={`text-sm font-semibold ${
                                value === currency.code
                                  ? "text-blue-700"
                                  : "text-slate-600"
                              }`}
                            >
                              {currency.code}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  />
                </View>

                {/* Status Selection */}
                <View>
                  <Text className="text-slate-700 mb-3 text-sm font-semibold">
                    Organization Status
                  </Text>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field: { onChange, value } }) => (
                      <View className="flex-row flex-wrap gap-2">
                        {STATUS_OPTIONS.map((status) => (
                          <TouchableOpacity
                            key={status.value}
                            className={`flex-1 min-w-[100px] px-4 py-3 rounded-xl border-2 flex-row items-center justify-center ${
                              value === status.value
                                ? "bg-blue-50 border-blue-500"
                                : "bg-slate-50 border-slate-200"
                            }`}
                            onPress={() => onChange(status.value)}
                          >
                            <View
                              className="w-5 h-5 rounded-full items-center justify-center mr-2"
                              style={{
                                backgroundColor:
                                  value === status.value
                                    ? status.color
                                    : "#94a3b8",
                              }}
                            >
                              {value === status.value && (
                                <Ionicons
                                  name="checkmark"
                                  size={12}
                                  color="white"
                                />
                              )}
                            </View>
                            <Text
                              className={`text-sm font-semibold ${
                                value === status.value
                                  ? "text-blue-700"
                                  : "text-slate-600"
                              }`}
                            >
                              {status.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  />
                </View>

                {/* Warning for archived status */}
                {selectedStatus === "archived" && (
                  <View className="flex-row bg-amber-50 p-3 rounded-xl border border-amber-200 gap-2">
                    <Ionicons name="warning" size={20} color="#f59e0b" />
                    <Text className="flex-1 text-amber-900 text-sm">
                      Archiving will disable access for all members. This action
                      can be reversed by reactivating the organization.
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Footer */}
            <View className="p-6 pt-4 pb-8 border-t border-gray-100">
              <TouchableOpacity
                className={`bg-blue-500 flex-row items-center justify-center py-3.5 rounded-xl ${
                  isLoading ? "opacity-60" : ""
                }`}
                onPress={handleSubmit(handleFormSubmit)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="save" size={20} color="white" />
                    <Text className="text-white text-base font-semibold ml-2">
                      Save Changes
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
