import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "@/hooks/useTheme";

/**
 * Hook to set status bar styling based on current theme
 * Should be called in each screen component
 */
export function useThemeStatusBar() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    // Update status bar based on theme
    // expo-status-bar updates automatically based on the StatusBar component
  }, [isDark]);

  return {
    barStyle: isDark ? ("light" as const) : ("dark" as const),
    backgroundColor: colors.bg.primary,
  };
}

/**
 * Component wrapper for status bar that respects theme
 */
export function ThemedStatusBar() {
  const { isDark } = useTheme();

  return <StatusBar style={isDark ? "light" : "dark"} translucent={false} />;
}
