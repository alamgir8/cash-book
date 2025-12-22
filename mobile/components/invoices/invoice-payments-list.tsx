import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InvoicePayment, PaymentMethod } from "@/types/invoice";

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
    <View className="bg-white rounded-lg shadow-sm mb-4">
      {/* Header */}
      <View className="bg-gray-50 p-3 rounded-t-lg border-b border-gray-200">
        <Text className="text-xs font-semibold text-gray-600 uppercase">
          Payment History
        </Text>
      </View>

      {/* Payments List */}
      <View className="p-3">
        {payments.map((payment, index) => (
          <View
            key={payment._id || index}
            className={`py-3 ${
              index < payments.length - 1 ? "border-b border-gray-100" : ""
            }`}
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
                  <Text className="text-sm font-semibold text-gray-900 capitalize">
                    {payment.method.replace("_", " ")}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {new Date(payment.date).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <Text className="text-base font-bold text-green-600">
                ৳{formatAmount(payment.amount)}
              </Text>
            </View>

            {/* Payment Details */}
            {payment.reference && (
              <View className="flex-row items-center mt-1">
                <Ionicons name="document-outline" size={12} color="#6B7280" />
                <Text className="text-xs text-gray-600 ml-1">
                  Ref: {payment.reference}
                </Text>
              </View>
            )}

            {payment.notes && (
              <Text className="text-xs text-gray-600 mt-1 italic">
                {payment.notes}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
