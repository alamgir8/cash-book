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
    <View
      className="rounded-3xl p-6 border shadow-sm gap-4"
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
      }}
    >
      {/* Section Header */}
      <View className="flex-row items-center gap-3 mb-2">
        <View
          className="p-3 rounded-full"
          style={{ backgroundColor: `${colors.primary}15` }}
        >
          <Ionicons name="eye-outline" size={20} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text
            className="text-lg font-semibold"
            style={{ color: colors.text.primary }}
          >
            Appearance
          </Text>
          <Text
            className="text-sm mt-1"
            style={{ color: colors.text.secondary }}
          >
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
            className={`flex-row items-center gap-3 p-4 rounded-2xl border`}
            style={{
              backgroundColor:
                colorScheme === option.value
                  ? colors.info + "15"
                  : colors.bg.tertiary,
              borderColor:
                colorScheme === option.value
                  ? colors.info + "60"
                  : colors.border,
            }}
          >
            {/* Icon */}
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{
                backgroundColor:
                  colorScheme === option.value
                    ? colors.info
                    : colors.bg.primary,
              }}
            >
              <Ionicons
                name={option.icon as any}
                size={20}
                color={
                  colorScheme === option.value ? "white" : colors.text.tertiary
                }
              />
            </View>

            {/* Label */}
            <View className="flex-1">
              <Text
                className="font-semibold"
                style={{
                  color:
                    colorScheme === option.value
                      ? colors.info
                      : colors.text.primary,
                }}
              >
                {option.label}
              </Text>
            </View>

            {/* Radio Button */}
            {colorScheme === option.value && (
              <View
                className="w-5 h-5 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.info }}
              >
                <Ionicons name="checkmark" size={14} color="white" />
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Current Theme Info */}
      <View
        className="p-3 rounded-xl mt-2"
        style={{ backgroundColor: colors.bg.tertiary }}
      >
        <Text
          className="text-xs font-medium"
          style={{ color: colors.text.secondary }}
        >
          {colorScheme === "system"
            ? `Currently using ${isDark ? "Dark" : "Light"} Mode (from system settings)`
            : `Theme: ${colorScheme === "light" ? "Light" : "Dark"} Mode`}
        </Text>
      </View>
    </View>
  );
}
