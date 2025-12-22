import React from "react";
import { View, Text } from "react-native";
import type { InvoiceLineItem } from "@/types/invoice";

interface InvoiceItemsTableProps {
  items: InvoiceLineItem[];
}

export function InvoiceItemsTable({ items }: InvoiceItemsTableProps) {
  const formatAmount = (amount: number | undefined) => {
    if (amount === null || amount === undefined) return "0.00";
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <View className="bg-white rounded-lg shadow-sm mb-4">
      {/* Table Header */}
      <View className="bg-gray-50 p-3 rounded-t-lg border-b border-gray-200">
        <Text className="text-xs font-semibold text-gray-600 uppercase">
          Items
        </Text>
      </View>

      {/* Table Body */}
      <View className="p-3">
        {items.map((item, index) => (
          <View
            key={item._id || index}
            className={`py-3 ${
              index < items.length - 1 ? "border-b border-gray-100" : ""
            }`}
          >
            {/* Item Description */}
            <Text className="text-sm font-medium text-gray-900 mb-1">
              {item.description}
            </Text>

            {/* Item Details Row */}
            <View className="flex-row justify-between items-center mt-2">
              <View className="flex-row space-x-4">
                <View>
                  <Text className="text-xs text-gray-500">Qty</Text>
                  <Text className="text-sm text-gray-700">
                    {item.quantity} {item.unit || ""}
                  </Text>
                </View>
                <View>
                  <Text className="text-xs text-gray-500">Price</Text>
                  <Text className="text-sm text-gray-700">
                    ৳{formatAmount(item.unit_price)}
                  </Text>
                </View>
                {item.tax_rate > 0 && (
                  <View>
                    <Text className="text-xs text-gray-500">Tax</Text>
                    <Text className="text-sm text-gray-700">
                      {item.tax_rate}%
                    </Text>
                  </View>
                )}
              </View>

              {/* Item Total */}
              <View className="items-end">
                <Text className="text-xs text-gray-500">Total</Text>
                <Text className="text-base font-semibold text-gray-900">
                  ৳{formatAmount(item.total)}
                </Text>
              </View>
            </View>

            {/* Item Notes if available */}
            {item.notes && (
              <Text className="text-xs text-gray-600 mt-2 italic">
                {item.notes}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
