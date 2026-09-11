/**
 * Speech-to-text abstraction (Bangla-first).
 *
 * IMPORTANT — current reality:
 * The app's original `VoiceInputButton` only worked on **web** (it returned
 * `null` on iOS/Android), so on a phone there was no voice input at all.
 *
 * This module provides one API with two providers:
 *  1. **Web** — the browser's `webkitSpeechRecognition` (works today, no build).
 *  2. **Native** — `expo-speech-recognition`, an optional free module that uses
 *     the OS recognizer (Apple Speech / Android SpeechRecognizer). It supports
 *     `bn-BD`, needs no API key and costs nothing, but requires a native rebuild.
 *
 * The module is imported lazily, so the app builds and runs normally whether or
 * not it is installed. `describeSpeechSupport()` tells the UI which case applies.
 *
 * Compliance: no paid AI APIs; the recognizer is the OS one. Typed input always
 * works regardless, because the parser is text-based.
 */

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

const BN = "bn-BD" as const;

let cachedNativeModule: any | null | undefined;

/**
 * Try to load the optional native recognizer. Returns null when it is not
 * installed, which is the normal case until the app is rebuilt with it.
 */
async function loadNativeModule(): Promise<any | null> {
  if (cachedNativeModule !== undefined) return cachedNativeModule;
  try {
    // Non-literal specifier so bundlers do not fail when the package is absent.
    const name = "expo-speech-recognition";
    const mod = await import(/* @vite-ignore */ name);
    cachedNativeModule = mod ?? null;
  } catch {
    cachedNativeModule = null;
  }
  return cachedNativeModule;
}

/** What voice input can do on this device right now. */
export async function describeSpeechSupport(): Promise<SpeechSupport> {
  const { Platform } = await import("react-native");

  if (Platform.OS === "web") {
    const anyWindow = globalThis as any;
    const ok =
      typeof anyWindow?.webkitSpeechRecognition === "function" ||
      typeof anyWindow?.SpeechRecognition === "function";
    return ok
      ? { available: true, provider: "web", lang: BN }
      : {
          available: false,
          provider: "none",
          lang: BN,
          reason: "This browser has no speech recognition.",
        };
  }

  const native = await loadNativeModule();
  if (!native) {
    return {
      available: false,
      provider: "none",
      lang: BN,
      reason:
        "On-device voice needs the free expo-speech-recognition module (one rebuild). Typing works now.",
    };
  }
  try {
    const available = await native.ExpoSpeechRecognitionModule?.getStateAsync?.();
    void available;
    return { available: true, provider: "native", lang: BN };
  } catch {
    return { available: true, provider: "native", lang: BN };
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
 * available — callers should then keep the text field usable and show a hint.
 */
export async function startListening(
  handlers: ListenHandlers,
): Promise<ListenSession | null> {
  const support = await describeSpeechSupport();

  // Availability is checked before any provider-specific work.
  if (!support.available) {
    handlers.onError?.(support.reason ?? "Voice input unavailable");
    return null;
  }

  const lang = handlers.lang ?? support.lang ?? BN;

  if (support.provider === "web") {
    const anyWindow = globalThis as any;
    const Ctor =
      anyWindow.webkitSpeechRecognition ?? anyWindow.SpeechRecognition;
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      const res = event?.results?.[0]?.[0];
      const transcript = String(res?.transcript ?? "").trim();
      if (transcript) {
        handlers.onResult({
          transcript,
          confidence: typeof res?.confidence === "number" ? res.confidence : undefined,
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

  // ── Native path ────────────────────────────────────────────────────────
  const native = await loadNativeModule();
  const native_ = native?.ExpoSpeechRecognitionModule;
  if (!native_) {
    handlers.onError?.("Speech module unavailable");
    return null;
  }

  const subscriptions: any[] = [];
  subscriptions.push(
    native_.addListener?.("result", (event: any) => {
      const transcript = String(event?.results?.[0]?.transcript ?? "").trim();
      if (transcript) {
        handlers.onResult({
          transcript,
          confidence: event?.results?.[0]?.confidence,
        });
      }
    }),
  );
  subscriptions.push(
    native_.addListener?.("error", (event: any) =>
      handlers.onError?.(String(event?.message ?? event?.error ?? "Speech error")),
    ),
  );
  subscriptions.push(
    native_.addListener?.("end", () => handlers.onEnd?.()),
  );

  try {
    const perm = await native_.requestPermissionsAsync?.();
    if (perm && perm.granted === false) {
      handlers.onError?.("Microphone permission is required");
      subscriptions.forEach((s) => s?.remove?.());
      return null;
    }
    native_.start?.({ lang, interimResults: false, continuous: false });
  } catch (e: any) {
    handlers.onError?.(e?.message ?? "Could not start microphone");
    subscriptions.forEach((s) => s?.remove?.());
    return null;
  }

  return {
    stop: async () => {
      try {
        native_.stop?.();
      } catch {
        /* ignore */
      }
      subscriptions.forEach((s) => s?.remove?.());
    },
  };
}

/** Bangla first: the shop floor speaks Bangla, but allow the OS to fall back. */
export function alternateLang(lang: SpeechLang): SpeechLang {
  return lang === "bn-BD" ? "en-US" : "bn-BD";
}
