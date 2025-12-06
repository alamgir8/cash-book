import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./useAuth";

interface UserPreferences {
  currency: string;
  currency_symbol: string;
  locale: string;
  date_format: string;
  time_format: string;
  language: string;
  language_label: string;
}
interface FormatAmountOptions extends Intl.NumberFormatOptions {
  /**
   * If false, show only the number (no currency).
   * Default: true
   */
  showCurrency?: boolean;
}

interface PreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (newPrefs: Partial<UserPreferences>) => Promise<void>;
  formatAmount: (amount: number, options?: FormatAmountOptions) => string;
  getCurrencySymbol: () => string;
}

const defaultPreferences: UserPreferences = {
  currency: "USD",
  currency_symbol: "$",
  locale: "en-US",
  date_format: "MMM D, YYYY",
  time_format: "12h",
  language: "en",
  language_label: "English",
};

const PREFERENCES_STORAGE_KEY = "user_preferences";

// Currency mapping
export const currencyMap: Record<
  string,
  { symbol: string; locale: string; name: string }
> = {
  USD: { symbol: "$", locale: "en-US", name: "US Dollar" },
  EUR: { symbol: "€", locale: "fr-FR", name: "Euro" },
  GBP: { symbol: "£", locale: "en-GB", name: "British Pound" },
  JPY: { symbol: "¥", locale: "ja-JP", name: "Japanese Yen" },
  CNY: { symbol: "¥", locale: "zh-CN", name: "Chinese Yuan" },
  INR: { symbol: "₹", locale: "hi-IN", name: "Indian Rupee" },
  BDT: { symbol: "৳", locale: "bn-BD", name: "Bangladeshi Taka" },
  PKR: { symbol: "₨", locale: "ur-PK", name: "Pakistani Rupee" },
  AUD: { symbol: "A$", locale: "en-AU", name: "Australian Dollar" },
  CAD: { symbol: "C$", locale: "en-CA", name: "Canadian Dollar" },
  CHF: { symbol: "CHF", locale: "de-CH", name: "Swiss Franc" },
  SEK: { symbol: "kr", locale: "sv-SE", name: "Swedish Krona" },
  NOK: { symbol: "kr", locale: "nb-NO", name: "Norwegian Krone" },
  DKK: { symbol: "kr", locale: "da-DK", name: "Danish Krone" },
  RUB: { symbol: "₽", locale: "ru-RU", name: "Russian Ruble" },
  SAR: { symbol: "﷼", locale: "ar-SA", name: "Saudi Riyal" },
  AED: { symbol: "د.إ", locale: "ar-AE", name: "UAE Dirham" },
  TRY: { symbol: "₺", locale: "tr-TR", name: "Turkish Lira" },
  THB: { symbol: "฿", locale: "th-TH", name: "Thai Baht" },
  KRW: { symbol: "₩", locale: "ko-KR", name: "South Korean Won" },
  MYR: { symbol: "RM", locale: "ms-MY", name: "Malaysian Ringgit" },
  SGD: { symbol: "S$", locale: "en-SG", name: "Singapore Dollar" },
  HKD: { symbol: "HK$", locale: "zh-HK", name: "Hong Kong Dollar" },
  NZD: { symbol: "NZ$", locale: "en-NZ", name: "New Zealand Dollar" },
  ZAR: { symbol: "R", locale: "en-ZA", name: "South African Rand" },
  NGN: { symbol: "₦", locale: "en-NG", name: "Nigerian Naira" },
  EGP: { symbol: "£", locale: "ar-EG", name: "Egyptian Pound" },
  BRL: { symbol: "R$", locale: "pt-BR", name: "Brazilian Real" },
  MXN: { symbol: "$", locale: "es-MX", name: "Mexican Peso" },
  IDR: { symbol: "Rp", locale: "id-ID", name: "Indonesian Rupiah" },
  PHP: { symbol: "₱", locale: "en-PH", name: "Philippine Peso" },
  VND: { symbol: "₫", locale: "vi-VN", name: "Vietnamese Dong" },
  PLN: { symbol: "zł", locale: "pl-PL", name: "Polish Złoty" },
  CZK: { symbol: "Kč", locale: "cs-CZ", name: "Czech Koruna" },
  HUF: { symbol: "Ft", locale: "hu-HU", name: "Hungarian Forint" },
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
  const { state, updateProfile } = useAuth();
  const [preferences, setPreferences] =
    useState<UserPreferences>(defaultPreferences);
  const isMountedRef = useRef(true);

  // Load preferences from auth user or storage on mount
  useEffect(() => {
    if (state.status === "authenticated" && state.user?.settings) {
      // Load from authenticated user
      const userSettings = state.user.settings;
      if (isMountedRef.current) {
        setPreferences({
          currency: userSettings.currency,
          currency_symbol: currencyMap[userSettings.currency]?.symbol || "$",
          locale: currencyMap[userSettings.currency]?.locale || "en-US",
          date_format: "MMM D, YYYY", // Could be extended to userSettings.date_format
          time_format: "12h", // Could be extended to userSettings.time_format
          language: userSettings.language,
          language_label: languageMap[userSettings.language] || "English",
        });
      }
    } else {
      // Fallback to local storage
      loadPreferences();
    }
  }, [state]);

  const loadPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (stored && isMountedRef.current) {
        const parsed = JSON.parse(stored);
        setPreferences({
          ...parsed,
          currency_symbol: currencyMap[parsed.currency]?.symbol || "$",
          locale: currencyMap[parsed.currency]?.locale || "en-US",
          date_format: "MMM D, YYYY", // Could be extended to userSettings.date_format
          time_format: "12h", // Could be extended to userSettings.time_format
          language_label: languageMap[parsed.language] || "English",
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
        currency_symbol:
          currencyMap[newPrefs.currency || preferences.currency]?.symbol || "$",
        language_label:
          languageMap[newPrefs.language || preferences.language] || "English",
      };

      if (isMountedRef.current) {
        setPreferences(updatedPrefs);
      }

      // If user is authenticated, sync with backend
      if (state.status === "authenticated") {
        await updateProfile({
          settings: {
            currency: updatedPrefs.currency,
            language: updatedPrefs.language,
          },
        });
      } else {
        // Otherwise save to local storage
        await AsyncStorage.setItem(
          PREFERENCES_STORAGE_KEY,
          JSON.stringify(updatedPrefs)
        );
      }
    } catch (error) {
      console.error("Failed to save preferences:", error);
      throw error;
    }
  };

  const formatAmount = (
    amount: number,
    options: FormatAmountOptions = {}
  ): string => {
    const currency = preferences.currency || "USD";
    const locale = preferences.locale || "en-US";

    const { showCurrency = true, ...numberOptions } = options;

    const baseOptions: Intl.NumberFormatOptions = {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
      ...numberOptions,
    };

    if (showCurrency) {
      baseOptions.style = "currency";
      baseOptions.currency = currency;
    } else {
      baseOptions.style = "decimal";
    }

    return new Intl.NumberFormat(locale, baseOptions).format(amount);
  };

  const getCurrencySymbol = (): string => {
    return preferences.currency_symbol;
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
