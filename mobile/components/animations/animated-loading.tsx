import { useEffect } from "react";
import { Animated, View, Text } from "react-native";
import { useTheme } from "@/hooks/useTheme";

interface AnimatedLoadingProps {
  message: string;
  showDot?: boolean;
}

export function AnimatedLoading({
  message,
  showDot = true,
}: AnimatedLoadingProps) {
  const { colors } = useTheme();
  const dotOpacity = new Animated.Value(0);

  useEffect(() => {
    if (!showDot) return;

    Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(dotOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [dotOpacity, showDot]);

  return (
    <View className="flex-row items-center justify-center gap-1 py-4">
      <Text style={{ color: colors.text.secondary }} className="font-medium">
        {message}
      </Text>
      {showDot && (
        <>
          <Animated.Text
            style={{ opacity: dotOpacity, color: colors.primary }}
            className="text-lg"
          >
            •
          </Animated.Text>
          <Animated.Text
            style={{
              opacity: dotOpacity,
              color: colors.primary,
              marginLeft: -8,
              marginRight: -8,
            }}
            className="text-lg"
          >
            •
          </Animated.Text>
          <Animated.Text
            style={{ opacity: dotOpacity, color: colors.primary }}
            className="text-lg"
          >
            •
          </Animated.Text>
        </>
      )}
    </View>
  );
}
