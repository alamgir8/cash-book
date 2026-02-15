import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark" | "system";

export const lightColors = {
  primary: "#2576f8",
  primaryDark: "#1d4ed8",
  secondary: "#8b5cf6",
  success: "#10b981",
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#05889f",

  // Background colors
  bg: {
    primary: "#ffffff",
    secondary: "#f8fafc",
    tertiary: "#d4e5f5",
  },

  // Text colors
  text: {
    primary: "#0f172a",
    secondary: "#475569",
    tertiary: "#7e93af",
    inverse: "#ffffff",
  },

  // Border colors
  border: "#e2e8f0",
  divider: "#cbd5e1",

  // Component specific
  card: "#ffffff",
  cardBorder: "#e2e8f0",
  input: "#ffffff",
  inputBorder: "#cbd5e1",
  inputPlaceholder: "#94a3b8",
  buttonText: "#ffffff",
  modalOverlay: "rgba(15, 23, 42, 0.5)",

  // Status colors
  statusBar: "#ffffff",
  statusBarText: "#0f172a",
};

export const darkColors = {
  primary: "#60a5fa",
  primaryDark: "#3b82f6",
  secondary: "#a78bfa",
  success: "#34d399",
  error: "#f87171",
  warning: "#fbb400",
  info: "#22d3ee",

  // Background colors
  bg: {
    primary: "#0f172a",
    secondary: "#1e293b",
    tertiary: "#334155",
  },

  // Text colors
  text: {
    primary: "#f8fafc",
    secondary: "#cbd5e1",
    tertiary: "#64748b",
    inverse: "#0f172a",
  },

  // Border colors
  border: "#334155",
  divider: "#1e293b",

  // Component specific
  card: "#1e293b",
  cardBorder: "#334155",
  input: "#0f172a",
  inputBorder: "#334155",
  inputPlaceholder: "#64748b",
  buttonText: "#ffffff",
  modalOverlay: "rgba(0, 0, 0, 0.8)",

  // Status colors
  statusBar: "#0f172a",
  statusBarText: "#f8fafc",
};

export type Colors = typeof lightColors;

type ThemeContextType = {
  colorScheme: ColorScheme;
  isDark: boolean;
  colors: Colors;
  setColorScheme: (scheme: ColorScheme) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "cash-book-theme";

type ThemeProviderProps = {
  children: ReactNode;
};

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const systemColorScheme = useColorScheme();
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>("system");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
        if (saved) {
          setColorSchemeState(saved as ColorScheme);
        }
      } catch (error) {
        console.warn("Failed to load theme preference:", error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadTheme();
  }, []);

  const setColorScheme = async (scheme: ColorScheme) => {
    try {
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, scheme);
      setColorSchemeState(scheme);
    } catch (error) {
      console.warn("Failed to save theme preference:", error);
    }
  };

  // Determine effective color scheme
  const effectiveScheme =
    colorScheme === "system" ? (systemColorScheme ?? "light") : colorScheme;
  const isDark = effectiveScheme === "dark";
  const colors = isDark ? darkColors : lightColors;

  const value: ThemeContextType = {
    colorScheme,
    isDark,
    colors,
    setColorScheme,
  };

  if (!isLoaded) {
    return null; // Or return a loading screen
  }

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
