import { useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../hooks/useAuth";
import { useBiometric } from "../../hooks/useBiometric";
import {
  exportTransactionsPdf,
  exportTransactionsByCategoryPdf,
  exportTransactionsByCounterpartyPdf,
  exportTransactionsByAccountPdf,
} from "../../services/reports";
import {
  exportBackupToFile,
  importBackupFromFile,
} from "../../services/backup";
import { ScreenHeader } from "../../components/screen-header";
import { ActionButton } from "../../components/action-button";
import { ProfileEditModal } from "../../components/profile-edit-modal";
import { BiometricSettingsModal } from "../../components/biometric-settings-modal";
import { queryKeys } from "../../lib/queryKeys";

type ExportType = "all" | "category" | "counterparty" | "account" | null;

export default function SettingsScreen() {
  const { state, signOut } = useAuth();
  const {
    status: biometricStatus,
    getBiometricDisplayName,
    getBiometricIconName,
  } = useBiometric();
  const queryClient = useQueryClient();
  const [exportingType, setExportingType] = useState<ExportType>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  const handleExport = async (type: ExportType) => {
    if (!type) return;
    try {
      setExportingType(type);
      switch (type) {
        case "all":
          await exportTransactionsPdf({});
          Toast.show({ type: "success", text1: "Full report exported" });
          break;
        case "category":
          await exportTransactionsByCategoryPdf();
          Toast.show({
            type: "success",
            text1: "Category-wise report exported",
          });
          break;
        case "counterparty":
          await exportTransactionsByCounterpartyPdf();
          Toast.show({
            type: "success",
            text1: "Counterparty-wise report exported",
          });
          break;
        case "account":
          await exportTransactionsByAccountPdf();
          Toast.show({
            type: "success",
            text1: "Account-wise report exported",
          });
          break;
      }
    } catch {
      Toast.show({ type: "error", text1: "Failed to export report" });
    } finally {
      setExportingType(null);
    }
  };

  const handleBackup = async () => {
    try {
      setBackingUp(true);
      const filename = await exportBackupToFile();
      Toast.show({
        type: "success",
        text1: "Backup created successfully",
        text2: `Saved as ${filename}`,
      });
    } catch (error: any) {
      // console.error(error);
      Toast.show({
        type: "error",
        text1: "Failed to create backup",
        text2: error?.message || "Please try again",
      });
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = () => {
    Alert.alert(
      "Restore Backup",
      "This will import data from a backup file. Existing data will NOT be deleted, but duplicate categories will be skipped. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Select File",
          onPress: () => {
            performRestore();
          },
        },
      ]
    );
  };

  const performRestore = async () => {
    try {
      setRestoring(true);
      const result = await importBackupFromFile();

      // console.log("Import result:", JSON.stringify(result, null, 2));

      // Check if result exists and has summary
      if (!result || !result.summary) {
        throw new Error("Invalid response from server");
      }

      // Invalidate all queries to refresh data
      queryClient.invalidateQueries({
        queryKey: queryKeys.accounts,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.categories.all,
      });
      queryClient.invalidateQueries({
        queryKey: ["transactions"],
      });

      const { summary } = result;

      // Build a detailed message
      const details: string[] = [];
      if (summary.accountsImported)
        details.push(`${summary.accountsImported} accounts`);
      if (summary.categoriesImported)
        details.push(`${summary.categoriesImported} categories`);
      if (summary.transactionsImported)
        details.push(`${summary.transactionsImported} transactions`);
      if (summary.transfersImported)
        details.push(`${summary.transfersImported} transfers`);

      // Show balance if available
      const balanceText = summary.totalBalance
        ? ` (Balance: ${summary.totalBalance.toLocaleString()})`
        : "";

      Toast.show({
        type: "success",
        text1: "Backup restored successfully",
        text2: details.join(", ") + balanceText || "No data imported",
        visibilityTime: 5000,
      });
    } catch (error: any) {
      console.error("Restore error:", error);

      // Handle user cancellation (not an error)
      if (error?.message === "No file selected") {
        // User cancelled file picker, don't show error
        return;
      }

      // Extract error message safely
      let message = "Please try again";
      if (error?.response?.data?.message) {
        message = error.response.data.message;
      } else if (error?.response?.data?.errors) {
        // Zod validation errors
        message = "Invalid backup file format";
      } else if (error?.message) {
        message = error.message;
      }

      Toast.show({
        type: "error",
        text1: "Failed to restore backup",
        text2: message,
        visibilityTime: 4000,
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleProfileModalClose = () => {
    setShowProfileModal(false);
  };

  return (
    <View className="flex-1 bg-gradient-to-b from-purple-50 to-gray-50">
      <ScreenHeader
        title="Settings"
        subtitle="Profile and app preferences"
        icon="settings"
        iconColor="#8b5cf6"
        gradientFrom="from-purple-100"
        gradientTo="to-purple-200"
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 20,
          gap: 20,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced Profile Section */}
        <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg">
          <View className="flex-row items-center gap-4 mb-6">
            <View className="w-18 h-18 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full items-center justify-center">
              <Ionicons name="person" size={32} color="#1d4ed8" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
                Your Profile
              </Text>
              <Text className="text-gray-900 text-xl font-bold mt-1">
                {state.status === "authenticated"
                  ? state.user.name
                  : "Unknown User"}
              </Text>
            </View>
          </View>

          {state.status === "authenticated" ? (
            <View className="gap-3">
              <View className="flex-row items-center gap-3">
                <Ionicons name="mail" size={18} color="#6b7280" />
                <Text className="text-gray-700 flex-1">{state.user.email}</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Ionicons name="call" size={18} color="#6b7280" />
                <Text className="text-gray-700 flex-1">{state.user.phone}</Text>
              </View>
            </View>
          ) : null}

          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={() => setShowProfileModal(true)}
              className="flex-1 flex-row gap-2 items-center justify-center bg-purple-50 rounded-2xl py-3 active:scale-95"
            >
              <Ionicons name="create" size={18} color="#8b5cf6" />
              <Text className="text-purple-700 font-bold text-sm">
                Edit Profile
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowProfileModal(true)}
              className="flex-1 flex-row gap-2 items-center justify-center bg-blue-50 rounded-2xl py-3 active:scale-95"
            >
              <Ionicons name="settings" size={18} color="#1d4ed8" />
              <Text className="text-blue-700 font-bold text-sm">
                Preferences
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Security Settings - Biometric Login */}
        <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg">
          <View className="flex-row items-center gap-4 mb-4">
            <View className="w-14 h-14 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full items-center justify-center">
              <Ionicons name="shield-checkmark" size={28} color="#8b5cf6" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 text-xl font-bold">Security</Text>
              <Text className="text-gray-600 text-sm mt-1">
                Protect your account
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setShowBiometricModal(true)}
            className="flex-row items-center gap-4 bg-purple-50 rounded-2xl p-4 active:scale-98"
          >
            <View className="w-12 h-12 bg-purple-100 rounded-full items-center justify-center">
              <Ionicons
                name={
                  biometricStatus
                    ? getBiometricIconName(biometricStatus.biometricType)
                    : "finger-print"
                }
                size={24}
                color="#8b5cf6"
              />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 font-bold text-base">
                {biometricStatus
                  ? getBiometricDisplayName(biometricStatus.biometricType)
                  : "Biometric"}{" "}
                Login
              </Text>
              <Text className="text-gray-600 text-sm">
                {biometricStatus?.isEnabled
                  ? "Enabled - Quick login with biometric"
                  : biometricStatus?.isAvailable
                  ? "Tap to enable quick login"
                  : "Not available on this device"}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              {biometricStatus?.isEnabled && (
                <View className="bg-green-100 px-2 py-1 rounded-full">
                  <Text className="text-green-700 text-xs font-bold">ON</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Enhanced Data Export Section */}
        <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg">
          <View className="flex-row items-center gap-4 mb-6">
            <View className="w-14 h-14 bg-gradient-to-br from-green-100 to-green-200 rounded-full items-center justify-center">
              <Ionicons name="document-text" size={28} color="#16a34a" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 text-xl font-bold">
                PDF Reports
              </Text>
              <Text className="text-gray-600 text-sm mt-1">
                Export transactions as PDF reports
              </Text>
            </View>
          </View>

          <View className="gap-3">
            {/* All Transactions */}
            <TouchableOpacity
              onPress={() => handleExport("all")}
              disabled={exportingType !== null}
              className="flex-row items-center gap-4 bg-green-50 rounded-2xl p-4 active:scale-98"
              style={{ opacity: exportingType !== null ? 0.7 : 1 }}
            >
              <View className="w-12 h-12 bg-green-100 rounded-full items-center justify-center">
                {exportingType === "all" ? (
                  <ActivityIndicator size="small" color="#16a34a" />
                ) : (
                  <Ionicons name="list" size={24} color="#16a34a" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-base">
                  {exportingType === "all"
                    ? "Exporting..."
                    : "All Transactions"}
                </Text>
                <Text className="text-gray-600 text-sm">
                  Complete transaction list
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            {/* By Category */}
            <TouchableOpacity
              onPress={() => handleExport("category")}
              disabled={exportingType !== null}
              className="flex-row items-center gap-4 bg-purple-50 rounded-2xl p-4 active:scale-98"
              style={{ opacity: exportingType !== null ? 0.7 : 1 }}
            >
              <View className="w-12 h-12 bg-purple-100 rounded-full items-center justify-center">
                {exportingType === "category" ? (
                  <ActivityIndicator size="small" color="#8b5cf6" />
                ) : (
                  <Ionicons name="pricetags" size={24} color="#8b5cf6" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-base">
                  {exportingType === "category"
                    ? "Exporting..."
                    : "By Category"}
                </Text>
                <Text className="text-gray-600 text-sm">
                  Grouped by transaction category
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            {/* By Counterparty */}
            <TouchableOpacity
              onPress={() => handleExport("counterparty")}
              disabled={exportingType !== null}
              className="flex-row items-center gap-4 bg-orange-50 rounded-2xl p-4 active:scale-98"
              style={{ opacity: exportingType !== null ? 0.7 : 1 }}
            >
              <View className="w-12 h-12 bg-orange-100 rounded-full items-center justify-center">
                {exportingType === "counterparty" ? (
                  <ActivityIndicator size="small" color="#ea580c" />
                ) : (
                  <Ionicons name="people" size={24} color="#ea580c" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-base">
                  {exportingType === "counterparty"
                    ? "Exporting..."
                    : "By Counterparty"}
                </Text>
                <Text className="text-gray-600 text-sm">
                  Grouped by customer/supplier
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            {/* By Account */}
            <TouchableOpacity
              onPress={() => handleExport("account")}
              disabled={exportingType !== null}
              className="flex-row items-center gap-4 bg-blue-50 rounded-2xl p-4 active:scale-98"
              style={{ opacity: exportingType !== null ? 0.7 : 1 }}
            >
              <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center">
                {exportingType === "account" ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <Ionicons name="wallet" size={24} color="#3b82f6" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-base">
                  {exportingType === "account" ? "Exporting..." : "By Account"}
                </Text>
                <Text className="text-gray-600 text-sm">
                  Grouped by payment account
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Backup & Restore Section */}
        <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg">
          <View className="flex-row items-center gap-4 mb-4">
            <View className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full items-center justify-center">
              <Ionicons name="cloud" size={28} color="#3b82f6" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 text-xl font-bold">
                Backup & Restore
              </Text>
              <Text className="text-gray-600 text-sm mt-1">
                Save or restore your complete data
              </Text>
            </View>
          </View>

          <View className="bg-blue-50 rounded-2xl p-4 mb-4">
            <View className="flex-row items-start gap-3">
              <Ionicons name="information-circle" size={20} color="#3b82f6" />
              <Text className="text-blue-800 text-sm flex-1">
                Backup exports all your accounts, categories, transactions, and
                transfers as a JSON file that you can save and restore later.
              </Text>
            </View>
          </View>

          <View className="gap-3">
            <TouchableOpacity
              onPress={handleBackup}
              disabled={backingUp}
              className="flex-row items-center gap-4 bg-blue-50 rounded-2xl p-4 active:scale-98"
              style={{ opacity: backingUp ? 0.7 : 1 }}
            >
              <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center">
                {backingUp ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <Ionicons name="cloud-upload" size={24} color="#3b82f6" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-base">
                  {backingUp ? "Creating Backup..." : "Create Backup"}
                </Text>
                <Text className="text-gray-600 text-sm">
                  Export all data to JSON file
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRestore}
              disabled={restoring}
              className="flex-row items-center gap-4 bg-amber-50 rounded-2xl p-4 active:scale-98"
              style={{ opacity: restoring ? 0.7 : 1 }}
            >
              <View className="w-12 h-12 bg-amber-100 rounded-full items-center justify-center">
                {restoring ? (
                  <ActivityIndicator size="small" color="#f59e0b" />
                ) : (
                  <Ionicons name="cloud-download" size={24} color="#f59e0b" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-base">
                  {restoring ? "Restoring..." : "Restore Backup"}
                </Text>
                <Text className="text-gray-600 text-sm">
                  Import data from JSON file
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Enhanced App Info Section */}
        <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg">
          <View className="flex-row items-center gap-4 mb-6">
            <View className="w-14 h-14 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full items-center justify-center">
              <Ionicons name="information-circle" size={28} color="#8b5cf6" />
            </View>
            <Text className="text-gray-900 text-xl font-bold">
              App Information
            </Text>
          </View>

          <View className="gap-3">
            {/* <View className="flex-row items-center gap-3 py-2">
              <Ionicons name="server" size={18} color="#6b7280" />
              <View className="flex-1">
                <Text className="text-gray-600 text-sm">API Endpoint</Text>
                <Text className="text-gray-900 text-sm font-mono">
                  {baseURL}
                </Text>
              </View>
            </View> */}

            <View className="flex-row items-center gap-3 py-2">
              <Ionicons name="code-working" size={18} color="#6b7280" />
              <View className="flex-1">
                <Text className="text-gray-600 text-sm">App Version</Text>
                <Text className="text-gray-900 text-sm font-mono">
                  {Constants.expoConfig?.version || "2.0.0"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* App Settings */}
        <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <Text className="text-gray-900 font-bold text-lg mb-4">
            Quick Actions
          </Text>
          <View className="gap-2">
            <ActionButton
              icon="list"
              label="Manage Categories"
              subLabel="Add or edit income & expense categories"
              onPress={() => router.push("/categories")}
              color="#8b5cf6"
              bgColor="bg-purple-50"
            />
          </View>
        </View>

        {/* Business Management Section */}
        <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg">
          <View className="flex-row items-center gap-4 mb-6">
            <View className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-full items-center justify-center">
              <Ionicons name="business" size={28} color="#6366f1" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 text-xl font-bold">
                Business Management
              </Text>
              <Text className="text-gray-600 text-sm mt-1">
                Organizations, parties & invoices
              </Text>
            </View>
          </View>

          <View className="gap-3">
            {/* Organizations */}
            <TouchableOpacity
              onPress={() => router.push("/organizations")}
              className="flex-row items-center gap-4 bg-indigo-50 rounded-2xl p-4 active:scale-98"
            >
              <View className="w-12 h-12 bg-indigo-100 rounded-full items-center justify-center">
                <Ionicons name="business" size={24} color="#6366f1" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-base">
                  Organizations
                </Text>
                <Text className="text-gray-600 text-sm">
                  Manage your businesses & teams
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            {/* Parties */}
            <TouchableOpacity
              onPress={() => router.push("/parties")}
              className="flex-row items-center gap-4 bg-teal-50 rounded-2xl p-4 active:scale-98"
            >
              <View className="w-12 h-12 bg-teal-100 rounded-full items-center justify-center">
                <Ionicons name="people" size={24} color="#14b8a6" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-base">
                  Customers & Suppliers
                </Text>
                <Text className="text-gray-600 text-sm">
                  Manage parties & view ledgers
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            {/* Invoices */}
            <TouchableOpacity
              onPress={() => router.push("/invoices")}
              className="flex-row items-center gap-4 bg-amber-50 rounded-2xl p-4 active:scale-98"
            >
              <View className="w-12 h-12 bg-amber-100 rounded-full items-center justify-center">
                <Ionicons name="receipt" size={24} color="#f59e0b" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-base">
                  Invoices
                </Text>
                <Text className="text-gray-600 text-sm">
                  Sales & purchase invoices
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Enhanced Sign Out Section */}
        <View className="bg-white rounded-3xl p-6 border border-red-100 shadow-lg">
          <ActionButton
            label="Sign Out"
            onPress={signOut}
            variant="danger"
            size="medium"
            icon="log-out-outline"
            fullWidth
          />
        </View>

        {/* Bottom spacing for safe area */}
        <View className="h-10" />
      </ScrollView>

      {/* Profile Edit Modal */}
      <ProfileEditModal
        visible={showProfileModal}
        onClose={handleProfileModalClose}
      />

      {/* Biometric Settings Modal */}
      <BiometricSettingsModal
        visible={showBiometricModal}
        onClose={() => setShowBiometricModal(false)}
        userEmail={
          state.status === "authenticated" ? state.user.email : undefined
        }
      />
    </View>
  );
}
