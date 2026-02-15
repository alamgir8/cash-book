import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

type ExportType = "all" | "category" | "counterparty" | "account" | null;

interface PDFReportsSectionProps {
  exportingType: ExportType;
  onExport: (type: ExportType) => void;
}

export function PDFReportsSection({
  exportingType,
  onExport,
}: PDFReportsSectionProps) {
  const { colors } = useTheme();
  const reports = [
    {
      type: "all" as const,
      title: "All Transactions",
      subtitle: "Complete transaction list",
      icon: "list" as const,
      colorKey: "success" as const,
    },
    {
      type: "category" as const,
      title: "By Category",
      subtitle: "Grouped by transaction category",
      icon: "pricetags" as const,
      colorKey: "info" as const,
    },
    {
      type: "counterparty" as const,
      title: "By Counterparty",
      subtitle: "Grouped by customer/supplier",
      icon: "people" as const,
      colorKey: "warning" as const,
    },
    {
      type: "account" as const,
      title: "By Account",
      subtitle: "Grouped by payment account",
      icon: "wallet" as const,
      colorKey: "info" as const,
    },
  ];

  return (
    <View
      className="rounded-3xl p-6 border shadow-lg"
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center gap-4 mb-6">
        <View
          className="w-14 h-14 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.success + "20" }}
        >
          <Ionicons name="document-text" size={28} color={colors.success} />
        </View>
        <View className="flex-1">
          <Text
            className="text-xl font-bold"
            style={{ color: colors.text.primary }}
          >
            PDF Reports
          </Text>
          <Text
            className="text-sm mt-1"
            style={{ color: colors.text.secondary }}
          >
            Export transactions as PDF reports
          </Text>
        </View>
      </View>

      <View className="gap-3">
        {reports.map((report) => {
          const color = colors[report.colorKey];
          return (
            <TouchableOpacity
              key={report.type}
              onPress={() => onExport(report.type)}
              disabled={exportingType !== null}
              className="flex-row items-center gap-4 rounded-2xl p-4 active:scale-98"
              style={{
                backgroundColor: color + "15",
                opacity: exportingType !== null ? 0.7 : 1,
              }}
            >
              <View
                className="w-12 h-12 rounded-full items-center justify-center"
                style={{ backgroundColor: color + "30" }}
              >
                {exportingType === report.type ? (
                  <ActivityIndicator size="small" color={color} />
                ) : (
                  <Ionicons name={report.icon} size={24} color={color} />
                )}
              </View>
              <View className="flex-1">
                <Text
                  className="font-bold text-base"
                  style={{ color: colors.text.primary }}
                >
                  {exportingType === report.type
                    ? "Exporting..."
                    : report.title}
                </Text>
                <Text
                  className="text-sm"
                  style={{ color: colors.text.secondary }}
                >
                  {report.subtitle}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
