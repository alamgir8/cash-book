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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";
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
export function SmartAddBar({
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
  const [speechReason, setSpeechReason] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const sessionRef = useRef<ListenSession | null>(null);

  // Load the catalog once so matches are instant (and offline).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await dalFetchProducts({
          organization: organizationId || undefined,
          limit: 500,
        });
        if (!cancelled) setCatalog(res.products ?? []);
      } catch {
        /* catalog optional — matching just won't suggest */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    void describeSpeechSupport().then((s) => {
      if (s.available) setSpeechReason(null);
      else setSpeechReason(s.reason);
    });
  }, []);

  const parsed = useMemo(() => parseBanglaItems(text), [text]);

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

  const toggleListening = useCallback(async () => {
    if (listening) {
      await sessionRef.current?.stop();
      sessionRef.current = null;
      setListening(false);
      return;
    }
    setListening(true);
    const session = await startListening({
      onResult: (r) => {
        // Append so several items can be dictated in sequence.
        setText((prev) => (prev ? `${prev}, ${r.transcript}` : r.transcript));
      },
      onError: (msg) => {
        toast.error(msg);
        setSpeechReason(msg);
      },
      onEnd: () => setListening(false),
    });
    if (!session) {
      setListening(false);
      return;
    }
    sessionRef.current = session;
  }, [listening]);

  const money = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Shown only for sales, where profit matters.
  const profitFor = (item: SmartAddItem) =>
    item.cost !== null && item.price !== null ? item.price - item.cost : null;

  return (
    <View style={{ marginBottom: 12 }}>
      {/* Input row */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TextInput
          value={text}
          onChangeText={setText}
          autoFocus={autoFocus}
          placeholder={placeholder ?? t("smartAddPlaceholder")}
          placeholderTextColor={colors.text.tertiary}
          multiline
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
          }}
        />
        <TouchableOpacity
          onPress={toggleListening}
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            backgroundColor: listening ? colors.error + "20" : colors.bg.secondary,
            borderColor: listening ? colors.error : colors.border,
          }}
        >
          {listening ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <Ionicons
              name="mic"
              size={22}
              color={speechReason ? colors.text.tertiary : colors.info}
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

      {/* Voice unavailable hint (typing still works) */}
      {speechReason && !listening ? (
        <Text style={{ fontSize: 11, color: colors.text.tertiary, marginTop: 4 }}>
          {speechReason}
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
