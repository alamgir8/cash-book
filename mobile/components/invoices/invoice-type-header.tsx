import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InvoiceType } from "@/types/invoice";
import { useTheme } from "@/hooks/useTheme";

interface InvoiceTypeHeaderProps {
  type: InvoiceType;
}

export function InvoiceTypeHeader({ type }: InvoiceTypeHeaderProps) {
  const { colors, isDark } = useTheme();
  const isSale = type === "sale";

  return (
    <View
      className="mx-4 mt-4 p-4 rounded-2xl flex-row items-center"
      style={{ backgroundColor: isSale ? (isDark ? '#065f4620' : '#ecfdf5') : (isDark ? '#78350f20' : '#fffbeb') }}
    >
      <View
        className="w-14 h-14 rounded-2xl items-center justify-center"
        style={{ backgroundColor: isSale ? (isDark ? '#065f4640' : '#d1fae5') : (isDark ? '#78350f40' : '#fef3c7') }}
      >
        <Ionicons
          name={isSale ? "trending-up" : "trending-down"}
          size={28}
          color={isSale ? "#10B981" : "#F59E0B"}
        />
      </View>
      <View className="ml-4 flex-1">
        <Text
          className="text-lg font-bold"
          style={{ color: isSale ? (isDark ? '#6ee7b7' : '#064e3b') : (isDark ? '#fcd34d' : '#78350f') }}
        >
          {isSale ? "Sales Invoice" : "Purchase Invoice"}
        </Text>
        <Text
          className="text-sm"
          style={{ color: isSale ? (isDark ? '#a7f3d0' : '#047857') : (isDark ? '#fde68a' : '#b45309') }}
        >
          {isSale
            ? "Invoice for goods/services sold"
            : "Invoice for goods/services purchased"}
        </Text>
      </View>
    </View>
  );
}
