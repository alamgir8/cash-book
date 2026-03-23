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
  Keyboard,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
        ],
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
      <View
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
          style={{ flex: 1 }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
        >
          <View
            className="rounded-t-3xl"
            style={{
              backgroundColor: colors.bg.primary,
              maxHeight: Dimensions.get("window").height * 0.85,
            }}
          >
            {/* Header */}
            <View
              className="flex-row justify-between items-center p-6 pb-4 border-b"
              style={{ borderColor: colors.border }}
            >
              <View>
                <Text
                  className="text-xl font-bold"
                  style={{ color: colors.text.primary }}
                >
                  Organization Settings
                </Text>
                <Text
                  className="text-sm"
                  style={{ color: colors.text.secondary }}
                >
                  Update currency and status
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.bg.tertiary }}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="px-6 py-4"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <View className="gap-6">
                {/* Currency Selection */}
                <View>
                  <Text
                    className="mb-3 text-sm font-semibold"
                    style={{ color: colors.text.primary }}
                  >
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
                            className="px-4 py-3 rounded-xl border-2 flex-row items-center"
                            style={{
                              backgroundColor:
                                value === currency.code
                                  ? colors.primary + "15"
                                  : colors.bg.secondary,
                              borderColor:
                                value === currency.code
                                  ? colors.primary
                                  : colors.border,
                            }}
                            onPress={() => onChange(currency.code)}
                          >
                            <Text
                              className="text-lg font-bold mr-2"
                              style={{
                                color:
                                  value === currency.code
                                    ? colors.primary
                                    : colors.text.tertiary,
                              }}
                            >
                              {currency.symbol}
                            </Text>
                            <Text
                              className="text-sm font-semibold"
                              style={{
                                color:
                                  value === currency.code
                                    ? colors.primary
                                    : colors.text.secondary,
                              }}
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
                  <Text
                    className="mb-3 text-sm font-semibold"
                    style={{ color: colors.text.primary }}
                  >
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
                            className="flex-1 min-w-[100px] px-4 py-3 rounded-xl border-2 flex-row items-center justify-center"
                            style={{
                              backgroundColor:
                                value === status.value
                                  ? colors.primary + "15"
                                  : colors.bg.secondary,
                              borderColor:
                                value === status.value
                                  ? colors.primary
                                  : colors.border,
                            }}
                            onPress={() => onChange(status.value)}
                          >
                            <View
                              className="w-5 h-5 rounded-full items-center justify-center mr-2"
                              style={{
                                backgroundColor:
                                  value === status.value
                                    ? status.color
                                    : colors.text.tertiary,
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
                              className="text-sm font-semibold"
                              style={{
                                color:
                                  value === status.value
                                    ? colors.primary
                                    : colors.text.secondary,
                              }}
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
                  <View
                    className="flex-row p-3 rounded-xl border gap-2"
                    style={{
                      backgroundColor: colors.warning + "15",
                      borderColor: colors.warning + "40",
                    }}
                  >
                    <Ionicons name="warning" size={20} color={colors.warning} />
                    <Text
                      className="flex-1 text-sm"
                      style={{ color: colors.text.primary }}
                    >
                      Archiving will disable access for all members. This action
                      can be reversed by reactivating the organization.
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Footer */}
            <View
              className="px-6 pt-4 border-t"
              style={{
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 16),
              }}
            >
              <TouchableOpacity
                className={`flex-row items-center justify-center py-3.5 rounded-xl ${
                  isLoading ? "opacity-60" : ""
                }`}
                style={{ backgroundColor: colors.info }}
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
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
