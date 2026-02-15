import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "success" | "danger" | "outline";
  size?: "small" | "medium" | "large";
  icon?: keyof typeof Ionicons.glyphMap;
  isLoading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  subLabel?: string;
  color?: string;
  bgColor?: string;
}

export function ActionButton({
  label,
  onPress,
  variant = "primary",
  size = "small",
  icon,
  isLoading = false,
  disabled = false,
  fullWidth = false,
  subLabel,
  color,
  bgColor,
}: ActionButtonProps) {
  const { colors } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return {
          backgroundColor: colors.info,
          textColor: "#ffffff",
          iconColor: "#ffffff",
          borderColor: "transparent",
          shadowColor: colors.info,
        };
      case "success":
        return {
          backgroundColor: colors.success,
          textColor: "#ffffff",
          iconColor: "#ffffff",
          borderColor: "transparent",
          shadowColor: colors.success,
        };
      case "danger":
        return {
          backgroundColor: colors.error,
          textColor: "#ffffff",
          iconColor: "#ffffff",
          borderColor: "transparent",
          shadowColor: colors.error,
        };
      case "secondary":
        return {
          backgroundColor: colors.bg.tertiary,
          textColor: colors.text.primary,
          iconColor: colors.text.primary,
          borderColor: colors.border,
          shadowColor: colors.border,
        };
      case "outline":
        return {
          backgroundColor: "transparent",
          textColor: colors.info,
          iconColor: colors.info,
          borderColor: colors.info,
          shadowColor: "transparent",
        };
      default:
        return {
          backgroundColor: colors.info,
          textColor: "#ffffff",
          iconColor: "#ffffff",
          borderColor: "transparent",
          shadowColor: colors.info,
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case "small":
        return "px-4 py-2 rounded-xl";
      case "medium":
        return "px-6 py-3 rounded-2xl";
      case "large":
        return "px-8 py-4 rounded-2xl";
      default:
        return "px-6 py-3 rounded-2xl";
    }
  };

  const getTextStyles = () => {
    const baseStyle = "font-bold";
    const sizeStyle =
      size === "small" ? "text-sm" : size === "large" ? "text-lg" : "text-base";
    return `${baseStyle} ${sizeStyle}`;
  };

  const getIconSize = () => {
    switch (size) {
      case "small":
        return 16;
      case "large":
        return 24;
      default:
        return 20;
    }
  };

  // Handle custom color/bgColor styling
  if (color || bgColor) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || isLoading}
        className={`${getSizeStyles()} ${
          fullWidth ? "w-full" : ""
        } flex-row items-center gap-3 p-4 rounded-2xl active:scale-95 ${
          disabled ? "opacity-50" : ""
        }`}
        style={{
          backgroundColor: bgColor || colors.bg.tertiary,
          borderColor: colors.border,
          borderWidth: 1,
        }}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={24}
            color={color || colors.text.primary}
          />
        )}
        <View className="flex-1">
          <Text
            className="font-semibold"
            style={{ color: color || colors.text.primary }}
          >
            {label}
          </Text>
          {subLabel && (
            <Text
              className="text-sm mt-0.5"
              style={{ color: colors.text.secondary }}
            >
              {subLabel}
            </Text>
          )}
        </View>
        {isLoading && (
          <ActivityIndicator color={color || colors.text.primary} />
        )}
      </TouchableOpacity>
    );
  }

  const variantStyles = getVariantStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      className={`
        ${getSizeStyles()} 
        ${fullWidth ? "w-full" : ""} 
        items-center justify-center mb-10
        ${variant === "outline" ? "border-2" : ""}
        ${variant !== "outline" ? "shadow-lg" : ""} active:scale-95
        ${disabled ? "opacity-50" : ""}
      `}
      style={{
        backgroundColor: variantStyles.backgroundColor,
        borderColor: variantStyles.borderColor,
        shadowColor: variantStyles.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
      }}
    >
      {isLoading ? (
        <ActivityIndicator color={variantStyles.iconColor} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon && (
            <Ionicons
              name={icon}
              size={getIconSize()}
              color={variantStyles.iconColor}
            />
          )}
          <Text
            className={getTextStyles()}
            style={{ color: variantStyles.textColor }}
          >
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
