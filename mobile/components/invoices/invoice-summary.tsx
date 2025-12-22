import React from "react";
import { View, Text } from "react-native";
import type { Invoice } from "@/types/invoice";

interface InvoiceSummaryProps {
  invoice: Invoice;
}

export function InvoiceSummary({ invoice }: InvoiceSummaryProps) {
  const formatAmount = (amount: number | undefined) => {
    if (amount === null || amount === undefined) return "0.00";
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <View className="bg-white p-4 rounded-lg shadow-sm mb-4">
      {/* Subtotal */}
      <View className="flex-row justify-between py-2">
        <Text className="text-sm text-gray-600">Subtotal</Text>
        <Text className="text-sm text-gray-900">
          ৳{formatAmount(invoice.subtotal)}
        </Text>
      </View>

      {/* Tax */}
      {invoice.total_tax > 0 && (
        <View className="flex-row justify-between py-2">
          <Text className="text-sm text-gray-600">Tax</Text>
          <Text className="text-sm text-gray-900">
            ৳{formatAmount(invoice.total_tax)}
          </Text>
        </View>
      )}

      {/* Discount */}
      {invoice.total_discount > 0 && (
        <View className="flex-row justify-between py-2">
          <Text className="text-sm text-gray-600">Discount</Text>
          <Text className="text-sm text-red-600">
            -৳{formatAmount(invoice.total_discount)}
          </Text>
        </View>
      )}

      {/* Shipping */}
      {invoice.shipping_charge && invoice.shipping_charge > 0 && (
        <View className="flex-row justify-between py-2">
          <Text className="text-sm text-gray-600">Shipping</Text>
          <Text className="text-sm text-gray-900">
            ৳{formatAmount(invoice.shipping_charge)}
          </Text>
        </View>
      )}

      {/* Adjustment */}
      {invoice.adjustment !== undefined && invoice.adjustment !== 0 && (
        <View className="flex-row justify-between py-2">
          <Text className="text-sm text-gray-600">
            Adjustment
            {invoice.adjustment_description &&
              ` (${invoice.adjustment_description})`}
          </Text>
          <Text
            className={`text-sm ${
              invoice.adjustment > 0 ? "text-gray-900" : "text-red-600"
            }`}
          >
            {invoice.adjustment > 0 ? "৳" : "-৳"}
            {formatAmount(Math.abs(invoice.adjustment))}
          </Text>
        </View>
      )}

      {/* Grand Total */}
      <View className="flex-row justify-between py-3 border-t-2 border-gray-200 mt-2">
        <Text className="text-base font-bold text-gray-900">Grand Total</Text>
        <Text className="text-lg font-bold text-gray-900">
          ৳{formatAmount(invoice.grand_total)}
        </Text>
      </View>

      {/* Amount Paid */}
      {invoice.amount_paid > 0 && (
        <View className="flex-row justify-between py-2 border-t border-gray-100 mt-2">
          <Text className="text-sm text-green-600">Amount Paid</Text>
          <Text className="text-sm font-semibold text-green-600">
            ৳{formatAmount(invoice.amount_paid)}
          </Text>
        </View>
      )}

      {/* Balance Due */}
      {invoice.balance_due > 0 && (
        <View className="flex-row justify-between py-2">
          <Text className="text-base font-semibold text-orange-600">
            Balance Due
          </Text>
          <Text className="text-lg font-bold text-orange-600">
            ৳{formatAmount(invoice.balance_due)}
          </Text>
        </View>
      )}
    </View>
  );
}
