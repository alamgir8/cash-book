import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
} from "react-native";
import { useTheme } from "../hooks/useTheme";

interface CustomButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  variant?: "primary" | "secondary" | "outline";
  size?: "small" | "medium" | "large";
  containerClassName?: string;
  textClassName?: string;
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  title,
  loading = false,
  variant = "primary",
  size = "medium",
  containerClassName = "",
  textClassName = "",
  disabled,
  ...props
}) => {
  const { colors } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return {
          backgroundColor: colors.info,
          shadowColor: colors.info,
          shadowOpacity: 0.3,
        };
      case "secondary":
        return {
          backgroundColor: colors.bg.tertiary,
          shadowColor: "#000",
          shadowOpacity: 0.1,
        };
      case "outline":
        return {
          backgroundColor: "transparent",
          borderWidth: 2,
          borderColor: colors.info,
        };
      default:
        return {
          backgroundColor: colors.info,
          shadowColor: colors.info,
          shadowOpacity: 0.3,
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case "small":
        return "py-2 px-4";
      case "medium":
        return "py-4 px-6";
      case "large":
        return "py-5 px-8";
      default:
        return "py-4 px-6";
    }
  };

  const getTextColor = () => {
    if (variant === "outline") {
      return colors.info;
    }
    if (variant === "secondary") {
      return colors.text.primary;
    }
    return "white";
  };

  const getSizeTextStyles = () => {
    return size === "small"
      ? "text-sm"
      : size === "large"
        ? "text-xl"
        : "text-base";
  };

  const isDisabled = disabled || loading;

  const variantStyles = getVariantStyles();

  return (
    <TouchableOpacity
      style={{
        ...variantStyles,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 3,
        opacity: isDisabled ? 0.5 : 1,
      }}
      className={`rounded-2xl items-center justify-center ${getSizeStyles()} ${containerClassName}`}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <Text
          style={{ color: getTextColor() }}
          className={`font-semibold text-center ${getSizeTextStyles()} ${textClassName}`}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};
