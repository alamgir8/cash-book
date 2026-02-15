import { View, ViewProps } from "react-native";
import { useTheme } from "@/hooks/useTheme";

/**
 * ThemedText - A wrapper for text that respects theme
 */
import { Text, TextProps } from "react-native";

interface ThemedScreenProps extends ViewProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "tertiary";
}

/**
 * ThemedScreen - A wrapper component that applies theme-aware styling to screens
 * Automatically handles light/dark mode background and text colors
 */
export function ThemedScreen({
  children,
  variant = "primary",
  style,
  ...props
}: ThemedScreenProps) {
  const { colors, isDark } = useTheme();

  const bgColor =
    variant === "primary"
      ? colors.bg.primary
      : variant === "secondary"
        ? colors.bg.secondary
        : colors.bg.tertiary;

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: bgColor,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

/**
 * ThemedCard - A wrapper for cards that respects theme
 */
export function ThemedCard({
  children,
  style,
  ...props
}: ViewProps & { children: React.ReactNode }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          borderWidth: 1,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

type ThemedTextVariant = "primary" | "secondary" | "tertiary" | "inverse";

interface ThemedTextProps extends TextProps {
  children: React.ReactNode;
  variant?: ThemedTextVariant;
}

export function ThemedText({
  children,
  variant = "primary",
  style,
  ...props
}: ThemedTextProps) {
  const { colors } = useTheme();

  const textColor =
    variant === "primary"
      ? colors.text.primary
      : variant === "secondary"
        ? colors.text.secondary
        : variant === "tertiary"
          ? colors.text.tertiary
          : colors.text.inverse;

  return (
    <Text
      style={[
        {
          color: textColor,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
}
