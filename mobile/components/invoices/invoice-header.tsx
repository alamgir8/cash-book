import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Invoice } from "@/types/invoice";

interface InvoiceHeaderProps {
  invoice: Invoice;
}

export function InvoiceHeader({ invoice }: InvoiceHeaderProps) {
  return (
    <View className="bg-white p-4 rounded-lg shadow-sm mb-4">
      {/* Invoice Number and Date */}
      <View className="flex-row justify-between items-start mb-4">
        <View>
          <Text className="text-xs text-gray-500 mb-1">Invoice Number</Text>
          <Text className="text-lg font-bold text-gray-900">
            {invoice.invoice_number}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs text-gray-500 mb-1">Date</Text>
          <Text className="text-sm font-medium text-gray-700">
            {new Date(invoice.date).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {/* Party Information */}
      {invoice.party && (
        <View className="border-t border-gray-100 pt-4">
          <View className="flex-row items-center mb-2">
            <Ionicons name="business-outline" size={16} color="#6B7280" />
            <Text className="text-xs text-gray-500 ml-2">
              {invoice.type === "sale" ? "Customer" : "Supplier"}
            </Text>
          </View>
          <Text className="text-base font-semibold text-gray-900 mb-1">
            {invoice.party.name}
          </Text>
          {invoice.party.code && (
            <Text className="text-sm text-gray-600">
              Code: {invoice.party.code}
            </Text>
          )}
          {invoice.party.phone && (
            <View className="flex-row items-center mt-1">
              <Ionicons name="call-outline" size={14} color="#6B7280" />
              <Text className="text-sm text-gray-600 ml-1">
                {invoice.party.phone}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Due Date if exists */}
      {invoice.due_date && (
        <View className="border-t border-gray-100 pt-4 mt-4">
          <View className="flex-row items-center">
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text className="text-xs text-gray-500 ml-2">Due Date</Text>
          </View>
          <Text className="text-sm font-medium text-gray-700 mt-1">
            {new Date(invoice.due_date).toLocaleDateString()}
          </Text>
        </View>
      )}
    </View>
  );
}
