import { usePreferences } from "./use-preferences";
import { translations } from "@/lib/i18n/translations";
import type { AppTranslations } from "@/lib/i18n/translations";

/**
 * useTranslation — returns a `t()` function that translates keys based on
 * the user's selected language (stored in preferences).
 *
 * Usage:
 *   const { t } = useTranslation();
 *   <Text>{t("dashboard")}</Text>
 *   <Text>{t("saveWithAttachments", { n: "3", s: "s" })}</Text>
 *
 * Adding a new language:
 *   1. Add the language code to `translations.ts`
 *   2. Implement all `AppTranslations` keys in the new locale object
 *   3. Export in the `translations` record — no other changes needed.
 */
export function useTranslation() {
  const { preferences } = usePreferences();
  const lang =
    preferences.language && preferences.language in translations
      ? preferences.language
      : "en";

  /**
   * Translate a key, optionally interpolating `{variable}` placeholders.
   *
   * @param key   - key from AppTranslations
   * @param vars  - map of placeholder names → replacement strings
   */
  function t(
    key: keyof AppTranslations,
    vars?: Record<string, string>,
  ): string {
    const locale = translations[lang] ?? translations["en"];
    let text: string = (locale[key] ??
      translations["en"][key] ??
      key) as string;

    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replaceAll(`{${k}}`, v);
      }
    }

    return text;
  }

  return { t, language: lang };
}
