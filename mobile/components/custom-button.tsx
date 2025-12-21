import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
} from "react-native";

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
  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return "bg-blue-600 shadow-lg";
      case "secondary":
        return "bg-slate-600";
      case "outline":
        return "bg-transparent border-2 border-blue-600";
      default:
        return "bg-blue-600 shadow-lg";
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

  const getTextStyles = () => {
    const baseStyles = "font-semibold text-center";
    const sizeStyles =
      size === "small" ? "text-sm" : size === "large" ? "text-xl" : "text-base";
    const colorStyles = variant === "outline" ? "text-blue-600" : "text-white";
    return `${baseStyles} ${sizeStyles} ${colorStyles}`;
  };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      className={`rounded-2xl items-center justify-center ${getVariantStyles()} ${getSizeStyles()} ${
        isDisabled ? "opacity-50" : ""
      } ${containerClassName}`}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "outline" ? "#2563eb" : "#ffffff"}
          size="small"
        />
      ) : (
        <Text className={`${getTextStyles()} ${textClassName}`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};
