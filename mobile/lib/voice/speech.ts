import { Keyboard, Platform } from "react-native";
import {
  ExpoSpeechRecognitionModule,
  AVAudioSessionCategory,
  AVAudioSessionCategoryOptions,
  AVAudioSessionMode,
} from "expo-speech-recognition";

/**
 * Speech-to-text, Bangla-first.
 *
 * Providers:
 *  - **Native (iOS/Android)**: `expo-speech-recognition` — the OS recognizer
 *    (Apple Speech / Android SpeechRecognizer). Free, no API key, uses the
 *    platform engine, and supports `bn-BD` when the language is installed.
 *  - **Web**: the browser's `webkitSpeechRecognition`.
 *
 * IMPORTANT (Metro/Hermes + device stability):
 *  1. `Platform` / the speech module are imported **statically**. Dynamic
 *     `import("react-native")` or `import(variable)` crash Expo Go / Hermes.
 *  2. Before starting native recognition we dismiss the keyboard and abort any
 *     prior session — overlapping TextInput focus + audio session changes is a
 *     known iOS crash path for this module.
 *  3. Every public function is catch-all safe; callers never see a throw.
 */

export type SpeechLang = "bn-BD" | "en-US";

export type SpeechResult = {
  transcript: string;
  confidence?: number;
};

export type SpeechSupport = {
  available: boolean;
  provider: "web" | "native" | "none";
  /** Locale that will actually be used (Bangla when the device has it). */
  lang: SpeechLang;
  /** True when the device can transcribe Bangla. */
  banglaSupported: boolean;
  /** Present when `available` is false, or as a caveat when true. */
  reason?: string;
};

const BN: SpeechLang = "bn-BD";
const EN: SpeechLang = "en-US";

/** Locale tags that count as Bangla across platforms. */
const BANGLA_LOCALES = ["bn-bd", "bn-in", "bn"];

function isBanglaLocale(tag: string): boolean {
  const t = tag.trim().toLowerCase().replace("_", "-");
  return BANGLA_LOCALES.some((b) => t === b || t.startsWith(`${b}-`));
}

/** Browsers: Bangla is not reliably available, so don't promise it. */
function webSpeechCtor(): any | null {
  const w = globalThis as any;
  const Ctor = w?.webkitSpeechRecognition ?? w?.SpeechRecognition;
  return typeof Ctor === "function" ? Ctor : null;
}

let cachedLocaleCheck: { bangla: boolean; checked: boolean } = {
  bangla: false,
  checked: false,
};

