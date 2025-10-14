import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePreferences } from "../hooks/usePreferences";

type StatCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBgColor: string;
  valueColor: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
};

const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  iconColor,
  iconBgColor,
  valueColor,
  trend,
}: StatCardProps) => (
  <View className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex-1">
    <View className="flex-row items-center justify-between mb-3">
      <View
        className={`w-12 h-12 ${iconBgColor} rounded-full items-center justify-center`}
      >
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      {trend && (
        <View
          className={`flex-row items-center gap-1 px-2 py-1 rounded-full ${
            trend.isPositive ? "bg-green-50" : "bg-red-50"
          }`}
        >
          <Ionicons
            name={trend.isPositive ? "trending-up" : "trending-down"}
            size={12}
            color={trend.isPositive ? "#10b981" : "#ef4444"}
          />
          <Text
            className={`text-xs font-bold ${
              trend.isPositive ? "text-green-700" : "text-red-700"
            }`}
          >
            {trend.value}
          </Text>
        </View>
      )}
    </View>

    <View>
      <Text className="text-gray-600 text-sm font-medium">{title}</Text>
      <Text className={`text-2xl font-bold ${valueColor} mt-1`}>{value}</Text>
      <Text className="text-gray-500 text-xs mt-1">{subtitle}</Text>
    </View>
  </View>
);

type StatsCardsProps = {
  totalDebit: number;
  totalCredit: number;
  transactionCount: number;
  accountCount: number;
};

export const StatsCards = ({
  totalDebit,
  totalCredit,
  transactionCount,
  accountCount,
}: StatsCardsProps) => {
  const { formatAmount } = usePreferences();
  const netBalance = totalCredit - totalDebit;
  const isPositiveBalance = netBalance >= 0;

  return (
    <View className="gap-4">
      {/* Top Row - Balance Cards */}
      <View className="flex-row gap-4">
        <StatCard
          title="Total Income"
          value={formatAmount(totalCredit)}
          subtitle="Credit transactions"
          icon="trending-up"
          iconColor="#10b981"
          iconBgColor="bg-green-50"
          valueColor="text-green-600"
          trend={{
            value: "12%",
            isPositive: true,
          }}
        />
        <StatCard
          title="Total Expenses"
          value={formatAmount(totalDebit)}
          subtitle="Debit transactions"
          icon="trending-down"
          iconColor="#ef4444"
          iconBgColor="bg-red-50"
          valueColor="text-red-600"
          trend={{
            value: "8%",
            isPositive: false,
          }}
        />
      </View>

      {/* Net Balance Card */}
      <View
        className={`rounded-2xl bg-white p-6 border shadow-sm ${
          isPositiveBalance
            ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-100"
            : "bg-gradient-to-r from-red-50 to-rose-50 border-red-100"
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-gray-600 text-sm font-medium">
              Net Balance
            </Text>
            <Text
              className={`text-3xl font-bold ${
                isPositiveBalance ? "text-green-700" : "text-red-700"
              } mt-2`}
            >
              {formatAmount(Math.abs(netBalance))}
            </Text>
            <Text className="text-gray-500 text-sm mt-1">
              {isPositiveBalance
                ? "Surplus this period"
                : "Deficit this period"}
            </Text>
          </View>
          <View
            className={`w-16 h-16 rounded-full items-center justify-center ${
              isPositiveBalance ? "bg-green-100" : "bg-red-100"
            }`}
          >
            <Ionicons
              name={isPositiveBalance ? "checkmark-circle" : "alert-circle"}
              size={32}
              color={isPositiveBalance ? "#10b981" : "#ef4444"}
            />
          </View>
        </View>
      </View>

      {/* Bottom Row - Activity Cards */}
      <View className="flex-row gap-4">
        <StatCard
          title="Transactions"
          value={transactionCount.toString()}
          subtitle="This period"
          icon="receipt"
          iconColor="#3b82f6"
          iconBgColor="bg-blue-50"
          valueColor="text-blue-600"
        />
        <StatCard
          title="Active Accounts"
          value={accountCount.toString()}
          subtitle="Total accounts"
          icon="wallet"
          iconColor="#8b5cf6"
          iconBgColor="bg-purple-50"
          valueColor="text-purple-600"
        />
      </View>
    </View>
  );
};
