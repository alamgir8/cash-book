import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  ScrollView,
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

export default function CreateProductScreen() {
  const { colors } = useTheme();
  const { t, language } = useTranslation();
  const { footerContainerStyle, scrollProps } = useKeyboardFooterLift();
  const router = useRouter();
  const organizationId = useActiveOrgId();
  const [scannerVisible, setScannerVisible] = useState(false);

  // Schema factory is keyed on the language so messages follow the locale.
  const schema = useMemo(() => createProductFormSchema(t), [language]);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
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

  /** Fill the form from a spoken/typed phrase, e.g. "সাবান ২টা ৪৫ টাকা". */
  const applySmartItem = useCallback(
    (items: SmartAddItem[]) => {
      const item = items[0];
      if (!item) return;
      setValue("name", item.name);
      if (item.unit && (PRODUCT_UNIT_VALUES as readonly string[]).includes(item.unit)) {
        setValue("unit", item.unit as (typeof PRODUCT_UNIT_VALUES)[number]);
      }
      if (item.quantity !== null) {
        setValue("opening_stock", String(item.quantity));
      }
      // A single spoken price is treated as the SELLING price, since that is
      // what a price usually means for a catalog entry. Saying two prices
      // ("ক্রয় ৪০ বিক্রয় ৪৫") fills both explicitly.
      if (item.sale_price !== null) {
        setValue("sale_price", String(item.sale_price));
      } else if (item.unit_price !== null && item.purchase_price === null) {
        setValue("sale_price", String(item.unit_price));
      }
      if (item.purchase_price !== null) {
        setValue("purchase_price", String(item.purchase_price));
      }
      if (item.pricingAmbiguous) {
        toast.info(t("pricingOrderAssumed"));
      }
    },
    [setValue, t],
  );

  const onSubmit = useCallback(
    (data: ProductFormData) => {
      mutation.mutate({
        organization: organizationId || undefined,
        name: data.name.trim(),
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader title={t("addProduct")} showBack />

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        {...scrollProps}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      >
        {/* Speak or type the whole product in one line. */}
        <SmartAddBar
          mode="product"
          organizationId={organizationId}
          onSubmit={applySmartItem}
        />

        {/* Basic Info */}
        <SectionTitle title="Basic Information" colors={colors} />

        <Field label={`${t("productName")} *`} colors={colors} error={errors.name?.message}>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={inputStyle(colors, !!errors.name)}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t("productNamePlaceholder")}
                placeholderTextColor={colors.text.tertiary}
              />
            )}
          />
        </Field>

        <Field
          label={t("skuAutoHint")}
          colors={colors}
          error={errors.sku?.message}
        >
          <Controller
            control={control}
            name="sku"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={inputStyle(colors, !!errors.sku)}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="e.g. RICE001"
                placeholderTextColor={colors.text.tertiary}
                autoCapitalize="characters"
              />
            )}
          />
        </Field>

        <Field
          label={t("barcodeOptional")}
          colors={colors}
          error={errors.barcode?.message}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Controller
              control={control}
              name="barcode"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[inputStyle(colors, !!errors.barcode), { flex: 1 }]}
                  value={value}
                  onChangeText={onChange}
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

        {/* Unit */}
        <SectionTitle title={t("unit")} colors={colors} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        >
          {PRODUCT_UNIT_VALUES.map((u) => (
            <TouchableOpacity
              key={u}
              onPress={() => setValue("unit", u, { shouldValidate: true })}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: unit === u ? colors.info : colors.bg.secondary,
                borderWidth: 1,
                borderColor: unit === u ? colors.info : colors.border,
              }}
            >
              <Text
                style={{
                  color: unit === u ? "#fff" : colors.text.secondary,
                  fontWeight: "600",
                }}
              >
                {u}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Pricing */}
        <SectionTitle title={t("pricing")} colors={colors} />

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Field
            label={t("purchasePrice")}
            colors={colors}
            style={{ flex: 1 }}
            error={errors.purchase_price?.message}
          >
            <Controller
              control={control}
              name="purchase_price"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={inputStyle(colors, !!errors.purchase_price)}
                  value={value}
                  onChangeText={(t) => onChange(normalizeAmountInput(t))}
                  onBlur={onBlur}
                  placeholder="0.00"
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
          >
            <Controller
              control={control}
              name="sale_price"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={inputStyle(colors, !!errors.sale_price)}
                  value={value}
                  onChangeText={(t) => onChange(normalizeAmountInput(t))}
                  onBlur={onBlur}
                  placeholder="0.00"
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
                onChangeText={(t) => onChange(normalizeAmountInput(t))}
                onBlur={onBlur}
                placeholder="0.00"
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
                onChangeText={(t) => onChange(normalizeAmountInput(t))}
                onBlur={onBlur}
                placeholder="0"
                placeholderTextColor={colors.text.tertiary}
                {...amountInputProps}
              />
            )}
          />
        </Field>

        {/* Inventory */}
        <SectionTitle title={t("inventory")} colors={colors} />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.bg.secondary,
            borderRadius: 10,
            padding: 14,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.text.primary,
              }}
            >
              {t("trackInventory")}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.text.tertiary,
                marginTop: 2,
              }}
            >
              {t("trackInventoryHint")}
            </Text>
          </View>
          <Controller
            control={control}
            name="track_inventory"
            render={({ field: { onChange, value } }) => (
              <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{ true: colors.info, false: colors.border }}
                thumbColor={value ? "#fff" : "#aaa"}
              />
            )}
          />
        </View>

        {trackInventory && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Field
              label={t("openingStock")}
              colors={colors}
              style={{ flex: 1 }}
              error={errors.opening_stock?.message}
            >
              <Controller
                control={control}
                name="opening_stock"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={inputStyle(colors, !!errors.opening_stock)}
                    value={value}
                    onChangeText={(t) => onChange(normalizeAmountInput(t))}
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
                    onChangeText={(t) => onChange(normalizeAmountInput(t))}
                    onBlur={onBlur}
                    placeholder="0"
                    placeholderTextColor={colors.text.tertiary}
                    {...amountInputProps}
                  />
                )}
              />
            </Field>
          </View>
        )}
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

// ── Helpers ────────────────────────────────────────────────────────────────

function SectionTitle({ title, colors }: { title: string; colors: any }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: "700",
        color: colors.text.tertiary,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        marginTop: 20,
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
}: {
  label: string;
  children: React.ReactNode;
  colors: any;
  style?: object;
  error?: string;
}) {
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      <Text
        className="text-sm font-semibold mb-2"
        style={{ color: colors.text.primary }}
      >
        {label}
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

const inputStyle = (colors: any, hasError = false) => ({
  backgroundColor: colors.bg.tertiary,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: hasError ? colors.error : colors.border,
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 16,
  color: colors.text.primary,
  minHeight: 48,
});
