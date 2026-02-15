import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useTheme } from "@/hooks/useTheme";

export function AppInfoSection() {
  const { colors } = useTheme();

  return (
    <View
      className="rounded-3xl p-6 border shadow-lg"
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center gap-4 mb-6">
        <View
          className="w-14 h-14 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.info + "15" }}
        >
          <Ionicons name="information-circle" size={28} color={colors.info} />
        </View>
        <Text
          className="text-xl font-bold"
          style={{ color: colors.text.primary }}
        >
          App Information
        </Text>
      </View>

      <View className="gap-3">
        <View className="flex-row items-center gap-3 py-2">
          <Ionicons
            name="code-working"
            size={18}
            color={colors.text.secondary}
          />
          <View className="flex-1">
            <Text className="text-sm" style={{ color: colors.text.secondary }}>
              App Version
            </Text>
            <Text
              className="text-sm font-mono"
              style={{ color: colors.text.primary }}
            >
              {Constants.expoConfig?.version || "2.0.0"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
