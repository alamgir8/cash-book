import { useEffect } from "react";
import { Animated, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

interface AnimatedErrorProps {
  message: string;
  description?: string;
  onDismiss?: () => void;
  duration?: number;
  isDismissible?: boolean;
}

export function AnimatedError({
  message,
  description,
  onDismiss,
  duration = 4000,
  isDismissible = true,
}: AnimatedErrorProps) {
  const { colors } = useTheme();
  const translateAnim = new Animated.Value(-100);
  const opacityAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(translateAnim, {
          toValue: 0,
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
        Animated.timing(translateAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onDismiss?.();
    });
  }, [translateAnim, opacityAnim, duration, onDismiss]);

  return (
    <Animated.View
      style={{
        transform: [{ translateY: translateAnim }],
        opacity: opacityAnim,
      }}
    >
      <View
        className="flex-row items-center justify-between gap-3 rounded-lg p-4 mb-4"
        style={{
          backgroundColor: `${colors.error}20`,
          borderColor: colors.error,
          borderWidth: 1,
        }}
      >
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Ionicons name="close-circle" size={20} color={colors.error} />
            <Text
              style={{ color: colors.error }}
              className="font-semibold flex-1"
            >
              {message}
            </Text>
          </View>
          {description && (
            <Text
              style={{ color: colors.text.secondary }}
              className="text-xs ml-7"
            >
              {description}
            </Text>
          )}
        </View>
        {isDismissible && (
          <Pressable onPress={onDismiss}>
            <Ionicons name="close" size={20} color={colors.error} />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}
