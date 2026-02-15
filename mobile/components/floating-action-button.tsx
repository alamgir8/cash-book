import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";

interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: "blue" | "green" | "red" | "purple";
  position?: "bottom-right" | "bottom-left" | "bottom-center";
  size?: "medium" | "large";
}

export function FloatingActionButton({
  onPress,
  icon = "add",
  color = "blue",
  position = "bottom-right",
  size = "medium",
}: FloatingActionButtonProps) {
  const { colors } = useTheme();

  const getColorValue = () => {
    switch (color) {
      case "green":
        return colors.success;
      case "red":
        return colors.error;
      case "purple":
        return colors.warning;
      default:
        return colors.info;
    }
  };

  const getPositionStyles = () => {
    switch (position) {
      case "bottom-left":
        return "absolute left-6 bottom-32";
      case "bottom-center":
        return "absolute left-1/2 bottom-32 -translate-x-1/2";
      default:
        return "absolute right-6 bottom-32";
    }
  };

  const getSizeStyles = () => {
    return size === "large" ? "w-20 h-20" : "w-16 h-16";
  };

  const getIconSize = () => {
    return size === "large" ? 36 : 32;
  };

  const bgColor = getColorValue();

  return (
    <TouchableOpacity
      onPress={onPress}
      className={`
        ${getPositionStyles()} 
        ${getSizeStyles()} 
        rounded-2xl items-center justify-center shadow-xl border-2 border-white
        active:scale-95
      `}
      style={{
        backgroundColor: bgColor,
        shadowColor: bgColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 12,
      }}
    >
      <Ionicons name={icon} size={getIconSize()} color="white" />
    </TouchableOpacity>
  );
}
