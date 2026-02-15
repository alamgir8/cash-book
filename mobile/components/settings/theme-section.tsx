import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

type ColorScheme = "light" | "dark" | "system";

export function ThemeSection() {
  const { colorScheme, setColorScheme, isDark, colors } = useTheme();

  const themeOptions: {
    value: ColorScheme;
    label: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
  }[] = [
    { value: "light", label: "Light Mode", icon: "sunny-outline" },
    { value: "dark", label: "Dark Mode", icon: "moon-outline" },
    {
      value: "system",
      label: "System Default",
      icon: "phone-portrait-outline",
    },
  ];

  return (
    <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm gap-4">
      {/* Section Header */}
      <View className="flex-row items-center gap-3 mb-2">
        <View
          className="p-3 rounded-full"
          style={{ backgroundColor: `${colors.primary}15` }}
        >
          <Ionicons name="eye-outline" size={20} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900">
            Appearance
          </Text>
          <Text className="text-sm text-gray-500 mt-1">
            Choose your preferred theme
          </Text>
        </View>
      </View>

      {/* Theme Options */}
      <View className="gap-3 mt-2">
        {themeOptions.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setColorScheme(option.value)}
            className={`flex-row items-center gap-3 p-4 rounded-2xl border ${
              colorScheme === option.value
                ? "bg-blue-50 border-blue-300"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            {/* Icon */}
            <View
              className={`w-10 h-10 rounded-full items-center justify-center ${
                colorScheme === option.value
                  ? "bg-blue-500"
                  : isDark
                    ? "bg-gray-700"
                    : "bg-gray-200"
              }`}
            >
              <Ionicons
                name={option.icon as any}
                size={20}
                color={colorScheme === option.value ? "white" : "#666"}
              />
            </View>

            {/* Label */}
            <View className="flex-1">
              <Text
                className={`font-semibold ${
                  colorScheme === option.value
                    ? "text-blue-600"
                    : isDark
                      ? "text-gray-100"
                      : "text-gray-700"
                }`}
              >
                {option.label}
              </Text>
            </View>

            {/* Radio Button */}
            {colorScheme === option.value && (
              <View className="w-5 h-5 rounded-full bg-blue-500 items-center justify-center">
                <Ionicons name="checkmark" size={14} color="white" />
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Current Theme Info */}
      <View
        className={`p-3 rounded-xl mt-2 ${
          isDark ? "bg-gray-800" : "bg-gray-100"
        }`}
      >
        <Text
          className={`text-xs font-medium ${
            isDark ? "text-gray-400" : "text-gray-600"
          }`}
        >
          {colorScheme === "system"
            ? `Currently using ${isDark ? "Dark" : "Light"} Mode (from system settings)`
            : `Theme: ${colorScheme === "light" ? "Light" : "Dark"} Mode`}
        </Text>
      </View>
    </View>
  );
}
