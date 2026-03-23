import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Invoice } from "@/types/invoice";
import { useTheme } from "@/hooks/useTheme";

interface InvoiceHeaderProps {
  invoice: Invoice;
}

export function InvoiceHeader({ invoice }: InvoiceHeaderProps) {
  const { colors } = useTheme();

  return (
    <View className="p-4 rounded-lg shadow-sm mb-4" style={{ backgroundColor: colors.card }}>
      {/* Invoice Number and Date */}
      <View className="flex-row justify-between items-start mb-4">
        <View>
          <Text className="text-xs mb-1" style={{ color: colors.text.tertiary }}>Invoice Number</Text>
          <Text className="text-lg font-bold" style={{ color: colors.text.primary }}>
            {invoice.invoice_number}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs mb-1" style={{ color: colors.text.tertiary }}>Date</Text>
          <Text className="text-sm font-medium" style={{ color: colors.text.secondary }}>
            {new Date(invoice.date).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {/* Party Information */}
      {invoice.party && (
        <View className="border-t pt-4" style={{ borderColor: colors.border }}>
          <View className="flex-row items-center mb-2">
            <Ionicons name="business-outline" size={16} color={colors.text.tertiary} />
            <Text className="text-xs ml-2" style={{ color: colors.text.tertiary }}>
              {invoice.type === "sale" ? "Customer" : "Supplier"}
            </Text>
          </View>
          <Text className="text-base font-semibold mb-1" style={{ color: colors.text.primary }}>
            {invoice.party.name}
          </Text>
          {invoice.party.code && (
            <Text className="text-sm" style={{ color: colors.text.secondary }}>
              Code: {invoice.party.code}
            </Text>
          )}
          {invoice.party.phone && (
            <View className="flex-row items-center mt-1">
              <Ionicons name="call-outline" size={14} color={colors.text.tertiary} />
              <Text className="text-sm ml-1" style={{ color: colors.text.secondary }}>
                {invoice.party.phone}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Due Date if exists */}
      {invoice.due_date && (
        <View className="border-t pt-4 mt-4" style={{ borderColor: colors.border }}>
          <View className="flex-row items-center">
            <Ionicons name="calendar-outline" size={16} color={colors.text.tertiary} />
            <Text className="text-xs ml-2" style={{ color: colors.text.tertiary }}>Due Date</Text>
          </View>
          <Text className="text-sm font-medium mt-1" style={{ color: colors.text.secondary }}>
            {new Date(invoice.due_date).toLocaleDateString()}
          </Text>
        </View>
      )}
    </View>
  );
}
