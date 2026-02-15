import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

export interface ErrorMessageProps {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  isDismissible?: boolean;
  onDismiss?: () => void;
}

const errorTypeHints: Record<
  string,
  { icon: string; title: string; suggestion: string }
> = {
  "Network error": {
    icon: "wifi-outline",
    title: "Connection Error",
    suggestion: "Check your internet connection and try again",
  },
  Unauthorized: {
    icon: "lock-closed-outline",
    title: "Authentication Failed",
    suggestion: "Your session may have expired. Please sign in again",
  },
  "Validation error": {
    icon: "alert-circle-outline",
    title: "Invalid Input",
    suggestion: "Please check your entries and try again",
  },
  "Server error": {
    icon: "cloud-offline-outline",
    title: "Server Error",
    suggestion: "Something went wrong on our end. Please try again later",
  },
  "Not found": {
    icon: "search-outline",
    title: "Not Found",
    suggestion: "The requested resource could not be found",
  },
};

export function ErrorMessage({
  title,
  message,
  actionLabel,
  onAction,
  isDismissible = true,
  onDismiss,
}: ErrorMessageProps) {
  const { colors } = useTheme();

  // Find matching error type hint
  const hint = Object.values(errorTypeHints).find(
    (h) => h.title.toLowerCase() === title.toLowerCase(),
  );

  const icon = hint?.icon || "alert-circle-outline";
  const displayTitle = hint?.title || title;
  const suggestion = hint?.suggestion || message;

  return (
    <View
      className="rounded-xl border-l-4 p-4 gap-3"
      style={{
        backgroundColor: `${colors.error}10`,
        borderLeftColor: colors.error,
      }}
    >
      {/* Header with icon and title */}
      <View className="flex-row items-center gap-3">
        <View
          style={{ backgroundColor: `${colors.error}20` }}
          className="p-2 rounded-full"
        >
          <Ionicons name={icon as any} size={20} color={colors.error} />
        </View>
        <Text
          style={{ color: colors.error }}
          className="font-bold text-base flex-1"
        >
          {displayTitle}
        </Text>
        {isDismissible && (
          <Pressable onPress={onDismiss}>
            <Ionicons name="close" size={20} color={colors.error} />
          </Pressable>
        )}
      </View>

      {/* Message/Suggestion */}
      {suggestion && (
        <Text
          style={{ color: colors.text.secondary }}
          className="text-sm leading-5"
        >
          {suggestion}
        </Text>
      )}

      {/* Action button */}
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          className="flex-row items-center gap-2 rounded-lg py-2 px-3 self-start"
          style={{ backgroundColor: `${colors.error}20` }}
        >
          <Text style={{ color: colors.error }} className="font-semibold">
            {actionLabel}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={colors.error} />
        </Pressable>
      )}
    </View>
  );
}
