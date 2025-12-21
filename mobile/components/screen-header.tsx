import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  backgroundColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  showBack?: boolean;
  goBack?: boolean;
  rightAction?: React.ReactNode;
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
  goBack = false,
  iconColor = "#1d4ed8",
  backgroundColor = "#ffffff",
  showBack,
  rightAction,
  actionButton,
}: ScreenHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    console.log("handleBack", router, "goBack", goBack);

    if (router.canGoBack() || goBack) {
      router.back();
    } else {
      router.push("/(app)");
    }
  };

  return (
    <View
      className="pb-3 pt-4 px-5 shadow-sm border-b border-gray-100"
      style={{ backgroundColor }}
    >
      <View className="flex-row items-center justify-between">
        {showBack && (
          <TouchableOpacity className="mr-3 p-1" onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
        )}

        <View className="flex-1">
          <Text className="text-xl font-bold text-gray-900">{title}</Text>
          {subtitle && (
            <Text className="text-sm text-gray-600 mt-1">{subtitle}</Text>
          )}
        </View>

        {icon && !actionButton && !rightAction && (
          <View className="bg-blue-100 p-3 rounded-full">
            <Ionicons name={icon} size={24} color={iconColor} />
          </View>
        )}

        {rightAction}

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
