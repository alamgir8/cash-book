import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type ExportType = "all" | "category" | "counterparty" | "account" | null;

interface PDFReportsSectionProps {
  exportingType: ExportType;
  onExport: (type: ExportType) => void;
}

export function PDFReportsSection({
  exportingType,
  onExport,
}: PDFReportsSectionProps) {
  const reports = [
    {
      type: "all" as const,
      title: "All Transactions",
      subtitle: "Complete transaction list",
      icon: "list" as const,
      color: "#16a34a",
      bgColor: "bg-green-50",
      iconBgColor: "bg-green-100",
    },
    {
      type: "category" as const,
      title: "By Category",
      subtitle: "Grouped by transaction category",
      icon: "pricetags" as const,
      color: "#8b5cf6",
      bgColor: "bg-purple-50",
      iconBgColor: "bg-purple-100",
    },
    {
      type: "counterparty" as const,
      title: "By Counterparty",
      subtitle: "Grouped by customer/supplier",
      icon: "people" as const,
      color: "#ea580c",
      bgColor: "bg-orange-50",
      iconBgColor: "bg-orange-100",
    },
    {
      type: "account" as const,
      title: "By Account",
      subtitle: "Grouped by payment account",
      icon: "wallet" as const,
      color: "#3b82f6",
      bgColor: "bg-blue-50",
      iconBgColor: "bg-blue-100",
    },
  ];

  return (
    <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg">
      <View className="flex-row items-center gap-4 mb-6">
        <View className="w-14 h-14 bg-gradient-to-br from-green-100 to-green-200 rounded-full items-center justify-center">
          <Ionicons name="document-text" size={28} color="#16a34a" />
        </View>
        <View className="flex-1">
          <Text className="text-gray-900 text-xl font-bold">PDF Reports</Text>
          <Text className="text-gray-600 text-sm mt-1">
            Export transactions as PDF reports
          </Text>
        </View>
      </View>

      <View className="gap-3">
        {reports.map((report) => (
          <TouchableOpacity
            key={report.type}
            onPress={() => onExport(report.type)}
            disabled={exportingType !== null}
            className={`flex-row items-center gap-4 ${report.bgColor} rounded-2xl p-4 active:scale-98`}
            style={{ opacity: exportingType !== null ? 0.7 : 1 }}
          >
            <View
              className={`w-12 h-12 ${report.iconBgColor} rounded-full items-center justify-center`}
            >
              {exportingType === report.type ? (
                <ActivityIndicator size="small" color={report.color} />
              ) : (
                <Ionicons name={report.icon} size={24} color={report.color} />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 font-bold text-base">
                {exportingType === report.type ? "Exporting..." : report.title}
              </Text>
              <Text className="text-gray-600 text-sm">{report.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
