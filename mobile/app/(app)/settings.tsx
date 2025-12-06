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
import { exportTransactionsPdf } from "../../services/reports";
import {
  exportBackupToFile,
  importBackupFromFile,
} from "../../services/backup";
import { ScreenHeader } from "../../components/screen-header";
import { ActionButton } from "../../components/action-button";
import { ProfileEditModal } from "../../components/profile-edit-modal";
import { queryKeys } from "../../lib/queryKeys";

export default function SettingsScreen() {
  const { state, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportTransactionsPdf({});
      Toast.show({ type: "success", text1: "Full report exported" });
    } catch (error) {
      console.error(error);
      Toast.show({ type: "error", text1: "Failed to export full report" });
    } finally {
      setExporting(false);
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
      console.error(error);
      Toast.show({
        type: "error",
        text1: "Failed to create backup",
        text2: error?.message || "Please try again",
      });
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async () => {
    Alert.alert(
      "Restore Backup",
      "This will import data from a backup file. Existing data will NOT be deleted, but duplicate categories will be skipped. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Select File",
          onPress: async () => {
            try {
              setRestoring(true);
              const result = await importBackupFromFile();
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
              Toast.show({
                type: "success",
                text1: "Backup restored successfully",
                text2: `Imported ${result.summary.accountsImported} accounts, ${result.summary.transactionsImported} transactions`,
                visibilityTime: 4000,
              });
            } catch (error: any) {
              console.error(error);
              const message =
                error?.response?.data?.message ||
                error?.message ||
                "Please try again";
              Toast.show({
                type: "error",
                text1: "Failed to restore backup",
                text2: message,
                visibilityTime: 4000,
              });
            } finally {
              setRestoring(false);
            }
          },
        },
      ]
    );
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
                Export transactions as PDF report
              </Text>
            </View>
          </View>

          <ActionButton
            label={exporting ? "Exporting..." : "Export PDF Report"}
            onPress={handleExport}
            isLoading={exporting}
            variant="success"
            size="medium"
            icon={exporting ? "download" : "cloud-download"}
            fullWidth
          />
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
    </View>
  );
}
