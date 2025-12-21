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
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Organization } from "../../services/organizations";

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
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      currency: "USD",
      status: "active",
    },
  });

  const selectedCurrency = watch("currency");
  const selectedStatus = watch("status");

  useEffect(() => {
    if (visible && organization) {
      reset({
        currency: organization.settings?.currency_code || "USD",
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
        style={styles.keyboardView}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>Organization Settings</Text>
                <Text style={styles.headerSubtitle}>
                  Update currency and status
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.formContainer}>
                {/* Currency Selection */}
                <View>
                  <Text style={styles.label}>Currency</Text>
                  <Controller
                    control={control}
                    name="currency"
                    render={({ field: { onChange, value } }) => (
                      <View style={styles.currencyContainer}>
                        {CURRENCIES.map((currency) => (
                          <TouchableOpacity
                            key={currency.code}
                            style={[
                              styles.currencyButton,
                              value === currency.code &&
                                styles.currencyButtonActive,
                            ]}
                            onPress={() => onChange(currency.code)}
                          >
                            <Text
                              style={[
                                styles.currencySymbol,
                                value === currency.code &&
                                  styles.currencySymbolActive,
                              ]}
                            >
                              {currency.symbol}
                            </Text>
                            <Text
                              style={[
                                styles.currencyCode,
                                value === currency.code &&
                                  styles.currencyCodeActive,
                              ]}
                            >
                              {currency.code}
                            </Text>
                            <Text
                              style={[
                                styles.currencyName,
                                value === currency.code &&
                                  styles.currencyNameActive,
                              ]}
                            >
                              {currency.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  />
                </View>

                {/* Status Selection */}
                <View>
                  <Text style={styles.label}>Organization Status</Text>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field: { onChange, value } }) => (
                      <View style={styles.statusContainer}>
                        {STATUS_OPTIONS.map((status) => (
                          <TouchableOpacity
                            key={status.value}
                            style={[
                              styles.statusButton,
                              value === status.value &&
                                styles.statusButtonActive,
                              value === status.value && {
                                borderColor: status.color,
                              },
                            ]}
                            onPress={() => onChange(status.value)}
                          >
                            <View style={styles.statusButtonContent}>
                              <Ionicons
                                name={status.icon as any}
                                size={24}
                                color={
                                  value === status.value
                                    ? status.color
                                    : "#9ca3af"
                                }
                              />
                              <Text
                                style={[
                                  styles.statusButtonText,
                                  value === status.value && {
                                    color: status.color,
                                  },
                                ]}
                              >
                                {status.label}
                              </Text>
                            </View>
                            {value === status.value && (
                              <Ionicons
                                name="checkmark-circle"
                                size={20}
                                color={status.color}
                              />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  />
                </View>

                {/* Warning for archived status */}
                {selectedStatus === "archived" && (
                  <View style={styles.warningBox}>
                    <Ionicons name="warning" size={20} color="#f59e0b" />
                    <Text style={styles.warningText}>
                      Archiving will disable access for all members. This action
                      can be reversed by reactivating the organization.
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isLoading && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit(handleFormSubmit)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="save" size={20} color="white" />
                    <Text style={styles.submitButtonText}>Save Changes</Text>
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

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "#6b7280",
    fontSize: 14,
  },
  closeButton: {
    width: 32,
    height: 32,
    backgroundColor: "#f3f4f6",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  formContainer: {
    gap: 24,
  },
  label: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  currencyContainer: {
    gap: 12,
  },
  currencyButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  currencyButtonActive: {
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#6b7280",
    width: 40,
  },
  currencySymbolActive: {
    color: "#3b82f6",
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    width: 60,
  },
  currencyCodeActive: {
    color: "#1e40af",
  },
  currencyName: {
    flex: 1,
    fontSize: 14,
    color: "#6b7280",
  },
  currencyNameActive: {
    color: "#3b82f6",
  },
  statusContainer: {
    gap: 12,
  },
  statusButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  statusButtonActive: {
    backgroundColor: "#f9fafb",
  },
  statusButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  warningBox: {
    flexDirection: "row",
    backgroundColor: "#fffbeb",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fef3c7",
    gap: 8,
  },
  warningText: {
    flex: 1,
    color: "#92400e",
    fontSize: 13,
  },
  footer: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  submitButton: {
    backgroundColor: "#3b82f6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
