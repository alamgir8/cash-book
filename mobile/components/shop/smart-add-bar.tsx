import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";
import { ErrorBoundary } from "@/components/error-boundary";
import { toast } from "@/lib/toast";
import { dalFetchProducts } from "@/data/products";
import {
  parseBanglaItems,
  rankByName,
  type ParsedItem,
} from "@/lib/voice/bangla-nlp";
import {
  describeSpeechSupport,
  startListening,
  type ListenSession,
  type SpeechSupport,
} from "@/lib/voice/speech";
import type { Product } from "@/types/product";

export type SmartAddMode = "product" | "sale" | "purchase";

export type SmartAddItem = ParsedItem & {
  /** Existing catalog product this matched, when one was found. */
  matched?: Product;
  /** Price to use for this context (falls back sensibly by mode). */
  price: number | null;
  /** Cost price when known (from the catalog or an explicit cost). */
  cost: number | null;
};

type Props = {
  mode: SmartAddMode;
  organizationId?: string | null;
  /** Called with fully-resolved items; the screen decides what to do with them. */
  onSubmit: (items: SmartAddItem[]) => void;
  /** Optional: pick an existing product directly (e.g. add to cart). */
  onPickExisting?: (product: Product) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

/**
 * One-line "speak or type it" bar for products, sales and purchases.
 *
 * Flow: text/voice → Bangla parser → match against the on-device catalog →
 * preview chips (name · qty+unit · price, plus profit for sales) → add.
 * Everything runs offline; voice is optional and degrades to typing.
 */
export function SmartAddBar(props: Props) {
  /**
   * A convenience bar must never take down the till. If anything inside it
   * throws (parser, mic, catalog query), the screen keeps working and shows a
   * plain text field instead.
   */
  return (
    <ErrorBoundary fallback={<SmartAddFallback {...props} />}>
      <SmartAddBarInner {...props} />
    </ErrorBoundary>
  );
}

/** Minimal always-works fallback: type a name, add it. */
function SmartAddFallback({
  onSubmit,
  placeholder,
  autoFocus,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [value, setValue] = useState("");

  const add = useCallback(() => {
    const name = value.trim();
    if (!name) return;
    onSubmit([
      {
        raw: name,
        name,
        quantity: 1,
        unit: null,
        unit_price: null,
        purchase_price: null,
        sale_price: null,
        pricingAmbiguous: false,
        confidence: "low",
        price: null,
        cost: null,
      },
    ]);
    setValue("");
  }, [value, onSubmit]);

  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
      <TextInput
        value={value}
        onChangeText={setValue}
        autoFocus={autoFocus}
        placeholder={placeholder ?? t("smartAddPlaceholder")}
        placeholderTextColor={colors.text.tertiary}
        style={{
          flex: 1,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 11,
          fontSize: 15,
          color: colors.text.primary,
          backgroundColor: colors.bg.secondary,
        }}
      />
      <TouchableOpacity
        onPress={add}
        disabled={!value.trim()}
        style={{
          width: 46,
          height: 46,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: value.trim() ? colors.success : colors.bg.tertiary,
        }}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function SmartAddBarInner({
  mode,
  organizationId,
  onSubmit,
  onPickExisting,
  placeholder,
  autoFocus,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [speech, setSpeech] = useState<SpeechSupport | null>(null);
  const [banglaCaveat, setBanglaCaveat] = useState(false);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const sessionRef = useRef<ListenSession | null>(null);
  const inputRef = useRef<TextInput>(null);
  const listenLockRef = useRef(false);

  // Load the catalog once so matches are instant (and offline).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await dalFetchProducts({
          organization: organizationId || undefined,
          limit: 500,
        });
        if (!cancelled) setCatalog(res?.products ?? []);
      } catch {
        /* catalog optional — matching just won't suggest */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    let cancelled = false;
    void describeSpeechSupport()
      .then((s) => {
        if (cancelled) return;
        setSpeech(s);
        // Available but the device lacks Bangla dictation → tell the user once.
        setBanglaCaveat(s.available && !s.banglaSupported);
      })
      .catch(() => {
        if (!cancelled) {
          setSpeech({
            available: false,
            provider: "none",
            lang: "bn-BD",
            banglaSupported: false,
          });
          setBanglaCaveat(false);
        }
      });
    return () => {
      cancelled = true;
      // Stop any in-flight session if the screen unmounts mid-listen.
      const session = sessionRef.current;
      sessionRef.current = null;
      void session?.stop().catch(() => undefined);
    };
  }, []);

  // Guard the parser: a malformed phrase must not break rendering.
  const parsed = useMemo(() => {
    if (!text.trim()) return [];
    try {
      return parseBanglaItems(text);
    } catch {
      return [];
    }
  }, [text]);

  /** Resolve a parsed phrase against the catalog and the current mode. */
  const resolve = useCallback(
    (p: ParsedItem): SmartAddItem => {
      const matched = rankByName(p.name, catalog, 45)[0];
      // Price precedence: an explicit spoken cost/sale, else the catalog price
      // for this context, else the single spoken price.
      let price: number | null = null;
      let cost: number | null = null;

      if (mode === "purchase") {
        price =
          p.purchase_price ??
          p.unit_price ??
          (matched ? Number(matched.purchase_price) : null);
        cost = price;
      } else if (mode === "sale") {
        price =
          p.sale_price ??
          p.unit_price ??
          (matched ? Number(matched.sale_price) : null);
        cost =
          p.purchase_price ??
          (matched ? Number(matched.cost_price ?? matched.purchase_price) : null);
      } else {
        // Adding a product to the catalog: cost and sale are both meaningful.
        price = p.unit_price ?? (matched ? Number(matched.sale_price) : null);
        cost =
          p.purchase_price ??
          (matched ? Number(matched.cost_price ?? matched.purchase_price) : null);
      }

      return {
        ...p,
        matched,
        price,
        cost: cost ?? null,
      };
    },
    [catalog, mode],
  );

  const resolved = useMemo(() => parsed.map(resolve), [parsed, resolve]);

  const suggestions = useMemo(() => {
    if (!text.trim()) return [];
    const q = parsed[0]?.name ?? text;
    if (!q.trim()) return [];
    return rankByName(q, catalog, 40).slice(0, 4);
  }, [text, parsed, catalog]);

  const handleAdd = useCallback(() => {
    if (resolved.length === 0) {
      toast.error(t("addAtLeastOneItem"));
      return;
    }
    const usable = resolved.filter((r) => r.name.trim().length > 0);
    if (usable.length === 0) {
      toast.error(t("addAtLeastOneItem"));
      return;
    }
    onSubmit(usable);
    setText("");
  }, [resolved, onSubmit, t]);

  const voiceReady = speech?.available === true;

  const toggleListening = useCallback(async () => {
    // Prevent double-taps from starting two native sessions (crash-prone).
    if (listenLockRef.current) return;
    listenLockRef.current = true;

    try {
      if (listening) {
        try {
          await sessionRef.current?.stop();
        } catch {
          /* ignore */
        }
        sessionRef.current = null;
        setListening(false);
        return;
      }

      // Not an error — just explain, briefly, and keep the field usable.
      if (!voiceReady) {
        toast.info(t("voiceUnavailable"));
        return;
      }

      // Blur + dismiss before native STT — TextInput focus + AVAudioSession
      // category changes is a known iOS crash path.
      try {
        inputRef.current?.blur();
        Keyboard.dismiss();
      } catch {
        /* ignore */
      }

      setListening(true);
      const session = await startListening({
        onResult: (r) => {
          // Append so several items can be dictated in sequence.
          setText((prev) => (prev ? `${prev}, ${r.transcript}` : r.transcript));
        },
        onError: (msg) => {
          // Permission problems are actionable; everything else is informational.
          toast.error(
            /permission|অনুমতি|not-allowed/i.test(msg)
              ? t("voicePermissionNeeded")
              : msg,
          );
          setListening(false);
          sessionRef.current = null;
        },
        onEnd: () => {
          setListening(false);
          sessionRef.current = null;
        },
      });
      if (!session) {
        setListening(false);
        return;
      }
      sessionRef.current = session;
    } catch (e: any) {
      setListening(false);
      sessionRef.current = null;
      toast.error(e?.message ?? t("voiceUnavailable"));
    } finally {
      listenLockRef.current = false;
    }
  }, [listening, voiceReady, t]);

  const money = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Shown only for sales, where profit matters.
  const profitFor = (item: SmartAddItem) =>
    item.cost !== null && item.price !== null ? item.price - item.cost : null;

  return (
    <View style={{ marginBottom: 4 }}>
      {/* Input row */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          autoFocus={autoFocus}
          placeholder={placeholder ?? t("smartAddPlaceholder")}
          placeholderTextColor={colors.text.tertiary}
          multiline
          blurOnSubmit
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: text.trim() ? colors.info : colors.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 11,
            fontSize: 15,
            color: colors.text.primary,
            backgroundColor: colors.bg.secondary,
            maxHeight: 90,
            minHeight: 46,
          }}
        />
        <TouchableOpacity
          onPress={() => {
            void toggleListening();
          }}
          accessibilityRole="button"
          accessibilityState={{ disabled: !voiceReady, busy: listening }}
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            backgroundColor: listening
              ? colors.error + "20"
              : voiceReady
                ? colors.info + "12"
                : colors.bg.tertiary,
            borderColor: listening
              ? colors.error
              : voiceReady
                ? colors.info + "40"
                : colors.border,
          }}
        >
          {listening ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <Ionicons
              name={voiceReady ? "mic" : "mic-off"}
              size={22}
              color={voiceReady ? colors.info : colors.text.tertiary}
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleAdd}
          disabled={!text.trim()}
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: text.trim() ? colors.success : colors.bg.tertiary,
          }}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Voice state: one short line, never an alarming error. */}
      {voiceReady && banglaCaveat && !listening ? (
        <Text style={{ fontSize: 11, color: colors.warning, marginTop: 4 }}>
          {t("voiceBanglaMissing")}
        </Text>
      ) : null}
      {!voiceReady && speech && !listening ? (
        <Text style={{ fontSize: 11, color: colors.text.tertiary, marginTop: 4 }}>
          {t("voiceUnavailable")}
        </Text>
      ) : null}
      {listening ? (
        <Text style={{ fontSize: 12, color: colors.error, marginTop: 4 }}>
          {t("listeningTapToStop")}
        </Text>
      ) : null}

      {/* Live parse preview */}
      {resolved.length > 0 ? (
        <View style={{ marginTop: 8, gap: 6 }}>
          {resolved.map((item, index) => {
            const profit = profitFor(item);
            return (
              <View
                key={`${item.raw}-${index}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: colors.info + "12",
                  borderWidth: 1,
                  borderColor: colors.info + "30",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontWeight: "700",
                      color: colors.text.primary,
                    }}
                    numberOfLines={1}
                  >
                    {item.name || "—"}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.text.secondary }}>
                    {[
                      item.quantity !== null && item.unit
                        ? `${item.quantity} ${item.unit}`
                        : item.quantity !== null
                          ? String(item.quantity)
                          : null,
                      item.price !== null ? `${money(item.price)}` : null,
                      profit !== null
                        ? `${profit >= 0 ? "+" : ""}${money(profit)} ${t("profit")}`
                        : null,
                      item.matched ? t("matchedExisting") : t("willCreateNew"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                {item.confidence === "low" ? (
                  <Ionicons
                    name="alert-circle-outline"
                    size={16}
                    color={colors.warning}
                  />
                ) : null}
              </View>
            );
          })}
          {resolved.some((r) => r.pricingAmbiguous) ? (
            <Text style={{ fontSize: 11, color: colors.warning }}>
              {t("pricingOrderAssumed")}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Existing-product suggestions (pick instead of re-typing) */}
      {suggestions.length > 0 && onPickExisting ? (
        <View style={{ marginTop: 8 }}>
          <Text
            style={{
              fontSize: 11,
              color: colors.text.tertiary,
              marginBottom: 4,
            }}
          >
            {t("pickExisting")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {suggestions.map((p) => (
              <TouchableOpacity
                key={p._id}
                onPress={() => {
                  onPickExisting(p);
                  setText("");
                }}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: colors.success + "15",
                  borderWidth: 1,
                  borderColor: colors.success + "40",
                }}
              >
                <Text style={{ fontSize: 12, color: colors.success }}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
