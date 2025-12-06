import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return "bg-blue-600";
      case "success":
        return "bg-green-600";
      case "danger":
        return "bg-red-600";
      case "secondary":
        return "bg-gray-600";
      case "outline":
        return "bg-gray-50 border-2 border-blue-600";
      default:
        return "bg-blue-600";
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
    const colorStyle = variant === "outline" ? "text-blue-600" : "text-white";
    return `${baseStyle} ${sizeStyle} ${colorStyle}`;
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
        className={`${bgColor || "bg-gray-50"} ${getSizeStyles()} ${
          fullWidth ? "w-full" : ""
        } flex-row items-center gap-3 p-4 rounded-2xl active:scale-95 ${
          disabled ? "opacity-50" : ""
        }`}
      >
        {icon && <Ionicons name={icon} size={24} color={color || "#6b7280"} />}
        <View className="flex-1">
          <Text className="font-semibold text-gray-900">{label}</Text>
          {subLabel && (
            <Text className="text-sm text-gray-500 mt-0.5">{subLabel}</Text>
          )}
        </View>
        {isLoading && <ActivityIndicator color={color || "#6b7280"} />}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      className={`
        ${getVariantStyles()} 
        ${getSizeStyles()} 
        ${fullWidth ? "w-full" : ""} 
        items-center justify-center mb-10
        shadow-lg active:scale-95
        ${disabled ? "opacity-50" : ""}
      `}
      style={{
        shadowColor:
          variant === "success"
            ? "#16a34a"
            : variant === "danger"
            ? "#dc2626"
            : "#1d4ed8",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
      }}
    >
      {isLoading ? (
        <ActivityIndicator
          color={variant === "outline" ? "#1d4ed8" : "#ffffff"}
        />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon && (
            <Ionicons
              name={icon}
              size={getIconSize()}
              color={variant === "outline" ? "#1d4ed8" : "white"}
            />
          )}
          <Text className={getTextStyles()}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
