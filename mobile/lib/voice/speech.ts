/**
 * Speech-to-text abstraction (Bangla-first).
 *
 * CURRENT REALITY — read before changing:
 * - **Web**: the browser's `webkitSpeechRecognition` works today, no native code.
 * - **Native (iOS/Android)**: needs the free `expo-speech-recognition` module,
 *   which is NOT installed. On-device voice reports "unavailable" and the UI
 *   falls back to typing (the parser is text-based, so typing covers the same
 *   workflow).
 *
 * WHY THERE IS NO `import(variable)` HERE:
 * Metro requires **static string literals** in `import()`. Referencing an
 * uninstalled package — even dynamically, even inside try/catch — makes Metro
 * either fail the bundle or throw at runtime ("Requiring unknown module"),
 * which crashed the Shop screens on device. So we do not reference it at all.
 *
 * TO ENABLE on-device voice (a native rebuild, not an OTA change):
 *   1. `npx expo install expo-speech-recognition`
 *   2. Add the plugin to `app.json` (it declares the mic permission).
 *   3. Rebuild: `npx expo run:ios --device`
 *   4. Replace the `if (Platform.OS !== "web")` branch below with a static
 *      `import { ExpoSpeechRecognitionModule } from "expo-speech-recognition"`
 *      at the top of a small adapter file, and call its `start/stop`.
 * Until step 4 is done, this module intentionally reports unavailable.
 */

import { Platform } from "react-native";

export type SpeechLang = "bn-BD" | "en-US";

export type SpeechResult = {
  transcript: string;
  /** Best-effort confidence 0–1 when the platform reports one. */
  confidence?: number;
};

/**
 * Single shape (not a union) so callers can read `reason`/`lang` without
 * depending on discriminated-union narrowing.
 */
export type SpeechSupport = {
  available: boolean;
  provider: "web" | "native" | "none";
  lang: SpeechLang;
  /** Present when `available` is false. */
  reason?: string;
};

const BN: SpeechLang = "bn-BD";

const NATIVE_UNAVAILABLE_REASON =
  "On-device voice needs the free expo-speech-recognition module (one rebuild). Typing works now.";

function webSpeechCtor(): any | null {
  const w = globalThis as any;
  const Ctor = w?.webkitSpeechRecognition ?? w?.SpeechRecognition;
  return typeof Ctor === "function" ? Ctor : null;
}

/** What voice input can do on this device right now. Never throws. */
export async function describeSpeechSupport(): Promise<SpeechSupport> {
  try {
    // NOTE: `Platform` is imported statically on purpose. A previous version
    // did `await import("react-native")`, which in Expo Go goes through
    // expo's async-require `importAll`: that enumerates every RN export and
    // triggers the lazy getters, including `get__PushNotificationIOS`, which
    // throws "tried to access a native module that doesn't exist". A static
    // import only touches `Platform`.
    if (Platform.OS === "web") {
      return webSpeechCtor()
        ? { available: true, provider: "web", lang: BN }
        : {
            available: false,
            provider: "none",
            lang: BN,
            reason: "This browser has no speech recognition.",
          };
    }
    // Native: no module referenced (see header) — typing is the path.
    return {
      available: false,
      provider: "none",
      lang: BN,
      reason: NATIVE_UNAVAILABLE_REASON,
    };
  } catch {
    return {
      available: false,
      provider: "none",
      lang: BN,
      reason: NATIVE_UNAVAILABLE_REASON,
    };
  }
}

export type ListenHandlers = {
  onResult: (result: SpeechResult) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
  lang?: SpeechLang;
};

export type ListenSession = {
  stop: () => Promise<void>;
};

/**
 * Start listening. Resolves with a session handle, or `null` when speech is not
 * available — callers keep the text field usable and show the reason.
 */
export async function startListening(
  handlers: ListenHandlers,
): Promise<ListenSession | null> {
  let support: SpeechSupport;
  try {
    support = await describeSpeechSupport();
  } catch {
    handlers.onError?.(NATIVE_UNAVAILABLE_REASON);
    return null;
  }

  if (!support.available) {
    handlers.onError?.(support.reason ?? "Voice input unavailable");
    return null;
  }

  const lang = handlers.lang ?? support.lang ?? BN;

  // Only the web provider is reachable today.
  const Ctor = webSpeechCtor();
  if (!Ctor) {
    handlers.onError?.("Speech recognition unavailable");
    return null;
  }

  let recognition: any;
  try {
    recognition = new Ctor();
  } catch {
    handlers.onError?.("Could not start the microphone");
    return null;
  }

  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = lang;

  recognition.onresult = (event: any) => {
    const res = event?.results?.[0]?.[0];
    const transcript = String(res?.transcript ?? "").trim();
    if (transcript) {
      handlers.onResult({
        transcript,
        confidence:
          typeof res?.confidence === "number" ? res.confidence : undefined,
      });
    }
  };
  recognition.onerror = (event: any) =>
    handlers.onError?.(String(event?.error ?? "Speech error"));
  recognition.onend = () => handlers.onEnd?.();

  try {
    recognition.start();
  } catch (e: any) {
    handlers.onError?.(e?.message ?? "Could not start microphone");
    return null;
  }

  return {
    stop: async () => {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}

/** Bangla first: the shop floor speaks Bangla, but allow an English fallback. */
export function alternateLang(lang: SpeechLang): SpeechLang {
  return lang === "bn-BD" ? "en-US" : "bn-BD";
}
