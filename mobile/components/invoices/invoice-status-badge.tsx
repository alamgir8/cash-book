import React from "react";
import { View, Text } from "react-native";
import type { InvoiceStatus, StatusColorConfig } from "@/types/invoice";
import { STATUS_COLORS } from "@/types/invoice";

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const colors = STATUS_COLORS[status];

  return (
    <View className={`px-3 py-1 rounded-full ${colors.bg}`}>
      <Text className={`text-xs font-semibold capitalize ${colors.text}`}>
        {status}
      </Text>
    </View>
  );
}
