import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Controller, Control, FieldErrors } from "react-hook-form";
import type { InvoiceFormData } from "@/lib/validations/invoice";

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
  return (
    <View className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center">
            <Text className="text-indigo-600 font-semibold text-sm">
              {index + 1}
            </Text>
          </View>
          <Text className="text-sm font-medium text-slate-600 ml-2">
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
        name={`items.${index}.description`}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="Item description"
            placeholderTextColor="#94A3B8"
            className={`bg-white border rounded-xl px-4 py-3 text-slate-800 text-base mb-3 ${
              errors.items?.[index]?.description
                ? "border-red-400"
                : "border-slate-200"
            }`}
          />
        )}
      />
      {errors.items?.[index]?.description && (
        <Text className="text-red-500 text-sm mb-2 -mt-2">
          {errors.items[index]?.description?.message}
        </Text>
      )}

      {/* Quantity and Unit Price */}
      <View className="flex-row gap-2 mb-3">
        <View className="flex-1">
          <Text className="text-xs text-slate-600 mb-1.5">Quantity</Text>
          <Controller
            control={control}
            name={`items.${index}.quantity`}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="1"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                className={`bg-white border rounded-xl px-4 py-3 text-slate-800 text-base ${
                  errors.items?.[index]?.quantity
                    ? "border-red-400"
                    : "border-slate-200"
                }`}
              />
            )}
          />
        </View>
        <View className="flex-1">
          <Text className="text-xs text-slate-600 mb-1.5">Unit Price</Text>
          <Controller
            control={control}
            name={`items.${index}.unit_price`}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                className={`bg-white border rounded-xl px-4 py-3 text-slate-800 text-base ${
                  errors.items?.[index]?.unit_price
                    ? "border-red-400"
                    : "border-slate-200"
                }`}
              />
            )}
          />
        </View>
      </View>

      {/* Tax Rate */}
      <View className="mb-3">
        <Text className="text-xs text-slate-600 mb-1.5">Tax Rate (%)</Text>
        <Controller
          control={control}
          name={`items.${index}.tax_rate`}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="0"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base"
            />
          )}
        />
      </View>

      {/* Line Total */}
      <Controller
        control={control}
        name={`items.${index}`}
        render={({ field: { value } }) => {
          const total = onCalculateTotal(
            value.quantity || "0",
            value.unit_price || "0",
            value.tax_rate || "0"
          );
          return total > 0 ? (
            <View className="flex-row justify-between items-center pt-3 border-t border-slate-200">
              <Text className="text-sm text-slate-600">Line Total</Text>
              <Text className="text-base font-bold text-indigo-600">
                ৳
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
