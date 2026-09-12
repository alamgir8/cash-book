import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  ScrollView,
  Alert,
  type TextInput as TextInputType,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "@/hooks/use-theme";
import { useActiveOrgId } from "@/hooks/use-organization";
import { useCreateProduct } from "@/hooks/use-products";
import { BarcodeScannerModal } from "@/components/invoices/barcode-scanner-modal";
import { ScreenHeader } from "@/components/screen-header";
import {
  PRODUCT_UNIT_VALUES,
  createProductFormSchema,
  type ProductFormData,
} from "@/lib/validations/shop";
import {
  amountInputProps,
  normalizeAmountInput,
  parseAmountInput,
} from "@/lib/amount-input";
import { useKeyboardFooterLift } from "@/hooks/use-keyboard-footer-lift";
import { toast } from "@/lib/toast";
import {
  SmartAddBar,
  type SmartAddItem,
} from "@/components/shop/smart-add-bar";
import { useTranslation } from "@/hooks/use-translation";
import {
  extractBrandFromName,
  suggestBrandsForProduct,
  type UnifiedSuggestion,
} from "@/lib/voice/lexicon";
import type { Product } from "@/types/product";

type GuidedField =
  | "name"
  | "brand"
  | "unit"
  | "purchase_price"
  | "sale_price"
  | "opening_stock"
  | "barcode"
  | "sku";

const FIELD_ORDER: GuidedField[] = [
  "name",
  "brand",
  "unit",
  "purchase_price",
  "sale_price",
  "opening_stock",
  "barcode",
  "sku",
];

