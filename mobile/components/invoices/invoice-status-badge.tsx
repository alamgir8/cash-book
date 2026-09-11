import React from "react";
import { View, Text } from "react-native";
import type { InvoiceStatus, StatusColorConfig } from "@/types/invoice";
import { STATUS_COLORS } from "@/types/invoice";
import { useTranslation } from "@/hooks/use-translation";

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const colors = STATUS_COLORS[status];
  const { t } = useTranslation();

  const statusLabels: Record<InvoiceStatus, string> = {
    draft: t("draft"),
    pending: t("pending"),
    partial: t("partial"),
    paid: t("paid"),
    overdue: t("overdue"),
    cancelled: t("cancelled"),
  };

  return (
    <View className={`px-3 py-1 rounded-full ${colors.bg}`}>
      <Text className={`text-xs font-semibold capitalize ${colors.text}`}>
        {statusLabels[status]}
      </Text>
    </View>
  );
}
