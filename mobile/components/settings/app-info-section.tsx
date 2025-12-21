import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";

export function AppInfoSection() {
  return (
    <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg">
      <View className="flex-row items-center gap-4 mb-6">
        <View className="w-14 h-14 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full items-center justify-center">
          <Ionicons name="information-circle" size={28} color="#8b5cf6" />
        </View>
        <Text className="text-gray-900 text-xl font-bold">App Information</Text>
      </View>

      <View className="gap-3">
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
  );
}
