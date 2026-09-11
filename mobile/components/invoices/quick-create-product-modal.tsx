import React, { useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";
import { KeyboardAwareModal } from "@/components/keyboard-aware-modal";
import { dalCreateProduct } from "@/data/products";
import { toast } from "@/lib/toast";
import { getApiErrorMessage } from "@/lib/api";
import { amountInputProps, normalizeAmountInput, parseAmountInput } from "@/lib/amount-input";
import {
  PRODUCT_UNIT_VALUES,
  createQuickProductSchema,
  type QuickProductFormData,
} from "@/lib/validations/shop";
import type { Product } from "@/types/product";

interface QuickCreateProductModalProps {
  visible: boolean;
  barcode: string;
  initialName?: string;
  invoiceType?: "sale" | "purchase";
  organizationId?: string | null;
  onClose: () => void;
  onCreated: (product: Product) => void;
}

/**
 * Create a product inline when a scanned barcode isn't in the catalog.
 * Keeps the in-progress invoice form intact (no navigation).
 */
export function QuickCreateProductModal({
  visible,
  barcode,
  initialName,
  invoiceType = "sale",
  organizationId,
  onClose,
  onCreated,
}: QuickCreateProductModalProps) {
  const { colors } = useTheme();
  const { t, language } = useTranslation();

  const schema = useMemo(() => createQuickProductSchema(t), [language]);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<QuickProductFormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", price: "", unit: "pcs" },
  });

  const unit = watch("unit");

  useEffect(() => {
    if (visible) {
      reset({ name: initialName ?? "", price: "", unit: "pcs" });
    }
  }, [visible, initialName, reset]);

  const onSubmit = useCallback(
    async (data: QuickProductFormData) => {
      const value = parseAmountInput(data.price);
      try {
        const product = await dalCreateProduct({
          organization: organizationId || undefined,
          name: data.name.trim(),
          barcode: barcode.trim() || undefined,
          unit: data.unit,
          purchase_price: invoiceType === "purchase" ? value : 0,
          sale_price: invoiceType === "sale" ? value : 0,
        });
        toast.success(t("productCreated"));
        onCreated(product);
        onClose();
      } catch (e) {
        toast.error(getApiErrorMessage(e, "Could not create product"));
      }
    },
    [barcode, invoiceType, organizationId, onCreated, onClose, t],
  );

  return (
    <KeyboardAwareModal visible={visible} onClose={onClose} height="85%">
      <View style={{ padding: 20 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <Text
            style={{ fontSize: 18, fontWeight: "700", color: colors.text.primary }}
          >
            {t("newProduct")}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 13, color: colors.text.tertiary, marginBottom: 16 }}>
          {barcode ? `${t("barcode")} ${barcode}` : t("noBarcode")}
        </Text>

        <Field
          label={`${t("productName")} *`}
          colors={colors}
          error={errors.name?.message}
        >
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
          label={invoiceType === "purchase" ? t("purchasePrice") : t("salePrice")}
          colors={colors}
          error={errors.price?.message}
        >
          <Controller
            control={control}
            name="price"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={inputStyle(colors, !!errors.price)}
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
          label={t("unit")}
          colors={colors}
          error={errors.unit?.message}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
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
        </Field>

        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          style={{
            marginTop: 12,
            backgroundColor: colors.info,
            borderRadius: 14,
            paddingVertical: 15,
            alignItems: "center",
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              {t("createProductInline")}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAwareModal>
  );
}

function Field({
  label,
  children,
  colors,
  error,
}: {
  label: string;
  children: React.ReactNode;
  colors: any;
  error?: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: colors.text.primary,
          marginBottom: 6,
        }}
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