function safeAbort(): void {
  try {
    ExpoSpeechRecognitionModule.abort();
  } catch {
    /* already idle */
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ask the device which locales it can transcribe. Bangla often needs to be
 * downloaded first (iOS: Settings → General → Keyboard → Dictation Languages;
 * Android: Google app → voice input), so we check rather than assume.
 */
export async function isBanglaTranscriptionSupported(): Promise<boolean> {
  if (cachedLocaleCheck.checked) return cachedLocaleCheck.bangla;
  try {
    const { locales } = await ExpoSpeechRecognitionModule.getSupportedLocales(
      {},
    );
    const bangla = (locales ?? []).some((l: string) => isBanglaLocale(l));
    cachedLocaleCheck = { bangla, checked: true };
    return bangla;
  } catch {
    // Don't cache a failure — the check is best-effort.
    return false;
  }
}

/** What voice input can do on this device right now. Never throws. */
export async function describeSpeechSupport(): Promise<SpeechSupport> {
  try {
    if (Platform.OS === "web") {
      const hasWeb = Boolean(webSpeechCtor());
      return {
        available: hasWeb,
        provider: hasWeb ? "web" : "none",
        // Browsers mostly ignore bn-BD; ask for it but expect English.
        lang: BN,
        banglaSupported: false,
        reason: hasWeb ? undefined : "This browser has no speech recognition.",
      };
    }

    let available = false;
    try {
      available = Boolean(
        ExpoSpeechRecognitionModule?.isRecognitionAvailable?.(),
      );
    } catch {
      available = false;
    }

    if (!available) {
      return {
        available: false,
        provider: "none",
        lang: BN,
        banglaSupported: false,
        reason: "এই ডিভাইসে স্পিচ রিকগনিশন নেই।",
      };
    }

    const banglaSupported = await isBanglaTranscriptionSupported();
    return {
      available: true,
      provider: "native",
      // Prefer Bangla whenever the device can do it.
      lang: banglaSupported ? BN : EN,
      banglaSupported,
      reason: banglaSupported
        ? undefined
        : "বাংলা ভয়েস ডাউনলোড করা নেই — ইংরেজিতে শুনবে। ফোনের সেটিংস থেকে বাংলা ডিক্টেশন যোগ করুন।",
    };
  } catch {
    return {
      available: false,
      provider: "none",
      lang: BN,
      banglaSupported: false,
      reason: "ভয়েস চালু করা যায়নি।",
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
 * Never throws.
 */
export async function startListening(
  handlers: ListenHandlers,
): Promise<ListenSession | null> {
  try {
    const support = await describeSpeechSupport();
    if (!support.available) {
      handlers.onError?.(support.reason ?? "Voice input unavailable");
      return null;
    }

    const lang = handlers.lang ?? support.lang ?? BN;

    // ── Web ─────────────────────────────────────────────────────────────────
    if (support.provider === "web") {
      return startWebListening(handlers, lang);
    }

    // ── Native ──────────────────────────────────────────────────────────────
    return await startNativeListening(handlers, lang);
  } catch (e: any) {
    handlers.onError?.(e?.message ?? "Could not start microphone");
    return null;
  }
}

function startWebListening(
  handlers: ListenHandlers,
  lang: SpeechLang,
): ListenSession | null {
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

async function startNativeListening(
  handlers: ListenHandlers,
  lang: SpeechLang,
): Promise<ListenSession | null> {
  // Overlapping keyboard focus + AVAudioSession category changes crashes some
  // iOS builds. Clear both before touching the recognizer.
  try {
    Keyboard.dismiss();
  } catch {
    /* ignore */
  }
  safeAbort();
  await delay(120);

  try {
    // Prefer the split permission APIs when present; fall back to combined.
    const mod = ExpoSpeechRecognitionModule as any;
    if (typeof mod.requestMicrophonePermissionsAsync === "function") {
      const mic = await mod.requestMicrophonePermissionsAsync();
      if (!mic?.granted) {
        handlers.onError?.("মাইক্রোফোনের অনুমতি প্রয়োজন।");
        return null;
      }
    }
    if (
      Platform.OS === "ios" &&
      typeof mod.requestSpeechRecognizerPermissionsAsync === "function"
    ) {
      const speech = await mod.requestSpeechRecognizerPermissionsAsync();
      if (!speech?.granted && !speech?.restricted) {
        // Still try — some devices only need mic; start() will error cleanly.
      }
      if (speech?.granted === false && speech?.canAskAgain === false) {
        handlers.onError?.("মাইক্রোফোনের অনুমতি প্রয়োজন।");
        return null;
      }
    } else {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm?.granted) {
        handlers.onError?.("মাইক্রোফোনের অনুমতি প্রয়োজন।");
        return null;
      }
    }
  } catch {
    handlers.onError?.("মাইক্রোফোনের অনুমতি নেওয়া যায়নি।");
    return null;
  }

  const subscriptions: Array<{ remove?: () => void }> = [];
  const cleanup = () => {
    subscriptions.forEach((s) => {
      try {
        s.remove?.();
      } catch {
        /* ignore */
      }
    });
    subscriptions.length = 0;
  };

  try {
    subscriptions.push(
      ExpoSpeechRecognitionModule.addListener("result", (event: any) => {
        try {
          const transcript = String(
            event?.results?.[0]?.transcript ?? "",
          ).trim();
          if (!transcript) return;
          const raw = event?.results?.[0]?.confidence;
          handlers.onResult({
            transcript,
            confidence: typeof raw === "number" && raw >= 0 ? raw : undefined,
          });
        } catch {
          /* swallow result parse errors */
        }
      }),
    );
    subscriptions.push(
      ExpoSpeechRecognitionModule.addListener("error", (event: any) => {
        const msg = String(
          event?.message ?? event?.error ?? "Speech error",
        );
        handlers.onError?.(msg);
      }),
    );
    subscriptions.push(
      ExpoSpeechRecognitionModule.addListener("end", () => {
        handlers.onEnd?.();
      }),
    );

    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: false,
      continuous: false,
      // Network recognizer is OK when the offline model isn't installed.
      requiresOnDeviceRecognition: false,
      addsPunctuation: false,
      // Explicit iOS audio session avoids the default category flip crash path.
      ...(Platform.OS === "ios"
        ? {
            iosCategory: {
              category: AVAudioSessionCategory.playAndRecord,
              categoryOptions: [
                AVAudioSessionCategoryOptions.defaultToSpeaker,
                AVAudioSessionCategoryOptions.allowBluetooth,
              ],
              mode: AVAudioSessionMode.measurement,
            },
          }
        : {}),
    });
  } catch (e: any) {
    cleanup();
    safeAbort();
    handlers.onError?.(e?.message ?? "Could not start microphone");
    return null;
  }

  return {
    stop: async () => {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        safeAbort();
      }
      cleanup();
    },
  };
}

/** Bangla first: the shop floor speaks Bangla, but allow an English fallback. */
export function alternateLang(lang: SpeechLang): SpeechLang {
  return lang === BN ? EN : BN;
}
