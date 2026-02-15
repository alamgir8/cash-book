import { useEffect } from "react";
import { Animated, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
  style?: any;
}

export function SkeletonBase({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const { colors } = useTheme();
  const shimmerAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ]),
    ).start();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 1, 0.3],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.bg.tertiary,
          opacity,
        },
        style,
      ]}
    />
  );
}
