import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type AccountEmptyStateProps = {
  isLoading: boolean;
};

export function AccountEmptyState({ isLoading }: AccountEmptyStateProps) {
  const router = useRouter();

  if (isLoading) {
    return <ActivityIndicator color="#3b82f6" style={{ marginTop: 48 }} />;
  }

  return (
    <View className="items-center gap-3 bg-white rounded-2xl p-6 border border-gray-100 mt-6">
      <Ionicons name="document-text-outline" size={36} color="#94a3b8" />
      <Text className="text-gray-700 font-semibold">
        No transactions matching filters
      </Text>
      <Text className="text-gray-500 text-sm text-center">
        Adjust the filters or record a new transaction from the dashboard.
      </Text>
      <TouchableOpacity
        onPress={() => router.push("/(app)")}
        className="px-4 py-2 rounded-full bg-blue-500 active:opacity-90"
      >
        <Text className="text-white font-semibold text-sm">
          Go to Dashboard
        </Text>
      </TouchableOpacity>
    </View>
  );
}
