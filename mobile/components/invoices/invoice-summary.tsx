import React from "react";
import { View, Text } from "react-native";
import type { Invoice } from "@/types/invoice";
import { useTheme } from "@/hooks/useTheme";

interface InvoiceSummaryProps {
  invoice: Invoice;
}

export function InvoiceSummary({ invoice }: InvoiceSummaryProps) {
  const { colors } = useTheme();

  const formatAmount = (amount: number | undefined) => {
    if (amount === null || amount === undefined) return "0.00";
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <View
      className="p-4 rounded-lg shadow-sm mb-4"
      style={{ backgroundColor: colors.card }}
    >
      {/* Subtotal */}
      <View className="flex-row justify-between py-2">
        <Text className="text-sm" style={{ color: colors.text.secondary }}>
          Subtotal
        </Text>
        <Text className="text-sm" style={{ color: colors.text.primary }}>
          \u09f3{formatAmount(invoice.subtotal)}
        </Text>
      </View>

      {/* Tax */}
      {invoice.total_tax > 0 && (
        <View className="flex-row justify-between py-2">
          <Text className="text-sm" style={{ color: colors.text.secondary }}>
            Tax
          </Text>
          <Text className="text-sm" style={{ color: colors.text.primary }}>
            \u09f3{formatAmount(invoice.total_tax)}
          </Text>
        </View>
      )}

      {/* Discount */}
      {invoice.total_discount > 0 && (
        <View className="flex-row justify-between py-2">
          <Text className="text-sm" style={{ color: colors.text.secondary }}>
            Discount
          </Text>
          <Text className="text-sm" style={{ color: colors.error }}>
            -\u09f3{formatAmount(invoice.total_discount)}
          </Text>
        </View>
      )}

      {/* Shipping */}
      {invoice.shipping_charge && invoice.shipping_charge > 0 && (
        <View className="flex-row justify-between py-2">
          <Text className="text-sm" style={{ color: colors.text.secondary }}>
            Shipping
          </Text>
          <Text className="text-sm" style={{ color: colors.text.primary }}>
            \u09f3{formatAmount(invoice.shipping_charge)}
          </Text>
        </View>
      )}

      {/* Adjustment */}
      {invoice.adjustment !== undefined && invoice.adjustment !== 0 && (
        <View className="flex-row justify-between py-2">
          <Text className="text-sm" style={{ color: colors.text.secondary }}>
            Adjustment
            {invoice.adjustment_description &&
              ` (${invoice.adjustment_description})`}
          </Text>
          <Text
            className="text-sm"
            style={{
              color:
                invoice.adjustment > 0 ? colors.text.primary : colors.error,
            }}
          >
            {invoice.adjustment > 0 ? "\u09f3" : "-\u09f3"}
            {formatAmount(Math.abs(invoice.adjustment))}
          </Text>
        </View>
      )}

      {/* Grand Total */}
      <View
        className="flex-row justify-between py-3 border-t-2 mt-2"
        style={{ borderColor: colors.border }}
      >
        <Text
          className="text-base font-bold"
          style={{ color: colors.text.primary }}
        >
          Grand Total
        </Text>
        <Text
          className="text-lg font-bold"
          style={{ color: colors.text.primary }}
        >
          \u09f3{formatAmount(invoice.grand_total)}
        </Text>
      </View>

      {/* Amount Paid */}
      {invoice.amount_paid > 0 && (
        <View
          className="flex-row justify-between py-2 border-t mt-2"
          style={{ borderColor: colors.border }}
        >
          <Text className="text-sm" style={{ color: colors.success }}>
            Amount Paid
          </Text>
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.success }}
          >
            \u09f3{formatAmount(invoice.amount_paid)}
          </Text>
        </View>
      )}

      {/* Balance Due */}
      {invoice.balance_due > 0 && (
        <View className="flex-row justify-between py-2">
          <Text
            className="text-base font-semibold"
            style={{ color: colors.warning }}
          >
            Balance Due
          </Text>
          <Text className="text-lg font-bold" style={{ color: colors.warning }}>
            \u09f3{formatAmount(invoice.balance_due)}
          </Text>
        </View>
      )}
    </View>
  );
}
