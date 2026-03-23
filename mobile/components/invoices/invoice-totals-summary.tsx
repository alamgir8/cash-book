import React from "react";
import { View, Text } from "react-native";
import type { InvoiceTotals } from "@/types/invoice";
import { formatInvoiceAmount } from "@/lib/invoice-utils";
import { useTheme } from "@/hooks/useTheme";

interface InvoiceTotalsSummaryProps {
  totals: InvoiceTotals;
}

export function InvoiceTotalsSummary({ totals }: InvoiceTotalsSummaryProps) {
  const { colors } = useTheme();

  return (
    <View className="mx-4 mt-4 rounded-2xl p-5 shadow-sm" style={{ backgroundColor: colors.card }}>
      <Text className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
        Invoice Summary
      </Text>

      {/* Subtotal */}
      <View className="flex-row justify-between py-2">
        <Text className="text-sm" style={{ color: colors.text.secondary }}>Subtotal</Text>
        <Text className="text-sm font-medium" style={{ color: colors.text.primary }}>
          \u09f3{formatInvoiceAmount(totals.subtotal)}
        </Text>
      </View>

      {/* Tax */}
      {totals.totalTax > 0 && (
        <View className="flex-row justify-between py-2">
          <Text className="text-sm" style={{ color: colors.text.secondary }}>Total Tax</Text>
          <Text className="text-sm font-medium" style={{ color: colors.text.primary }}>
            \u09f3{formatInvoiceAmount(totals.totalTax)}
          </Text>
        </View>
      )}

      {/* Discount */}
      {totals.discountAmount > 0 && (
        <View className="flex-row justify-between py-2">
          <Text className="text-sm" style={{ color: colors.text.secondary }}>Discount</Text>
          <Text className="text-sm font-medium" style={{ color: colors.error }}>
            -\u09f3{formatInvoiceAmount(totals.discountAmount)}
          </Text>
        </View>
      )}

      {/* Grand Total */}
      <View className="flex-row justify-between py-3 mt-2 border-t-2" style={{ borderColor: colors.border }}>
        <Text className="text-lg font-bold" style={{ color: colors.text.primary }}>Grand Total</Text>
        <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
          \u09f3{formatInvoiceAmount(totals.total)}
        </Text>
      </View>
    </View>
  );
}
