import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { paymentSchema, type PaymentFormData } from "@/lib/validations/invoice";
import type { PaymentMethod } from "@/types/invoice";
import { useTheme } from "@/hooks/useTheme";

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
  maxAmount: number;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank Transfer" },
  { value: "mobile_wallet", label: "Mobile Wallet" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

export function PaymentModal({
  visible,
  onClose,
  onSubmit,
  isSubmitting,
  maxAmount,
}: PaymentModalProps) {
  const { colors } = useTheme();

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: "",
      method: "cash",
      reference: "",
      notes: "",
      date: new Date().toISOString().split("T")[0],
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFormSubmit = (data: PaymentFormData) => {
    onSubmit({
      amount: parseFloat(data.amount),
      method: data.method,
      reference: data.reference,
      notes: data.notes,
      date: data.date,
    });
    reset();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: colors.modalOverlay }}>
        <View className="rounded-t-3xl p-6 max-h-[80%]" style={{ backgroundColor: colors.bg.primary }}>
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold" style={{ color: colors.text.primary }}>
              Record Payment
            </Text>
            <TouchableOpacity onPress={handleClose} disabled={isSubmitting}>
              <Ionicons name="close" size={24} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          {/* Amount Input */}
          <View className="mb-4">
            <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Amount *
            </Text>
            <Controller
              control={control}
              name="amount"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="border rounded-lg px-4 py-3"
                  style={{
                    borderColor: errors.amount ? colors.error : colors.inputBorder,
                    backgroundColor: colors.bg.secondary,
                    color: colors.text.primary,
                  }}
                  value={value}
                  onChangeText={onChange}
                  placeholder={\`Max: \${maxAmount.toFixed(2)}\`}
                  placeholderTextColor={colors.inputPlaceholder}
                  keyboardType="decimal-pad"
                />
              )}
            />
            {errors.amount && (
              <Text className="text-xs mt-1" style={{ color: colors.error }}>
                {errors.amount.message}
              </Text>
            )}
          </View>

          {/* Payment Method */}
          <View className="mb-4">
            <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Payment Method *
            </Text>
            <Controller
              control={control}
              name="method"
              render={({ field: { onChange, value } }) => (
                <View className="flex-row flex-wrap gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <TouchableOpacity
                      key={method.value}
                      onPress={() => onChange(method.value)}
                      className="px-4 py-2 rounded-lg border"
                      style={{
                        backgroundColor: value === method.value ? colors.primary : colors.bg.primary,
                        borderColor: value === method.value ? colors.primary : colors.inputBorder,
                      }}
                    >
                      <Text
                        className="font-medium"
                        style={{ color: value === method.value ? '#ffffff' : colors.text.secondary }}
                      >
                        {method.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          </View>

          {/* Reference */}
          <View className="mb-4">
            <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Reference (Optional)
            </Text>
            <Controller
              control={control}
              name="reference"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="border rounded-lg px-4 py-3"
                  style={{
                    borderColor: colors.inputBorder,
                    backgroundColor: colors.bg.secondary,
                    color: colors.text.primary,
                  }}
                  value={value}
                  onChangeText={onChange}
                  placeholder="Transaction ID, Cheque No, etc."
                  placeholderTextColor={colors.inputPlaceholder}
                />
              )}
            />
          </View>

          {/* Notes */}
          <View className="mb-6">
            <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Notes (Optional)
            </Text>
            <Controller
              control={control}
              name="notes"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="border rounded-lg px-4 py-3"
                  style={{
                    borderColor: colors.inputBorder,
                    backgroundColor: colors.bg.secondary,
                    color: colors.text.primary,
                  }}
                  value={value}
                  onChangeText={onChange}
                  placeholder="Additional notes"
                  placeholderTextColor={colors.inputPlaceholder}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              )}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit(handleFormSubmit)}
            disabled={isSubmitting}
            className="rounded-lg py-4 items-center"
            style={{ backgroundColor: colors.primary }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">
                Record Payment
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
