import { type TextInputProps } from "react-native";
import { Platform } from "react-native";

/** Map Bengali digits ০-৯ → 0-9, then keep only ASCII amount chars. */
export function normalizeAmountInput(text: string): string {
  const bangla = "০১২৩৪৫৬৭৮৯";
  let out = "";
  for (const ch of text) {
    const idx = bangla.indexOf(ch);
    out += idx >= 0 ? String(idx) : ch;
  }
  // Allow one decimal point
  const cleaned = out.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

export function parseAmountInput(text: string): number {
  const n = Number(normalizeAmountInput(text));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Append a digit / decimal / backspace to an amount string (for in-app keypad).
 */
export function applyAmountKey(
  current: string,
  key: "digit" | "decimal" | "backspace",
  digit?: string,
): string {
  const raw = current === "0" && key === "digit" ? "" : current;
  if (key === "backspace") return raw.slice(0, -1);
  if (key === "decimal") {
    if (raw.includes(".")) return raw;
    return raw.length === 0 ? "0." : `${raw}.`;
  }
  // digit
  const next = `${raw}${digit ?? ""}`;
  // Limit to 2 decimal places
  const parts = next.split(".");
  if (parts.length === 2 && parts[1].length > 2) return raw;
  return next;
}

/**
 * Number pad that does not follow the current language keyboard (Bangla, etc.).
 * Always use `decimal-pad` — on Android, `numeric` is often ignored by IMEs like Avro.
 *
 * Note: On Android, `TYPE_NUMBER_FLAG_DECIMAL` shares a bit with `TYPE_TEXT_FLAG_CAP_WORDS`.
 * Setting `autoCapitalize: "none"` clears that bit and can break decimal-pad. Use `"words"`.
 */
export const AMOUNT_KEYBOARD_TYPE: NonNullable<TextInputProps["keyboardType"]> =
  "decimal-pad";

export const amountInputProps: Pick<
  TextInputProps,
  | "keyboardType"
  | "inputMode"
  | "autoCorrect"
  | "autoCapitalize"
  | "autoComplete"
  | "textContentType"
  | "importantForAutofill"
> = {
  keyboardType: AMOUNT_KEYBOARD_TYPE,
  inputMode: "decimal",
  autoCorrect: false,
  // Android bit-collision workaround (see comment above)
  autoCapitalize: Platform.OS === "android" ? "words" : "none",
  autoComplete: "off",
  textContentType: "none",
  importantForAutofill: "no",
};

export const integerInputProps: Pick<
  TextInputProps,
  | "keyboardType"
  | "inputMode"
  | "autoCorrect"
  | "autoCapitalize"
  | "autoComplete"
  | "textContentType"
  | "importantForAutofill"
> = {
  keyboardType: Platform.OS === "ios" ? "number-pad" : "number-pad",
  inputMode: "numeric",
  autoCorrect: false,
  autoCapitalize: Platform.OS === "android" ? "words" : "none",
  autoComplete: "off",
  textContentType: "none",
  importantForAutofill: "no",
};
