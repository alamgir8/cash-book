import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useAuth } from "../../hooks/useAuth";
import { baseURL } from "../../lib/api";
import { exportTransactionsPdf } from "../../services/reports";
import { ScreenHeader } from "../../components/screen-header";
import { ActionButton } from "../../components/action-button";

export default function SettingsScreen() {
  const { state, signOut, refreshProfile } = useAuth();
  const [exporting, setExporting] = useState(false);

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

          <TouchableOpacity
            onPress={refreshProfile}
            className="flex-row gap-2 items-center justify-center bg-blue-50 rounded-2xl py-4 mt-4 active:scale-95"
          >
            <Ionicons name="refresh" size={20} color="#1d4ed8" />
            <Text className="text-blue-700 font-bold text-base">
              Refresh Profile
            </Text>
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
                Data Export
              </Text>
              <Text className="text-gray-600 text-base mt-1">
                Export complete PDF report of all transactions
              </Text>
            </View>
          </View>

          <ActionButton
            label={exporting ? "Exporting..." : "Export All as PDF"}
            onPress={handleExport}
            isLoading={exporting}
            variant="success"
            size="large"
            icon={exporting ? "download" : "cloud-download"}
            fullWidth
          />
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
            <View className="flex-row items-center gap-3 py-2">
              <Ionicons name="server" size={18} color="#6b7280" />
              <View className="flex-1">
                <Text className="text-gray-600 text-sm">API Endpoint</Text>
                <Text className="text-gray-900 text-sm font-mono">
                  {baseURL}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-3 py-2">
              <Ionicons name="code-working" size={18} color="#6b7280" />
              <View className="flex-1">
                <Text className="text-gray-600 text-sm">App Version</Text>
                <Text className="text-gray-900 text-sm font-mono">
                  {Constants.expoConfig?.version || "1.0.0"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Enhanced Sign Out Section */}
        <View className="bg-white rounded-3xl p-6 border border-red-100 shadow-lg">
          <ActionButton
            label="Sign Out"
            onPress={signOut}
            variant="danger"
            size="large"
            icon="log-out-outline"
            fullWidth
          />
        </View>

        {/* Bottom spacing for safe area */}
        <View className="h-10" />
      </ScrollView>
    </View>
  );
}
