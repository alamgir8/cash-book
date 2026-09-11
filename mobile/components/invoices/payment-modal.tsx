import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createPaymentSchema,
  type PaymentFormData,
} from "@/lib/validations/shop";
import type { PaymentMethod } from "@/types/invoice";
import { FormSheetModal } from "@/components/form-sheet-modal";
import {
  amountInputProps,
  normalizeAmountInput,
} from "@/lib/amount-input";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";

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
  const { t } = useTranslation();

  const methodLabel = (value: PaymentMethod) => {
    switch (value) {
      case "cash":
        return t("cash");
      case "bank":
        return t("bank");
      case "mobile_wallet":
        return t("mobileWallet");
      case "cheque":
        return t("cheque");
      case "other":
        return t("other");
    }
  };

  // The resolver is rebuilt whenever the outstanding balance changes so the
  // user can never record more than is owed.
  const resolver = useMemo(
    () => zodResolver(createPaymentSchema(maxAmount)),
    [maxAmount],
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PaymentFormData>({
    resolver,
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
      title={t("recordPaymentBtn")}
      subtitle={`${t("outstanding")}: ${maxAmount.toFixed(2)}`}
      submitLabel={t("recordPaymentBtn")}
      submitIcon="cash-outline"
      onSubmit={handleSubmit(handleFormSubmit)}
      isSubmitting={isSubmitting}
      submittingLabel={t("saving")}
      sheetRatio={0.75}
    >
      <View className="gap-5">
        <View>
          <Text
            className="text-sm font-semibold mb-2"
            style={{ color: colors.text.primary }}
          >
            {t("amountLabel")} *
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
            {t("paymentMethod")} *
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
                      {methodLabel(method.value)}
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
            {t("referenceOptional")}
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
            {t("notesOptional")}
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
