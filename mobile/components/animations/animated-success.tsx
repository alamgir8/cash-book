import { useEffect } from "react";
import { Animated, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

interface AnimatedSuccessProps {
  message: string;
  duration?: number;
}

export function AnimatedSuccess({
  message,
  duration = 3000,
}: AnimatedSuccessProps) {
  const { colors } = useTheme();
  const scaleAnim = new Animated.Value(0.3);
  const opacityAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(duration - 500),
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [scaleAnim, opacityAnim, duration]);

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        opacity: opacityAnim,
      }}
    >
      <View
        className="flex-row items-center gap-3 rounded-lg p-4"
        style={{
          backgroundColor: `${colors.success}20`,
          borderColor: colors.success,
          borderWidth: 1,
        }}
      >
        <Ionicons name="checkmark-circle" size={24} color={colors.success} />
        <Text
          style={{ color: colors.success }}
          className="font-semibold flex-1"
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}
