import React, { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "@/lib/toast";
import {
  Controller,
  Control,
  FieldErrors,
  UseFormGetValues,
  UseFormSetValue,
} from "react-hook-form";
import type { InvoiceFormData } from "@/lib/validations/invoice";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";
import { BarcodeScannerModal } from "./barcode-scanner-modal";
import { ProductSearchModal } from "./product-search-modal";
import { QuickCreateProductModal } from "./quick-create-product-modal";
import { useActiveOrgId } from "@/hooks/use-organization";
import type { Product } from "@/types/product";
import { lookupBarcode, formatLookupResult } from "@/lib/barcode-lookup";
import { dalFindProductByBarcode } from "@/data/products";
import { isMongoObjectId } from "@/lib/invoice-utils";

interface LineItemFieldsProps {
  control: Control<InvoiceFormData>;
  index: number;
  errors: FieldErrors<InvoiceFormData>;
  onRemove: () => void;
  canRemove: boolean;
  onCalculateTotal: (
    quantity: string | number,
    unitPrice: string | number,
    taxRate?: string | number,
  ) => number;
  setValue: UseFormSetValue<InvoiceFormData>;
  getValues: UseFormGetValues<InvoiceFormData>;
  invoiceType?: "sale" | "purchase";
}

export function LineItemFields({
  control,
  index,
  errors,
  onRemove,
  canRemove,
  onCalculateTotal,
  setValue,
  getValues,
  invoiceType,
}: LineItemFieldsProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const organizationId = useActiveOrgId();

  const [scannerVisible, setScannerVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [unmatched, setUnmatched] = useState<{
    barcode: string;
    name?: string;
  } | null>(null);
  const [quickCreateVisible, setQuickCreateVisible] = useState(false);

  /** Server-side product link (only when the product exists on the backend). */
  const serverProductIdFor = useCallback((product: Product) => {
    if (isMongoObjectId(product.server_id)) return product.server_id;
    if (isMongoObjectId(product._id)) return product._id;
    return "";
  }, []);

  const fillFromProduct = useCallback(
    (product: Product) => {
      setValue(`items.${index}.description`, product.name);
      const price =
        invoiceType === "purchase"
          ? product.purchase_price
          : product.sale_price;
      setValue(`items.${index}.unit_price`, String(price ?? 0));
      setValue(`items.${index}.tax_rate`, String(product.tax_rate ?? 0));
      setValue(`items.${index}.unit`, product.unit);
      setValue(`items.${index}.barcode`, product.barcode ?? "");
      // Local UUID drives qty merge; server id is what the API can link.
      setValue(`items.${index}.local_product_id`, product._id);
      setValue(`items.${index}.product`, serverProductIdFor(product));
    },
    [index, invoiceType, setValue, serverProductIdFor],
  );

  const bumpQuantity = useCallback(
    (idx: number) => {
      const items = getValues("items") ?? [];
      const current = parseFloat(String(items[idx]?.quantity ?? "1")) || 0;
      setValue(`items.${idx}.quantity`, String(current + 1));
    },
    [getValues, setValue],
  );

  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      setScannerVisible(false);
      setScanLoading(true);
      const code = barcode.trim();
      try {
        // 1) Local catalog first — instant, offline, no external call.
        const local = await dalFindProductByBarcode(
          code,
          organizationId ?? undefined,
        );
        if (local) {
          const items = getValues("items") ?? [];
          const isCurrentEmpty = !String(
            items[index]?.description ?? "",
          ).trim();
          const sameIdx = items.findIndex(
            (it) => it.local_product_id === local._id,
          );
          // Same barcode rescanned → qty++ on the existing line.
          if (sameIdx >= 0 && (sameIdx === index || isCurrentEmpty)) {
            bumpQuantity(sameIdx);
            toast.success(`${local.name} qty +1`);
          } else {
            fillFromProduct(local);
            setValue(`items.${index}.quantity`, "1");
            toast.success(`Added ${local.name}`);
          }
          setUnmatched(null);
          return;
        }

        // 2) Optional free external lookup — never required.
        const ext = await lookupBarcode(code).catch(() => null);
        if (ext) {
          setValue(
            `items.${index}.description`,
            formatLookupResult(ext),
          );
          setUnmatched({ barcode: code, name: ext.name });
        } else {
          setValue(`items.${index}.description`, code);
          setUnmatched({ barcode: code });
        }
        setValue(`items.${index}.barcode`, code);
      } catch {
        toast.error("Barcode lookup failed");
      } finally {
        setScanLoading(false);
      }
    },
    [
      index,
      getValues,
      setValue,
      fillFromProduct,
      bumpQuantity,
      organizationId,
    ],
  );

  return (
    <View
      className="mb-4 p-4 rounded-xl border"
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
      }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <View
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.info + "20" }}
          >
            <Text
              className="font-semibold text-sm"
              style={{ color: colors.info }}
            >
              {index + 1}
            </Text>
          </View>
          {/* Scan barcode */}
          <TouchableOpacity
            onPress={() => setScannerVisible(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: colors.info + "15",
              borderWidth: 1,
              borderColor: colors.info + "40",
            }}
          >
            <Ionicons name="barcode-outline" size={15} color={colors.info} />
            <Text
              style={{ fontSize: 12, color: colors.info, fontWeight: "600" }}
            >
              {t("scan")}
            </Text>
          </TouchableOpacity>
          {/* Search product */}
          <TouchableOpacity
            onPress={() => setSearchVisible(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: colors.success + "15",
              borderWidth: 1,
              borderColor: colors.success + "40",
            }}
          >
            <Ionicons name="search-outline" size={15} color={colors.success} />
            <Text
              style={{ fontSize: 12, color: colors.success, fontWeight: "600" }}
            >
              {t("products")}
            </Text>
          </TouchableOpacity>
        </View>
        {canRemove && (
          <TouchableOpacity
            onPress={onRemove}
            className="w-8 h-8 rounded-full bg-rose-100 items-center justify-center"
          >
            <Ionicons name="trash-outline" size={16} color="#f43f5e" />
          </TouchableOpacity>
        )}
      </View>

      {/* Description */}
      <Controller
        control={control}
        name={`items.${index}.description`}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={
              scanLoading ? "Looking up product…" : t("description")
            }
            editable={!scanLoading}
            placeholderTextColor={colors.inputPlaceholder}
            className="border rounded-xl px-4 py-3 text-base mb-3"
            style={{
              backgroundColor: colors.bg.primary,
              borderColor: errors.items?.[index]?.description
                ? colors.error
                : colors.inputBorder,
              color: colors.text.primary,
            }}
          />
        )}
      />
      {errors.items?.[index]?.description && (
        <Text className="text-sm mb-2 -mt-2" style={{ color: colors.error }}>
          {errors.items[index]?.description?.message}
        </Text>
      )}

      {/* Quantity and Unit Price */}
      <View className="flex-row gap-2 mb-3">
        <View className="flex-1">
          <Text
            className="text-xs mb-1.5"
            style={{ color: colors.text.secondary }}
          >
            {t("quantity")}
          </Text>
          <Controller
            control={control}
            name={`items.${index}.quantity`}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="1"
                placeholderTextColor={colors.inputPlaceholder}
                keyboardType="decimal-pad"
                className="border rounded-xl px-4 py-3 text-base"
                style={{
                  backgroundColor: colors.bg.primary,
                  borderColor: errors.items?.[index]?.quantity
                    ? colors.error
                    : colors.inputBorder,
                  color: colors.text.primary,
                }}
              />
            )}
          />
        </View>
        <View className="flex-1">
          <Text
            className="text-xs mb-1.5"
            style={{ color: colors.text.secondary }}
          >
            Unit Price
          </Text>
          <Controller
            control={control}
            name={`items.${index}.unit_price`}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="0.00"
                placeholderTextColor={colors.inputPlaceholder}
                keyboardType="decimal-pad"
                className="border rounded-xl px-4 py-3 text-base"
                style={{
                  backgroundColor: colors.bg.primary,
                  borderColor: errors.items?.[index]?.unit_price
                    ? colors.error
                    : colors.inputBorder,
                  color: colors.text.primary,
                }}
              />
            )}
          />
        </View>
      </View>

      {/* Tax Rate */}
      <View className="mb-3">
        <Text
          className="text-xs mb-1.5"
          style={{ color: colors.text.secondary }}
        >
          {t("taxRate")}
        </Text>
        <Controller
          control={control}
          name={`items.${index}.tax_rate`}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="0"
              placeholderTextColor={colors.inputPlaceholder}
              keyboardType="decimal-pad"
              className="border rounded-xl px-4 py-3 text-base"
              style={{
                backgroundColor: colors.bg.primary,
                borderColor: colors.inputBorder,
                color: colors.text.primary,
              }}
            />
          )}
        />
      </View>

      {/* Scan loading hint */}
      {scanLoading && (
        <View
          className="flex-row items-center justify-center py-2 mb-3 rounded-xl"
          style={{ backgroundColor: colors.info + "15" }}
        >
          <Ionicons name="barcode-outline" size={15} color={colors.info} />
          <Text
            className="text-xs ml-2 font-medium"
            style={{ color: colors.info }}
          >
            Looking up product…
          </Text>
        </View>
      )}

      {/* Line Total */}
      <Controller
        control={control}
        name={`items.${index}`}
        render={({ field: { value } }) => {
          const total = onCalculateTotal(
            value.quantity || "0",
            value.unit_price || "0",
            value.tax_rate || "0",
          );
          return total > 0 ? (
            <View
              className="flex-row justify-between items-center pt-3 border-t"
              style={{ borderColor: colors.border }}
            >
              <Text
                className="text-sm"
                style={{ color: colors.text.secondary }}
              >
                Line Total
              </Text>
              <Text
                className="text-base font-bold"
                style={{ color: colors.info }}
              >
                {`৳${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </Text>
            </View>
          ) : null;
        }}
      />

      {/* Local-miss banner: offer to save the scanned barcode to the catalog */}
      {unmatched && (
        <TouchableOpacity
          onPress={() => setQuickCreateVisible(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: colors.warning + "15",
            borderWidth: 1,
            borderColor: colors.warning + "40",
            marginBottom: 10,
          }}
        >
          <Ionicons
            name="add-circle-outline"
            size={16}
            color={colors.warning}
          />
          <Text
            style={{ fontSize: 12, color: colors.warning, fontWeight: "600" }}
          >
            {t("notInCatalog")}
          </Text>
        </TouchableOpacity>
      )}

      {/* Modals */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleBarcodeScan}
        title={t("scanItemBarcode")}
      />
      <ProductSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelect={fillFromProduct}
        invoiceType={invoiceType}
      />
      <QuickCreateProductModal
        visible={quickCreateVisible}
        barcode={unmatched?.barcode ?? ""}
        initialName={unmatched?.name}
        invoiceType={invoiceType}
        organizationId={organizationId}
        onClose={() => setQuickCreateVisible(false)}
        onCreated={(product) => {
          fillFromProduct(product);
          setValue(`items.${index}.quantity`, "1");
          setUnmatched(null);
        }}
      />
    </View>
  );
}
