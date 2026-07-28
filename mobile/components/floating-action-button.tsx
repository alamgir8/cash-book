import { TouchableOpacity, StyleSheet, View } from "react-native";
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
  const dim = size === "large" ? 80 : 64;
  const iconSize = size === "large" ? 36 : 32;

  const positionStyle =
    position === "bottom-left"
      ? styles.bottomLeft
      : position === "bottom-center"
        ? styles.bottomCenter
        : styles.bottomRight;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[
          styles.button,
          positionStyle,
          {
            width: dim,
            height: dim,
            borderRadius: 18,
            backgroundColor: bgColor,
            shadowColor: bgColor,
          },
        ]}
      >
        <Ionicons name={icon} size={iconSize} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  bottomRight: { right: 24, bottom: 128 },
  bottomLeft: { left: 24, bottom: 128 },
  bottomCenter: { alignSelf: "center", bottom: 128 },
});
