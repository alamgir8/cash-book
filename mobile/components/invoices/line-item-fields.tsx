import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Controller, Control, FieldErrors } from "react-hook-form";
import type { InvoiceFormData } from "@/lib/validations/invoice";
import { useTheme } from "@/hooks/useTheme";

interface LineItemFieldsProps {
  control: Control<InvoiceFormData>;
  index: number;
  errors: FieldErrors<InvoiceFormData>;
  onRemove: () => void;
  canRemove: boolean;
  onCalculateTotal: (
    quantity: string | number,
    unitPrice: string | number,
    taxRate?: string | number
  ) => number;
}

export function LineItemFields({
  control,
  index,
  errors,
  onRemove,
  canRemove,
  onCalculateTotal,
}: LineItemFieldsProps) {
  const { colors } = useTheme();

  return (
    <View className="mb-4 p-4 rounded-xl border" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border }}>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary + '20' }}>
            <Text className="font-semibold text-sm" style={{ color: colors.primary }}>
              {index + 1}
            </Text>
          </View>
          <Text className="text-sm font-medium ml-2" style={{ color: colors.text.secondary }}>
            Item {index + 1}
          </Text>
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
        name={\`items.\${index}.description\`}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="Item description"
            placeholderTextColor={colors.inputPlaceholder}
            className="border rounded-xl px-4 py-3 text-base mb-3"
            style={{
              backgroundColor: colors.bg.primary,
              borderColor: errors.items?.[index]?.description ? colors.error : colors.inputBorder,
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
          <Text className="text-xs mb-1.5" style={{ color: colors.text.secondary }}>Quantity</Text>
          <Controller
            control={control}
            name={\`items.\${index}.quantity\`}
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
                  borderColor: errors.items?.[index]?.quantity ? colors.error : colors.inputBorder,
                  color: colors.text.primary,
                }}
              />
            )}
          />
        </View>
        <View className="flex-1">
          <Text className="text-xs mb-1.5" style={{ color: colors.text.secondary }}>Unit Price</Text>
          <Controller
            control={control}
            name={\`items.\${index}.unit_price\`}
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
                  borderColor: errors.items?.[index]?.unit_price ? colors.error : colors.inputBorder,
                  color: colors.text.primary,
                }}
              />
            )}
          />
        </View>
      </View>

      {/* Tax Rate */}
      <View className="mb-3">
        <Text className="text-xs mb-1.5" style={{ color: colors.text.secondary }}>Tax Rate (%)</Text>
        <Controller
          control={control}
          name={\`items.\${index}.tax_rate\`}
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

      {/* Line Total */}
      <Controller
        control={control}
        name={\`items.\${index}\`}
        render={({ field: { value } }) => {
          const total = onCalculateTotal(
            value.quantity || "0",
            value.unit_price || "0",
            value.tax_rate || "0"
          );
          return total > 0 ? (
            <View className="flex-row justify-between items-center pt-3 border-t" style={{ borderColor: colors.border }}>
              <Text className="text-sm" style={{ color: colors.text.secondary }}>Line Total</Text>
              <Text className="text-base font-bold" style={{ color: colors.primary }}>
                \u09f3
                {total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>
          ) : null;
        }}
      />
    </View>
  );
}
