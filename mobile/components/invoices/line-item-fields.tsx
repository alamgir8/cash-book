import React, { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "@/lib/toast";
import {
  Controller,
  Control,
  FieldErrors,
  UseFormSetValue,
} from "react-hook-form";
import type { InvoiceFormData } from "@/lib/validations/invoice";
import { useTheme } from "@/hooks/use-theme";
import { BarcodeScannerModal } from "./barcode-scanner-modal";
import { ProductSearchModal } from "./product-search-modal";
import { useActiveOrgId } from "@/hooks/use-organization";
import type { Product } from "@/types/product";
import { lookupBarcode, formatLookupResult } from "@/lib/barcode-lookup";

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
  invoiceType,
}: LineItemFieldsProps) {
  const { colors } = useTheme();
  const organizationId = useActiveOrgId();

  const [scannerVisible, setScannerVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);

  const fillFromProduct = useCallback(
    (product: Product) => {
      setValue(`items.${index}.description`, product.name);
      const price =
        invoiceType === "purchase"
          ? product.purchase_price
          : product.sale_price;
      setValue(`items.${index}.unit_price`, String(price));
      setValue(`items.${index}.tax_rate`, String(product.tax_rate ?? 0));
      // Store product id in meta if schema supports it — cast to any
      (setValue as any)(`items.${index}.product_id`, product._id);
    },
    [index, invoiceType, setValue],
  );

  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      setScannerVisible(false);
      setScanLoading(true);
      try {
        // Search online barcode databases in parallel (Food Facts, Beauty Facts, UPC, etc.)
        const result = await lookupBarcode(barcode);
        if (result) {
          setValue(`items.${index}.description`, formatLookupResult(result));
          toast.success(`Found via ${result.source}: ${result.name}`);
        } else {
          // Nothing found — prefill barcode for manual entry
          setValue(`items.${index}.description`, barcode);
          toast.info(
            "Product not found online. Barcode prefilled — please enter details.",
          );
        }
      } finally {
        setScanLoading(false);
      }
    },
    [index, setValue],
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
              Scan
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
              Product
            </Text>
          </TouchableOpacity>
        </View>
        {canRemove && (
          <TouchableOpacity
            onPress={onRemove}
            className="w-8 h-8 rounded-full bg-red-100 items-center justify-center"
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
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
              scanLoading ? "Looking up product…" : "Item description"
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
            Quantity
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
          Tax Rate (%)
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

      {/* Modals */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleBarcodeScan}
        title="Scan Item Barcode"
      />
      <ProductSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelect={fillFromProduct}
        invoiceType={invoiceType}
      />
    </View>
  );
}
