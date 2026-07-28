import { TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/use-theme";

interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: "blue" | "green" | "red" | "purple";
  position?: "bottom-right" | "bottom-left" | "bottom-center";
  size?: "medium" | "large";
  visible?: boolean;
}

export function FloatingActionButton({
  onPress,
  icon = "add",
  color = "blue",
  position = "bottom-right",
  size = "medium",
  visible = true,
}: FloatingActionButtonProps) {
  const { colors } = useTheme();

  if (!visible) return null;

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

  const bgColor = getColorValue();
  const dim = size === "large" ? 64 : 56;
  const iconSize = size === "large" ? 30 : 28;

  const positionStyle =
    position === "bottom-left"
      ? styles.bottomLeft
      : position === "bottom-center"
        ? styles.bottomCenter
        : styles.bottomRight;

  // No absoluteFill wrapper — that leaked over other tab screens while Home stayed mounted.
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      style={[
        styles.button,
        positionStyle,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: bgColor,
          shadowColor: bgColor,
        },
      ]}
    >
      <Ionicons name={icon} size={iconSize} color="white" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 20,
  },
  bottomRight: { right: 20, bottom: 24 },
  bottomLeft: { left: 20, bottom: 24 },
  bottomCenter: { alignSelf: "center", bottom: 24 },
});
