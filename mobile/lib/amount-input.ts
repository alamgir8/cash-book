import { TextInput, type TextInputProps } from "react-native";

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
 * Number pad that does not follow the current language keyboard (Bangla, etc.).
 * On iOS, `numeric` can stay on a multilingual keyboard; `decimal-pad` forces digits.
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
  autoCapitalize: "none",
  autoComplete: "off",
  textContentType: "none",
  importantForAutofill: "no",
};
