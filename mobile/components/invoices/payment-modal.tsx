import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { paymentSchema, type PaymentFormData } from "@/lib/validations/invoice";
import type { PaymentMethod } from "@/types/invoice";
import { FormSheetModal } from "@/components/form-sheet-modal";
import {
  amountInputProps,
  normalizeAmountInput,
} from "@/lib/amount-input";
import { useTheme } from "@/hooks/use-theme";

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
    <FormSheetModal
      visible={visible}
      onClose={handleClose}
      title="Record Payment"
      subtitle={`Outstanding: ${maxAmount.toFixed(2)}`}
      submitLabel="Record Payment"
      submitIcon="cash-outline"
      onSubmit={handleSubmit(handleFormSubmit)}
      isSubmitting={isSubmitting}
      submittingLabel="Saving…"
      sheetRatio={0.75}
    >
      <View className="gap-5">
        <View>
          <Text
            className="text-sm font-semibold mb-2"
            style={{ color: colors.text.primary }}
          >
            Amount *
          </Text>
          <Controller
            control={control}
            name="amount"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={(text) =>
                  onChange(normalizeAmountInput(text))
                }
                {...amountInputProps}
                placeholder={`Max: ${maxAmount.toFixed(2)}`}
                placeholderTextColor={colors.text.tertiary}
                style={{
                  backgroundColor: colors.bg.tertiary,
                  color: colors.text.primary,
                  borderColor: errors.amount ? colors.error : colors.border,
                }}
                className="px-4 py-3 rounded-xl border text-lg font-semibold"
              />
            )}
          />
          {errors.amount ? (
            <Text className="text-sm mt-1" style={{ color: colors.error }}>
              {errors.amount.message}
            </Text>
          ) : null}
        </View>

        <View>
          <Text
            className="text-sm font-semibold mb-2"
            style={{ color: colors.text.primary }}
          >
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
                    className="px-4 py-2.5 rounded-xl border"
                    style={{
                      backgroundColor:
                        value === method.value
                          ? colors.info + "20"
                          : colors.bg.tertiary,
                      borderColor:
                        value === method.value ? colors.info : colors.border,
                    }}
                  >
                    <Text
                      className="font-semibold text-sm"
                      style={{
                        color:
                          value === method.value
                            ? colors.info
                            : colors.text.secondary,
                      }}
                    >
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          />
        </View>

        <View>
          <Text
            className="text-sm font-semibold mb-2"
            style={{ color: colors.text.primary }}
          >
            Reference (Optional)
          </Text>
          <Controller
            control={control}
            name="reference"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="Transaction ID, Cheque No, etc."
                placeholderTextColor={colors.text.tertiary}
                style={{
                  backgroundColor: colors.bg.tertiary,
                  color: colors.text.primary,
                  borderColor: colors.border,
                }}
                className="px-4 py-3 rounded-xl border"
              />
            )}
          />
        </View>

        <View>
          <Text
            className="text-sm font-semibold mb-2"
            style={{ color: colors.text.primary }}
          >
            Notes (Optional)
          </Text>
          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="Additional notes"
                placeholderTextColor={colors.text.tertiary}
                style={{
                  backgroundColor: colors.bg.tertiary,
                  color: colors.text.primary,
                  borderColor: colors.border,
                }}
                className="px-4 py-3 rounded-xl border min-h-[80px]"
                multiline
                textAlignVertical="top"
              />
            )}
          />
        </View>
      </View>
    </FormSheetModal>
  );
}