export default function CreateProductScreen() {
  const { colors } = useTheme();
  const { t, language } = useTranslation();
  const { footerContainerStyle, scrollProps } = useKeyboardFooterLift();
  const router = useRouter();
  const organizationId = useActiveOrgId();
  const [scannerVisible, setScannerVisible] = useState(false);
  const [guidedField, setGuidedField] = useState<GuidedField>("name");
  const [smartText, setSmartText] = useState("");

  const nameRef = useRef<TextInputType>(null);
  const brandRef = useRef<TextInputType>(null);
  const purchaseRef = useRef<TextInputType>(null);
  const saleRef = useRef<TextInputType>(null);
  const stockRef = useRef<TextInputType>(null);
  const barcodeRef = useRef<TextInputType>(null);
  const skuRef = useRef<TextInputType>(null);

  const schema = useMemo(() => createProductFormSchema(t), [language]);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      brand: "",
      sku: "",
      barcode: "",
      description: "",
      unit: "pcs",
      purchase_price: "",
      additional_cost: "",
      sale_price: "",
      tax_rate: "0",
      opening_stock: "0",
      low_stock_threshold: "0",
      track_inventory: true,
    },
  });

  const trackInventory = watch("track_inventory");
  const unit = watch("unit");
  const productName = watch("name");

  const mutation = useCreateProduct({
    onSuccess: () => router.back(),
  });

  const handleScan = useCallback(
    (scannedBarcode: string) => {
      setValue("barcode", scannedBarcode, { shouldValidate: true });
      setScannerVisible(false);
    },
    [setValue],
  );

  const focusField = useCallback((field: GuidedField) => {
    setGuidedField(field);
    requestAnimationFrame(() => {
      switch (field) {
        case "name":
          nameRef.current?.focus();
          break;
        case "brand":
          brandRef.current?.focus();
          break;
        case "purchase_price":
          purchaseRef.current?.focus();
          break;
        case "sale_price":
          saleRef.current?.focus();
          break;
        case "opening_stock":
          stockRef.current?.focus();
          break;
        case "barcode":
          barcodeRef.current?.focus();
          break;
        case "sku":
          skuRef.current?.focus();
          break;
        default:
          break;
      }
    });
  }, []);

  const advanceField = useCallback(() => {
    const idx = FIELD_ORDER.indexOf(guidedField);
    const next = FIELD_ORDER[Math.min(idx + 1, FIELD_ORDER.length - 1)];
    if (next === guidedField) {
      toast.info(t("saveProduct"));
      return;
    }
    // Seed smart bar text from the next field's current value.
    const vals = getValues();
    if (next === "brand") setSmartText(String(vals.brand ?? ""));
    else if (next === "name") setSmartText(String(vals.name ?? ""));
    else if (next === "purchase_price")
      setSmartText(String(vals.purchase_price ?? ""));
    else if (next === "sale_price") setSmartText(String(vals.sale_price ?? ""));
    else if (next === "opening_stock")
      setSmartText(String(vals.opening_stock ?? ""));
    else if (next === "barcode") setSmartText(String(vals.barcode ?? ""));
    else if (next === "sku") setSmartText(String(vals.sku ?? ""));
    else setSmartText("");
    focusField(next);
  }, [guidedField, focusField, getValues, t]);

  const fillFromProduct = useCallback(
    (p: Product) => {
      setValue("name", p.name, { shouldValidate: true });
      setValue("brand", (p as any).brand ?? extractBrandFromName(p.name) ?? "", {
        shouldValidate: true,
      });
      setValue("sku", p.sku ?? "");
      setValue("barcode", p.barcode ?? "");
      setValue("description", p.description ?? "");
      if (
        p.unit &&
        (PRODUCT_UNIT_VALUES as readonly string[]).includes(p.unit)
      ) {
        setValue("unit", p.unit as (typeof PRODUCT_UNIT_VALUES)[number]);
      }
      setValue("purchase_price", String(p.purchase_price ?? ""));
      setValue("additional_cost", String(p.additional_cost ?? ""));
      setValue("sale_price", String(p.sale_price ?? ""));
      setValue("tax_rate", String(p.tax_rate ?? "0"));
      setValue("opening_stock", String(p.current_stock ?? p.opening_stock ?? "0"));
      setValue("low_stock_threshold", String(p.low_stock_threshold ?? "0"));
      setValue("track_inventory", p.track_inventory ?? true);
      setSmartText(p.name);
      focusField("brand");
    },
    [setValue, focusField],
  );

  /** Fill / replace from a smart suggestion (existing or new). */
  const applySuggestion = useCallback(
    ({
      suggestion,
      item,
      product,
    }: {
      suggestion: UnifiedSuggestion;
      item: SmartAddItem;
      product?: Product;
    }) => {
      if (guidedField === "brand") {
        setValue("brand", suggestion.name, { shouldValidate: true });
        setSmartText(suggestion.name);
        return;
      }

      if (product) {
        fillFromProduct(product);
        return;
      }

      // Lexicon / new name — replace current selection.
      setValue("name", item.name, { shouldValidate: true });
      const inferred = extractBrandFromName(item.name);
      if (inferred) setValue("brand", inferred);
      if (
        item.unit &&
        (PRODUCT_UNIT_VALUES as readonly string[]).includes(item.unit)
      ) {
        setValue("unit", item.unit as (typeof PRODUCT_UNIT_VALUES)[number]);
      }
      if (item.quantity !== null) {
        setValue("opening_stock", String(item.quantity));
      }
      if (item.sale_price !== null) {
        setValue("sale_price", String(item.sale_price));
      } else if (item.unit_price !== null && item.purchase_price === null) {
        setValue("sale_price", String(item.unit_price));
      }
      if (item.purchase_price !== null) {
        setValue("purchase_price", String(item.purchase_price));
      }
      setSmartText(item.name);
    },
    [guidedField, fillFromProduct, setValue],
  );

  const applySmartItem = useCallback(
    (items: SmartAddItem[]) => {
      const item = items[0];
      if (!item) return;
      if (item.matched) {
        fillFromProduct(item.matched);
        return;
      }
      applySuggestion({
        suggestion: {
          label: item.name,
          name: item.name,
          source: "lexicon",
          score: 80,
        },
        item,
      });
    },
    [applySuggestion, fillFromProduct],
  );

  const brandSuggestions = useMemo(() => {
    if (guidedField !== "brand") return undefined;
    return suggestBrandsForProduct(productName || smartText, {
      query: smartText,
      limit: 10,
    });
  }, [guidedField, productName, smartText]);

  const onSubmit = useCallback(
    (data: ProductFormData) => {
      mutation.mutate({
        organization: organizationId || undefined,
        name: data.name.trim(),
        brand: data.brand?.trim() || undefined,
        sku: data.sku?.trim() || undefined,
        barcode: data.barcode?.trim() || undefined,
        description: data.description?.trim() || undefined,
        unit: data.unit,
        purchase_price: parseAmountInput(data.purchase_price),
        additional_cost: parseAmountInput(data.additional_cost),
        sale_price: parseAmountInput(data.sale_price),
        tax_rate: parseAmountInput(data.tax_rate),
        current_stock: parseAmountInput(data.opening_stock),
        low_stock_threshold: parseAmountInput(data.low_stock_threshold),
        track_inventory: data.track_inventory,
      });
    },
    [mutation, organizationId],
  );

  const smartPlaceholder =
    guidedField === "brand"
      ? t("brandPlaceholder")
      : guidedField === "name"
        ? t("smartAddPlaceholder")
        : t("speakOrType");

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title={t("addProduct")}
        showBack
        icon="help-circle-outline"
        onIconPress={() =>
          Alert.alert(
            t("speakOrType"),
            [
              t("smartAddPlaceholder"),
              "",
              t("suggestProducts") + " → " + t("suggestBrands"),
              "",
              t("voiceBanglaMissing"),
            ].join("\n"),
          )
        }
      />

      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <Text
          style={{
            fontSize: 11,
            color: colors.text.tertiary,
            marginBottom: 4,
            fontWeight: "600",
          }}
        >
          {guidedField === "brand"
            ? t("suggestBrands")
            : guidedField === "name"
              ? t("suggestProducts")
              : t(guidedField === "unit" ? "unit" : "speakOrType")}
        </Text>
        <SmartAddBar
          mode="product"
          organizationId={organizationId}
          onSubmit={applySmartItem}
          onApplySuggestion={applySuggestion}
          onPlusPress={advanceField}
          hideParsePreview
          compactHints
          value={smartText}
          onChangeText={(txt) => {
            setSmartText(txt);
            if (guidedField === "name") {
              setValue("name", txt, { shouldValidate: false });
            } else if (guidedField === "brand") {
              setValue("brand", txt, { shouldValidate: false });
            } else if (guidedField === "purchase_price") {
              setValue("purchase_price", normalizeAmountInput(txt));
            } else if (guidedField === "sale_price") {
              setValue("sale_price", normalizeAmountInput(txt));
            } else if (guidedField === "opening_stock") {
              setValue("opening_stock", normalizeAmountInput(txt));
            } else if (guidedField === "barcode") {
              setValue("barcode", txt);
            } else if (guidedField === "sku") {
              setValue("sku", txt);
            }
          }}
          externalSuggestions={brandSuggestions}
          suggestionsLabel={
            guidedField === "brand" ? t("suggestBrands") : t("suggestProducts")
          }
          placeholder={smartPlaceholder}
        />
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        {...scrollProps}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 24,
        }}
      >
        <SectionTitle title="Basic Information" colors={colors} />

        <Field
          label={`${t("productName")} *`}
          colors={colors}
          error={errors.name?.message}
          active={guidedField === "name"}
        >
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                ref={nameRef}
                style={inputStyle(colors, !!errors.name, guidedField === "name")}
                value={value}
                onChangeText={(v) => {
                  onChange(v);
                  if (guidedField === "name") setSmartText(v);
                }}
                onFocus={() => {
                  setGuidedField("name");
                  setSmartText(value || "");
                }}
                onBlur={onBlur}
                placeholder={t("productNamePlaceholder")}
                placeholderTextColor={colors.text.tertiary}
              />
            )}
          />
        </Field>

        <Field
          label={t("brandOptional")}
          colors={colors}
          error={errors.brand?.message}
          active={guidedField === "brand"}
        >
          <Controller
            control={control}
            name="brand"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                ref={brandRef}
                style={inputStyle(
                  colors,
                  !!errors.brand,
                  guidedField === "brand",
                )}
                value={value}
                onChangeText={(v) => {
                  onChange(v);
                  if (guidedField === "brand") setSmartText(v);
                }}
                onFocus={() => {
                  setGuidedField("brand");
                  setSmartText(value || "");
                }}
                onBlur={onBlur}
                placeholder={t("brandPlaceholder")}
                placeholderTextColor={colors.text.tertiary}
              />
            )}
          />
        </Field>

        <SectionTitle title={t("unit")} colors={colors} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          onTouchStart={() => setGuidedField("unit")}
        >
          {PRODUCT_UNIT_VALUES.map((u) => (
            <TouchableOpacity
              key={u}
              onPress={() => {
                setValue("unit", u);
                setGuidedField("unit");
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1,
                borderColor:
                  unit === u
                    ? colors.info
                    : guidedField === "unit"
                      ? colors.info + "50"
                      : colors.border,
                backgroundColor:
                  unit === u ? colors.info + "18" : colors.bg.secondary,
              }}
            >
              <Text
                style={{
                  color: unit === u ? colors.info : colors.text.primary,
                  fontWeight: unit === u ? "700" : "500",
                }}
              >
                {u}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <SectionTitle title={t("pricing")} colors={colors} />

        <View style={{ flexDirection: "row", gap: 12 }}>
          <Field
            label={t("purchasePrice")}
            colors={colors}
            style={{ flex: 1 }}
            error={errors.purchase_price?.message}
            active={guidedField === "purchase_price"}
          >
            <Controller
              control={control}
              name="purchase_price"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  ref={purchaseRef}
                  style={inputStyle(
                    colors,
                    !!errors.purchase_price,
                    guidedField === "purchase_price",
                  )}
                  value={value}
                  onChangeText={(v) => {
                    const n = normalizeAmountInput(v);
                    onChange(n);
                    if (guidedField === "purchase_price") setSmartText(n);
                  }}
                  onFocus={() => {
                    setGuidedField("purchase_price");
                    setSmartText(value || "");
                  }}
                  onBlur={onBlur}
                  placeholder="0"
                  placeholderTextColor={colors.text.tertiary}
                  {...amountInputProps}
                />
              )}
            />
          </Field>
          <Field
            label={t("salePrice")}
            colors={colors}
            style={{ flex: 1 }}
            error={errors.sale_price?.message}
            active={guidedField === "sale_price"}
          >
            <Controller
              control={control}
              name="sale_price"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  ref={saleRef}
                  style={inputStyle(
                    colors,
                    !!errors.sale_price,
                    guidedField === "sale_price",
                  )}
                  value={value}
                  onChangeText={(v) => {
                    const n = normalizeAmountInput(v);
                    onChange(n);
                    if (guidedField === "sale_price") setSmartText(n);
                  }}
                  onFocus={() => {
                    setGuidedField("sale_price");
                    setSmartText(value || "");
                  }}
                  onBlur={onBlur}
                  placeholder="0"
                  placeholderTextColor={colors.text.tertiary}
                  {...amountInputProps}
                />
              )}
            />
          </Field>
        </View>

        <Field
          label={t("additionalCost")}
          colors={colors}
          error={errors.additional_cost?.message}
        >
          <Controller
            control={control}
            name="additional_cost"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={inputStyle(colors, !!errors.additional_cost)}
                value={value}
                onChangeText={(v) => onChange(normalizeAmountInput(v))}
                onBlur={onBlur}
                placeholder="0"
                placeholderTextColor={colors.text.tertiary}
                {...amountInputProps}
              />
            )}
          />
        </Field>

        <Field
          label={t("taxRate")}
          colors={colors}
          error={errors.tax_rate?.message}
        >
          <Controller
            control={control}
            name="tax_rate"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={inputStyle(colors, !!errors.tax_rate)}
                value={value}
                onChangeText={(v) => onChange(normalizeAmountInput(v))}
                onBlur={onBlur}
                placeholder="0"
                placeholderTextColor={colors.text.tertiary}
                {...amountInputProps}
              />
            )}
          />
        </Field>

        <SectionTitle title={t("inventory")} colors={colors} />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <Text style={{ color: colors.text.primary, fontWeight: "600" }}>
            {t("trackInventory")}
          </Text>
          <Controller
            control={control}
            name="track_inventory"
            render={({ field: { onChange, value } }) => (
              <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{ true: colors.info }}
              />
            )}
          />
        </View>

        {trackInventory ? (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Field
              label={t("openingStock")}
              colors={colors}
              style={{ flex: 1 }}
              error={errors.opening_stock?.message}
              active={guidedField === "opening_stock"}
            >
              <Controller
                control={control}
                name="opening_stock"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    ref={stockRef}
                    style={inputStyle(
                      colors,
                      !!errors.opening_stock,
                      guidedField === "opening_stock",
                    )}
                    value={value}
                    onChangeText={(v) => {
                      const n = normalizeAmountInput(v);
                      onChange(n);
                      if (guidedField === "opening_stock") setSmartText(n);
                    }}
                    onFocus={() => {
                      setGuidedField("opening_stock");
                      setSmartText(value || "");
                    }}
                    onBlur={onBlur}
                    placeholder="0"
                    placeholderTextColor={colors.text.tertiary}
                    {...amountInputProps}
                  />
                )}
              />
            </Field>
            <Field
              label={t("lowStockAlert")}
              colors={colors}
              style={{ flex: 1 }}
              error={errors.low_stock_threshold?.message}
            >
              <Controller
                control={control}
                name="low_stock_threshold"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={inputStyle(colors, !!errors.low_stock_threshold)}
                    value={value}
                    onChangeText={(v) => onChange(normalizeAmountInput(v))}
                    onBlur={onBlur}
                    placeholder="0"
                    placeholderTextColor={colors.text.tertiary}
                    {...amountInputProps}
                  />
                )}
              />
            </Field>
          </View>
        ) : null}

        <Field
          label={t("barcodeOptional")}
          colors={colors}
          error={errors.barcode?.message}
          active={guidedField === "barcode"}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Controller
              control={control}
              name="barcode"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  ref={barcodeRef}
                  style={[
                    inputStyle(
                      colors,
                      !!errors.barcode,
                      guidedField === "barcode",
                    ),
                    { flex: 1 },
                  ]}
                  value={value}
                  onChangeText={(v) => {
                    onChange(v);
                    if (guidedField === "barcode") setSmartText(v);
                  }}
                  onFocus={() => {
                    setGuidedField("barcode");
                    setSmartText(value || "");
                  }}
                  onBlur={onBlur}
                  placeholder={t("barcodePlaceholder")}
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="default"
                />
              )}
            />
            <TouchableOpacity
              onPress={() => setScannerVisible(true)}
              style={{
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: colors.info + "18",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.info + "40",
              }}
            >
              <Ionicons name="barcode-outline" size={24} color={colors.info} />
            </TouchableOpacity>
          </View>
        </Field>

        <Field
          label={t("skuAutoHint")}
          colors={colors}
          error={errors.sku?.message}
          active={guidedField === "sku"}
        >
          <Controller
            control={control}
            name="sku"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                ref={skuRef}
                style={inputStyle(colors, !!errors.sku, guidedField === "sku")}
                value={value}
                onChangeText={(v) => {
                  onChange(v);
                  if (guidedField === "sku") setSmartText(v);
                }}
                onFocus={() => {
                  setGuidedField("sku");
                  setSmartText(value || "");
                }}
                onBlur={onBlur}
                placeholder="e.g. RICE001"
                placeholderTextColor={colors.text.tertiary}
                autoCapitalize="characters"
              />
            )}
          />
        </Field>

        <Field
          label={t("description")}
          colors={colors}
          error={errors.description?.message}
        >
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[
                  inputStyle(colors, !!errors.description),
                  { height: 72, textAlignVertical: "top" },
                ]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Optional notes about this product"
                placeholderTextColor={colors.text.tertiary}
                multiline
              />
            )}
          />
        </Field>
      </KeyboardAwareScrollView>

      <View
        style={{
          ...footerContainerStyle,
          borderTopColor: colors.border,
          backgroundColor: colors.bg.primary,
        }}
      >
        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          disabled={mutation.isPending}
          className="rounded-2xl py-4 items-center shadow-lg"
          style={{
            backgroundColor: colors.info,
            opacity: mutation.isPending ? 0.7 : 1,
          }}
        >
          {mutation.isPending ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator color="#fff" />
              <Text className="text-white font-bold text-base">{t("saving")}</Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <Text className="text-white font-bold text-base">
                {t("saveProduct")}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScan}
        title={t("scanProductBarcode")}
      />
    </View>
  );
}

function SectionTitle({ title, colors }: { title: string; colors: any }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: "700",
        color: colors.text.tertiary,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        marginTop: 12,
        marginBottom: 10,
      }}
    >
      {title}
    </Text>
  );
}

function Field({
  label,
  children,
  colors,
  style,
  error,
  active,
}: {
  label: string;
  children: React.ReactNode;
  colors: any;
  style?: object;
  error?: string;
  active?: boolean;
}) {
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      <Text
        className="text-sm font-semibold mb-2"
        style={{
          color: active ? colors.info : colors.text.primary,
        }}
      >
        {label}
        {active ? "  ←" : ""}
      </Text>
      {children}
      {error ? (
        <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const inputStyle = (colors: any, hasError = false, active = false) => ({
  backgroundColor: colors.bg.tertiary,
  borderRadius: 12,
  borderWidth: active ? 2 : 1,
  borderColor: hasError
    ? colors.error
    : active
      ? colors.info
      : colors.border,
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 16,
  color: colors.text.primary,
  minHeight: 48,
});
