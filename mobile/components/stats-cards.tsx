import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePreferences } from "../hooks/usePreferences";
import { useTheme } from "../hooks/useTheme";
import { useMemo } from "react";

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
  } | null;
};

/**
 * Calculate percentage change between two values
 * Returns null if previous value is 0 (can't calculate percentage)
 */
const calculateTrend = (
  current: number,
  previous: number,
): { value: string; isPositive: boolean } | null => {
  if (previous === 0) {
    // If previous is 0 but current has value, show as new
    if (current > 0) {
      return { value: "New", isPositive: true };
    }
    return null;
  }

  const percentChange = ((current - previous) / previous) * 100;
  const absChange = Math.abs(percentChange);

  // Format the percentage
  let formattedValue: string;
  if (absChange >= 100) {
    formattedValue = `${Math.round(absChange)}%`;
  } else if (absChange >= 10) {
    formattedValue = `${absChange.toFixed(0)}%`;
  } else {
    formattedValue = `${absChange.toFixed(1)}%`;
  }

  return {
    value: formattedValue,
    isPositive: percentChange >= 0,
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
}: StatCardProps) => {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
      }}
      className="rounded-2xl p-5 border shadow-sm"
    >
      <View className="flex-row items-center justify-between mb-3">
        <View
          style={{
            backgroundColor: colors.bg.tertiary,
          }}
          className="w-12 h-12 rounded-full items-center justify-center"
        >
          <Ionicons name={icon} size={24} color={iconColor} />
        </View>
        {trend && (
          <View
            style={{
              backgroundColor: trend.isPositive
                ? colors.success + "20"
                : colors.error + "20",
            }}
            className="flex-row items-center gap-1 px-2 py-1 rounded-full"
          >
            <Ionicons
              name={trend.isPositive ? "trending-up" : "trending-down"}
              size={12}
              color={trend.isPositive ? colors.success : colors.error}
            />
            <Text
              style={{
                color: trend.isPositive ? colors.success : colors.error,
              }}
              className="text-xs font-bold"
            >
              {trend.value}
            </Text>
          </View>
        )}
      </View>

      <View>
        <Text
          style={{ color: colors.text.secondary }}
          className="text-sm font-medium"
        >
          {title}
        </Text>
        <Text style={{ color: valueColor }} className="text-2xl font-bold mt-1">
          {value}
        </Text>
        <Text style={{ color: colors.text.tertiary }} className="text-xs mt-1">
          {subtitle}
        </Text>
      </View>
    </View>
  );
};

type StatsCardsProps = {
  totalDebit: number;
  totalCredit: number;
  transactionCount: number;
  accountCount: number;
  isLoading?: boolean;
  // Previous period data for trend calculation
  previousDebit?: number;
  previousCredit?: number;
  previousTransactionCount?: number;
};

