import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../hooks/useTheme";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  backgroundColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  showBack?: boolean;
  onBack?: () => void;
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
  iconColor = "#1d4ed8",
  backgroundColor = "#ffffff",
  showBack,
  onBack,
  rightAction,
  actionButton,
}: ScreenHeaderProps) {
  const router = useRouter();
  const { colors } = useTheme();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View
      style={{
        backgroundColor:
          backgroundColor === "#ffffff" ? colors.bg.primary : backgroundColor,
        borderColor: colors.border,
      }}
      className="pb-3 pt-4 px-5 shadow-sm border-b"
    >
      <View className="flex-row items-center justify-between">
        {showBack && (
          <TouchableOpacity className="mr-3 p-1" onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        )}

        <View className="flex-1">
          <Text
            style={{ color: colors.text.primary }}
            className="text-xl font-bold"
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={{ color: colors.text.secondary }}
              className="text-sm mt-1"
            >
              {subtitle}
            </Text>
          )}
        </View>

        {icon && !actionButton && !rightAction && (
          <View
            style={{ backgroundColor: colors.info + "25" }}
            className="p-3 rounded-full"
          >
            <Ionicons name={icon} size={24} color={iconColor} />
          </View>
        )}

        {rightAction}

        {actionButton && (
          <TouchableOpacity
            onPress={actionButton.onPress}
            className="px-5 py-3 rounded-xl shadow-lg"
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
