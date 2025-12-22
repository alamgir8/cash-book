import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InvoiceType } from "@/types/invoice";

interface InvoiceTypeHeaderProps {
  type: InvoiceType;
}

export function InvoiceTypeHeader({ type }: InvoiceTypeHeaderProps) {
  const isSale = type === "sale";

  return (
    <View
      className={`mx-4 mt-4 p-4 rounded-2xl flex-row items-center ${
        isSale ? "bg-emerald-50" : "bg-amber-50"
      }`}
    >
      <View
        className={`w-14 h-14 rounded-2xl items-center justify-center ${
          isSale ? "bg-emerald-100" : "bg-amber-100"
        }`}
      >
        <Ionicons
          name={isSale ? "trending-up" : "trending-down"}
          size={28}
          color={isSale ? "#10B981" : "#F59E0B"}
        />
      </View>
      <View className="ml-4 flex-1">
        <Text
          className={`text-lg font-bold ${
            isSale ? "text-emerald-900" : "text-amber-900"
          }`}
        >
          {isSale ? "Sales Invoice" : "Purchase Invoice"}
        </Text>
        <Text
          className={`text-sm ${
            isSale ? "text-emerald-700" : "text-amber-700"
          }`}
        >
          {isSale
            ? "Invoice for goods/services sold"
            : "Invoice for goods/services purchased"}
        </Text>
      </View>
    </View>
  );
}
