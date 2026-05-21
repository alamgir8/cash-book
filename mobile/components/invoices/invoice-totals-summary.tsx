import React from "react";
import { View, Text } from "react-native";
import type { InvoiceTotals } from "@/types/invoice";
import { formatInvoiceAmount } from "@/lib/invoice-utils";
import { useTheme } from "@/hooks/use-theme";

interface InvoiceTotalsSummaryProps {
  totals: InvoiceTotals;
}

export function InvoiceTotalsSummary({ totals }: InvoiceTotalsSummaryProps) {
  const { colors } = useTheme();

  return (
    <View
      className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
      style={{ backgroundColor: colors.card }}
    >
      <Text
        className="text-base font-semibold mb-4"
        style={{ color: colors.text.primary }}
      >
        Invoice Summary
      </Text>

      {/* Subtotal */}
      <View
        className="flex-row justify-between items-center py-2.5 border-b"
        style={{ borderColor: colors.border + "60" }}
      >
        <Text className="text-sm" style={{ color: colors.text.secondary }}>
          Subtotal
        </Text>
        <Text
          className="text-sm font-semibold"
          style={{ color: colors.text.primary }}
        >
          {`৳${formatInvoiceAmount(totals.subtotal)}`}
        </Text>
      </View>

      {/* Tax */}
      {totals.totalTax > 0 && (
        <View
          className="flex-row justify-between items-center py-2.5 border-b"
          style={{ borderColor: colors.border + "60" }}
        >
          <Text className="text-sm" style={{ color: colors.text.secondary }}>
            Tax
          </Text>
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.warning }}
          >
            {`+৳${formatInvoiceAmount(totals.totalTax)}`}
          </Text>
        </View>
      )}

      {/* Discount */}
      {totals.discountAmount > 0 && (
        <View
          className="flex-row justify-between items-center py-2.5 border-b"
          style={{ borderColor: colors.border + "60" }}
        >
          <Text className="text-sm" style={{ color: colors.text.secondary }}>
            Discount
          </Text>
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.error }}
          >
            {`-৳${formatInvoiceAmount(totals.discountAmount)}`}
          </Text>
        </View>
      )}

      {/* Grand Total */}
      <View
        className="flex-row justify-between items-center py-3 mt-1 rounded-xl px-3"
        style={{ backgroundColor: colors.primary + "12" }}
      >
        <Text
          className="text-base font-bold"
          style={{ color: colors.text.primary }}
        >
          Grand Total
        </Text>
        <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
          {`৳${formatInvoiceAmount(totals.total)}`}
        </Text>
      </View>
    </View>
  );
}
