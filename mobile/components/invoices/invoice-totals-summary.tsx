import React from "react";
import { View, Text } from "react-native";
import type { InvoiceTotals } from "@/types/invoice";
import { formatInvoiceAmount } from "@/lib/invoice-utils";

interface InvoiceTotalsSummaryProps {
  totals: InvoiceTotals;
}

export function InvoiceTotalsSummary({ totals }: InvoiceTotalsSummaryProps) {
  return (
    <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
      <Text className="text-base font-semibold text-slate-800 mb-4">
        Invoice Summary
      </Text>

      {/* Subtotal */}
      <View className="flex-row justify-between py-2">
        <Text className="text-sm text-slate-600">Subtotal</Text>
        <Text className="text-sm text-slate-900 font-medium">
          ৳{formatInvoiceAmount(totals.subtotal)}
        </Text>
      </View>

      {/* Tax */}
      {totals.totalTax > 0 && (
        <View className="flex-row justify-between py-2">
          <Text className="text-sm text-slate-600">Total Tax</Text>
          <Text className="text-sm text-slate-900 font-medium">
            ৳{formatInvoiceAmount(totals.totalTax)}
          </Text>
        </View>
      )}

      {/* Discount */}
      {totals.discountAmount > 0 && (
        <View className="flex-row justify-between py-2">
          <Text className="text-sm text-slate-600">Discount</Text>
          <Text className="text-sm text-red-600 font-medium">
            -৳{formatInvoiceAmount(totals.discountAmount)}
          </Text>
        </View>
      )}

      {/* Grand Total */}
      <View className="flex-row justify-between py-3 mt-2 border-t-2 border-slate-200">
        <Text className="text-lg font-bold text-slate-900">Grand Total</Text>
        <Text className="text-2xl font-bold text-indigo-600">
          ৳{formatInvoiceAmount(totals.total)}
        </Text>
      </View>
    </View>
  );
}
