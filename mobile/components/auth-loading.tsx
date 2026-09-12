import { ActivityIndicator, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const AuthLoading = ({ message }: { message?: string }) => {
  return (
    <View className="flex-1 bg-white items-center justify-center px-8">
      <View className="items-center gap-6">
        <View className="w-20 h-20 bg-blue-500 rounded-2xl items-center justify-center shadow-lg">
          <Ionicons name="wallet" size={40} color="white" />
        </View>

        <Text className="text-2xl font-bold text-gray-800">Cash Book</Text>

        <View className="items-center gap-2">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="text-gray-500 text-sm text-center">
            {message || "Loading..."}
          </Text>
        </View>
      </View>
    </View>
  );
};
