import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/hooks/useTheme";

type AccountEmptyStateProps = {
  isLoading: boolean;
};

export function AccountEmptyState({ isLoading }: AccountEmptyStateProps) {
  const router = useRouter();
  const { colors } = useTheme();

  if (isLoading) {
    return <ActivityIndicator color={colors.info} style={{ marginTop: 48 }} />;
  }

  return (
    <View
      className="items-center gap-3 rounded-2xl p-6 border mt-6"
      style={{ backgroundColor: colors.card, borderColor: colors.border }}
    >
      <Ionicons
        name="document-text-outline"
        size={36}
        color={colors.text.tertiary}
      />
      <Text className="font-semibold" style={{ color: colors.text.primary }}>
        No transactions matching filters
      </Text>
      <Text
        className="text-sm text-center"
        style={{ color: colors.text.secondary }}
      >
        Adjust the filters or record a new transaction from the dashboard.
      </Text>
      <TouchableOpacity
        onPress={() => router.push("/(app)")}
        className="px-4 py-2 rounded-full"
        style={{ backgroundColor: colors.info }}
      >
        <Text className="text-white font-semibold text-sm">
          Go to Dashboard
        </Text>
      </TouchableOpacity>
    </View>
  );
}
