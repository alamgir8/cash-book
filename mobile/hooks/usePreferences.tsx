import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface UserPreferences {
  currency: string;
  currencySymbol: string;
  language: string;
  languageLabel: string;
}

interface PreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (newPrefs: Partial<UserPreferences>) => Promise<void>;
  formatAmount: (amount: number) => string;
  getCurrencySymbol: () => string;
}

const defaultPreferences: UserPreferences = {
  currency: "USD",
  currencySymbol: "$",
  language: "en",
  languageLabel: "English",
};

const PREFERENCES_STORAGE_KEY = "user_preferences";

// Currency mapping
const currencyMap: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CAD: "C$",
  AUD: "A$",
  CHF: "CHF",
  CNY: "¥",
  INR: "₹",
  BDT: "৳",
};

// Language mapping
const languageMap: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  zh: "Chinese",
  ja: "Japanese",
  ar: "Arabic",
  hi: "Hindi",
  bn: "Bengali",
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined
);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] =
    useState<UserPreferences>(defaultPreferences);

  // Load preferences from storage on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({
          ...parsed,
          currencySymbol: currencyMap[parsed.currency] || "$",
          languageLabel: languageMap[parsed.language] || "English",
        });
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  };

  const updatePreferences = async (newPrefs: Partial<UserPreferences>) => {
    try {
      const updatedPrefs = {
        ...preferences,
        ...newPrefs,
        currencySymbol:
          currencyMap[newPrefs.currency || preferences.currency] || "$",
        languageLabel:
          languageMap[newPrefs.language || preferences.language] || "English",
      };

      setPreferences(updatedPrefs);
      await AsyncStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify(updatedPrefs)
      );
    } catch (error) {
      console.error("Failed to save preferences:", error);
      throw error;
    }
  };

  const formatAmount = (amount: number): string => {
    return `${preferences.currencySymbol}${Math.round(
      amount
    ).toLocaleString()}`;
  };

  const getCurrencySymbol = (): string => {
    return preferences.currencySymbol;
  };

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        updatePreferences,
        formatAmount,
        getCurrencySymbol,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}
