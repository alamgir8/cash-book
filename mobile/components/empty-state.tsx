import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface EmptyStateProps {
  isLoading?: boolean;
  loadingText?: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionButton?: {
    label: string;
    onPress: () => void;
  };
  iconColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
}

export function EmptyState({
  isLoading = false,
  loadingText = "Loading...",
  icon,
  title,
  description,
  actionButton,
  iconColor = "#1d4ed8",
  gradientFrom = "from-blue-100",
  gradientTo = "to-blue-200",
}: EmptyStateProps) {
  if (isLoading) {
    return (
      <View className="items-center mt-12">
        <ActivityIndicator color={iconColor} size="large" />
        <Text className="text-gray-500 mt-4 text-base">{loadingText}</Text>
      </View>
    );
  }

  return (
    <View className="items-center mt-12 gap-4 bg-white rounded-3xl p-8 mx-2 shadow-sm border border-gray-100">
      <View
        className={`w-20 h-20 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-full items-center justify-center`}
      >
        <Ionicons name={icon} size={36} color={iconColor} />
      </View>
      <Text className="text-gray-800 text-xl font-bold">{title}</Text>
      <Text className="text-gray-600 text-center text-base leading-relaxed">
        {description}
      </Text>
      {actionButton && (
        <TouchableOpacity
          onPress={actionButton.onPress}
          className="px-6 py-3 rounded-full mt-2"
          style={{ backgroundColor: iconColor }}
        >
          <Text className="text-white font-bold text-base">
            {actionButton.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