export const StatsCards = ({
  totalDebit,
  totalCredit,
  transactionCount,
  accountCount,
  isLoading = false,
  previousDebit = 0,
  previousCredit = 0,
  previousTransactionCount = 0,
}: StatsCardsProps) => {
  const { formatAmount } = usePreferences();

  // Calculate trends
  const incomeTrend = useMemo(
    () => calculateTrend(totalCredit, previousCredit),
    [totalCredit, previousCredit],
  );

  const expenseTrend = useMemo(() => {
    const trend = calculateTrend(totalDebit, previousDebit);
    if (!trend) return null;
    // For expenses, lower is better, so flip the isPositive logic
    return {
      value: trend.value,
      isPositive: !trend.isPositive, // Decreasing expenses is positive
    };
  }, [totalDebit, previousDebit]);

  const transactionTrend = useMemo(
    () => calculateTrend(transactionCount, previousTransactionCount),
    [transactionCount, previousTransactionCount],
  );

  if (isLoading) {
    const { colors } = useTheme();
    return (
      <View className="gap-4">
        {/* Top Row Skeleton */}
        <View className="flex-row gap-4">
          {/* Income Skeleton - Green Theme */}
          <View
            style={{
              backgroundColor: colors.success + "20",
              borderColor: colors.success + "40",
            }}
            className="flex-1 h-32 rounded-2xl border"
          />
          {/* Expense Skeleton - Red Theme */}
          <View
            style={{
              backgroundColor: colors.error + "20",
              borderColor: colors.error + "40",
            }}
            className="flex-1 h-32 rounded-2xl border"
          />
        </View>

        {/* Net Balance Skeleton - Neutral Theme */}
        <View
          style={{
            backgroundColor: colors.bg.tertiary,
            borderColor: colors.border,
          }}
          className="h-32 rounded-2xl border"
        />

        {/* Bottom Row Skeleton */}
        <View className="flex-row gap-4">
          {/* Transactions Skeleton - Blue Theme */}
          <View
            style={{
              backgroundColor: colors.info + "20",
              borderColor: colors.info + "40",
            }}
            className="flex-1 h-32 rounded-2xl border"
          />
          {/* Accounts Skeleton - Purple Theme */}
          <View
            style={{
              backgroundColor: colors.warning + "20",
              borderColor: colors.warning + "40",
            }}
            className="flex-1 h-32 rounded-2xl border"
          />
        </View>
      </View>
    );
  }

  const netBalance = totalCredit - totalDebit;
  const isPositiveBalance = netBalance >= 0;
  const { colors } = useTheme();

  return (
    <View className="gap-4">
      {/* Top Row - Balance Cards */}
      <View className="flex-row gap-4">
        <StatCard
          title="Total Income"
          value={formatAmount(totalCredit)}
          subtitle="Credit transactions"
          icon="trending-up"
          iconColor={colors.success}
          iconBgColor="bg-green-50"
          valueColor={colors.success}
          trend={incomeTrend}
        />
        <StatCard
          title="Total Expenses"
          value={formatAmount(totalDebit)}
          subtitle="Debit transactions"
          icon="trending-down"
          iconColor={colors.error}
          iconBgColor="bg-red-50"
          valueColor={colors.error}
          trend={expenseTrend}
        />
      </View>

      {/* Net Balance Card */}
      <View
        style={{
          backgroundColor: isPositiveBalance
            ? colors.success + "15"
            : colors.error + "15",
          borderColor: isPositiveBalance
            ? colors.success + "40"
            : colors.error + "40",
        }}
        className="rounded-2xl p-6 border shadow-sm"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text
              style={{ color: colors.text.secondary }}
              className="text-sm font-medium"
            >
              Net Balance
            </Text>
            <Text
              style={{
                color: isPositiveBalance ? colors.success : colors.error,
              }}
              className="text-3xl font-bold mt-2"
            >
              {formatAmount(Math.abs(netBalance))}
            </Text>
            <Text
              style={{ color: colors.text.tertiary }}
              className="text-sm mt-1"
            >
              {isPositiveBalance
                ? "Surplus this period"
                : "Deficit this period"}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: isPositiveBalance
                ? colors.success + "25"
                : colors.error + "25",
            }}
            className="w-16 h-16 rounded-full items-center justify-center"
          >
            <Ionicons
              name={isPositiveBalance ? "checkmark-circle" : "alert-circle"}
              size={32}
              color={isPositiveBalance ? colors.success : colors.error}
            />
          </View>
        </View>
      </View>

      {/* Bottom Row - Activity Cards */}
      <View className="flex-row gap-4">
        <StatCard
          title="Transactions"
          value={formatAmount(transactionCount, { showCurrency: false })}
          subtitle="This period"
          icon="receipt"
          iconColor={colors.info}
          iconBgColor="bg-blue-50"
          valueColor={colors.info}
          trend={transactionTrend}
        />
        <StatCard
          title="Active Accounts"
          value={formatAmount(accountCount, { showCurrency: false })}
          subtitle="Total accounts"
          icon="wallet"
          iconColor={colors.warning}
          iconBgColor="bg-purple-50"
          valueColor={colors.warning}
        />
      </View>
    </View>
  );
};
