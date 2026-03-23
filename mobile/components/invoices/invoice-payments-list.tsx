import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InvoicePayment, PaymentMethod } from "@/types/invoice";
import { useTheme } from "@/hooks/useTheme";

interface InvoicePaymentsListProps {
  payments: InvoicePayment[];
}

const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  cash: "cash-outline",
  bank: "card-outline",
  mobile_wallet: "phone-portrait-outline",
  cheque: "document-text-outline",
  other: "ellipsis-horizontal-circle-outline",
};

export function InvoicePaymentsList({ payments }: InvoicePaymentsListProps) {
  const { colors } = useTheme();

  const formatAmount = (amount: number) => {
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (!payments || payments.length === 0) {
    return null;
  }

  return (
    <View className="rounded-lg shadow-sm mb-4" style={{ backgroundColor: colors.card }}>
      {/* Header */}
      <View className="p-3 rounded-t-lg border-b" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border }}>
        <Text className="text-xs font-semibold uppercase" style={{ color: colors.text.secondary }}>
          Payment History
        </Text>
      </View>

      {/* Payments List */}
      <View className="p-3">
        {payments.map((payment, index) => (
          <View
            key={payment._id || index}
            className="py-3"
            style={index < payments.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : undefined}
          >
            {/* Payment Header */}
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-row items-center">
                <View className="bg-green-100 p-2 rounded-full mr-3">
                  <Ionicons
                    name={PAYMENT_METHOD_ICONS[payment.method] as any}
                    size={16}
                    color="#059669"
                  />
                </View>
                <View>
                  <Text className="text-sm font-semibold capitalize" style={{ color: colors.text.primary }}>
                    {payment.method.replace("_", " ")}
                  </Text>
                  <Text className="text-xs" style={{ color: colors.text.tertiary }}>
                    {new Date(payment.date).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <Text className="text-base font-bold" style={{ color: colors.success }}>
                \u09f3{formatAmount(payment.amount)}
              </Text>
            </View>

            {/* Payment Details */}
            {payment.reference && (
              <View className="flex-row items-center mt-1">
                <Ionicons name="document-outline" size={12} color={colors.text.tertiary} />
                <Text className="text-xs ml-1" style={{ color: colors.text.secondary }}>
                  Ref: {payment.reference}
                </Text>
              </View>
            )}

            {payment.notes && (
              <Text className="text-xs mt-1 italic" style={{ color: colors.text.secondary }}>
                {payment.notes}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
