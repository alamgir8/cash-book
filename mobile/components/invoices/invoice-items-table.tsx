import React from "react";
import { View, Text } from "react-native";
import type { InvoiceLineItem } from "@/types/invoice";
import { useTheme } from "@/hooks/useTheme";

interface InvoiceItemsTableProps {
  items: InvoiceLineItem[];
}

export function InvoiceItemsTable({ items }: InvoiceItemsTableProps) {
  const { colors } = useTheme();

  const formatAmount = (amount: number | undefined) => {
    if (amount === null || amount === undefined) return "0.00";
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <View className="rounded-lg shadow-sm mb-4" style={{ backgroundColor: colors.card }}>
      {/* Table Header */}
      <View className="p-3 rounded-t-lg border-b" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border }}>
        <Text className="text-xs font-semibold uppercase" style={{ color: colors.text.secondary }}>
          Items
        </Text>
      </View>

      {/* Table Body */}
      <View className="p-3">
        {items.map((item, index) => (
          <View
            key={item._id || index}
            className="py-3"
            style={index < items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : undefined}
          >
            {/* Item Description */}
            <Text className="text-sm font-medium mb-1" style={{ color: colors.text.primary }}>
              {item.description}
            </Text>

            {/* Item Details Row */}
            <View className="flex-row justify-between items-center mt-2">
              <View className="flex-row space-x-4">
                <View>
                  <Text className="text-xs" style={{ color: colors.text.tertiary }}>Qty</Text>
                  <Text className="text-sm" style={{ color: colors.text.secondary }}>
                    {item.quantity} {item.unit || ""}
                  </Text>
                </View>
                <View>
                  <Text className="text-xs" style={{ color: colors.text.tertiary }}>Price</Text>
                  <Text className="text-sm" style={{ color: colors.text.secondary }}>
                    \u09f3{formatAmount(item.unit_price)}
                  </Text>
                </View>
                {item.tax_rate > 0 && (
                  <View>
                    <Text className="text-xs" style={{ color: colors.text.tertiary }}>Tax</Text>
                    <Text className="text-sm" style={{ color: colors.text.secondary }}>
                      {item.tax_rate}%
                    </Text>
                  </View>
                )}
              </View>

              {/* Item Total */}
              <View className="items-end">
                <Text className="text-xs" style={{ color: colors.text.tertiary }}>Total</Text>
                <Text className="text-base font-semibold" style={{ color: colors.text.primary }}>
                  \u09f3{formatAmount(item.total)}
                </Text>
              </View>
            </View>

            {/* Item Notes if available */}
            {item.notes && (
              <Text className="text-xs mt-2 italic" style={{ color: colors.text.secondary }}>
                {item.notes}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
