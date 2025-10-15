import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  backgroundColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  actionButton?: {
    label: string;
    onPress: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
    color?: string;
  };
}

export function ScreenHeader({
  title,
  subtitle,
  icon,
  iconColor = "#1d4ed8",
  backgroundColor = "#ffffff",
  actionButton,
}: ScreenHeaderProps) {
  return (
    <View
      className="pt-6 pb-6 px-6 shadow-sm border-b border-gray-100"
      style={{ backgroundColor }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-900">{title}</Text>
          {subtitle && (
            <Text className="text-sm text-gray-600 mt-1">{subtitle}</Text>
          )}
        </View>

        {icon && !actionButton && (
          <View className="bg-blue-100 p-3 rounded-full">
            <Ionicons name={icon} size={24} color={iconColor} />
          </View>
        )}

        {actionButton && (
          <TouchableOpacity
            onPress={actionButton.onPress}
            className={`px-5 py-3 rounded-xl bg-emerald-500 shadow-lg ${
              actionButton.color === "green"
                ? "bg-gradient-to-r from-green-600 to-green-700"
                : "bg-gradient-to-r from-blue-600 to-blue-700"
            }`}
            style={{
              shadowColor:
                actionButton.color === "green" ? "#16a34a" : "#1d4ed8",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <View className="flex-row items-center gap-2">
              {actionButton.icon && (
                <Ionicons name={actionButton.icon} size={20} color="white" />
              )}
              <Text className="text-white font-bold text-base">
                {actionButton.label}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
