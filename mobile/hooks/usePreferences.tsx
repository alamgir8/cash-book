import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
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
  undefined,
);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { state, updateProfile } = useAuth();
  const [preferences, setPreferences] =
    useState<UserPreferences>(defaultPreferences);

  // Load preferences from auth user or storage on mount
  useEffect(() => {
    if (state.status === "authenticated" && state.user?.settings) {
      const userSettings = state.user.settings;
      setPreferences({
        currency: userSettings.currency,
        currency_symbol: currencyMap[userSettings.currency]?.symbol || "$",
        locale: currencyMap[userSettings.currency]?.locale || "en-US",
        date_format: "MMM D, YYYY",
        time_format: "12h",
        language: userSettings.language,
        language_label: languageMap[userSettings.language] || "English",
      });
    } else if (state.status !== "authenticated") {
      // Fallback to local storage only when not authenticated
      AsyncStorage.getItem(PREFERENCES_STORAGE_KEY)
        .then((stored) => {
          if (stored) {
            const parsed = JSON.parse(stored);
            setPreferences({
              ...parsed,
              currency_symbol: currencyMap[parsed.currency]?.symbol || "$",
              locale: currencyMap[parsed.currency]?.locale || "en-US",
              date_format: "MMM D, YYYY",
              time_format: "12h",
              language_label: languageMap[parsed.language] || "English",
            });
          }
        })
        .catch((error) => {
          console.warn("Failed to load preferences:", error);
        });
    }
  }, [
    state.status,
    state.user?.settings?.currency,
    state.user?.settings?.language,
  ]);

  const updatePreferences = useCallback(
    async (newPrefs: Partial<UserPreferences>) => {
      try {
        const updatedPrefs = {
          ...preferences,
          ...newPrefs,
          currency_symbol:
            currencyMap[newPrefs.currency || preferences.currency]?.symbol ||
            "$",
          language_label:
            languageMap[newPrefs.language || preferences.language] || "English",
        };

        setPreferences(updatedPrefs);

        if (state.status === "authenticated") {
          await updateProfile({
            settings: {
              currency: updatedPrefs.currency,
              language: updatedPrefs.language,
            },
          });
        } else {
          await AsyncStorage.setItem(
            PREFERENCES_STORAGE_KEY,
            JSON.stringify(updatedPrefs),
          );
        }
      } catch (error) {
        console.warn("Failed to save preferences:", error);
        throw error;
      }
    },
    [preferences, state.status, updateProfile],
  );

  // Cache Intl.NumberFormat instances to avoid re-creation on every render
  const numberFormatters = useMemo(() => {
    const currency = preferences.currency || "USD";
    const locale = preferences.locale || "en-US";
    return {
      currency: new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }),
      decimal: new Intl.NumberFormat(locale, {
        style: "decimal",
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }),
    };
  }, [preferences.currency, preferences.locale]);

  const formatAmount = useCallback(
    (amount: number, options: FormatAmountOptions = {}): string => {
      const { showCurrency = true, ...numberOptions } = options;

      // Use cached formatters for the common case (no custom options)
      const hasCustomOptions = Object.keys(numberOptions).length > 0;
      if (!hasCustomOptions) {
        return showCurrency
          ? numberFormatters.currency.format(amount)
          : numberFormatters.decimal.format(amount);
      }

      // Fall back to creating a new formatter for custom options
      const currency = preferences.currency || "USD";
      const locale = preferences.locale || "en-US";
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
    },
    [numberFormatters, preferences.currency, preferences.locale],
  );

  const getCurrencySymbol = useCallback((): string => {
    return preferences.currency_symbol;
  }, [preferences.currency_symbol]);

  const value = useMemo<PreferencesContextType>(
    () => ({
      preferences,
      updatePreferences,
      formatAmount,
      getCurrencySymbol,
    }),
    [preferences, updatePreferences, formatAmount, getCurrencySymbol],
  );

  return (
    <PreferencesContext.Provider value={value}>
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
