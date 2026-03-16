import { Text, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import type { AccountSummary } from "@/types/account";

type AccountSummaryCardProps = {
  summary: AccountSummary;
  netFlow: number;
  formatAmount: (
    amount: number,
    options?: { showCurrency?: boolean },
  ) => string;
};

export function AccountSummaryCard({
  summary,
  netFlow,
  formatAmount,
}: AccountSummaryCardProps) {
  const { colors } = useTheme();
  const netPositive = netFlow >= 0;

  return (
    <View
      className="rounded-2xl p-5 border"
      style={{ backgroundColor: colors.card, borderColor: colors.border }}
    >
      <Text
        className="font-bold text-lg mb-4"
        style={{ color: colors.text.primary }}
      >
        Account Summary
      </Text>
      <View className="flex-row gap-3">
        <View
          className="flex-1 rounded-xl p-3"
          style={{ backgroundColor: colors.info + "12" }}
        >
          <Text
            className="text-xs font-semibold uppercase"
            style={{ color: colors.info }}
          >
            Total Credit
          </Text>
          <Text
            className="text-xl font-bold mt-1"
            style={{ color: colors.info }}
          >
            {formatAmount(summary?.totalCredit ?? 0)}
          </Text>
        </View>
        <View
          className="flex-1 rounded-xl p-3"
          style={{ backgroundColor: colors.error + "12" }}
        >
          <Text
            className="text-xs font-semibold uppercase"
            style={{ color: colors.error }}
          >
            Total Debit
          </Text>
          <Text
            className="text-xl font-bold mt-1"
            style={{ color: colors.error }}
          >
            {formatAmount(summary?.totalDebit ?? 0)}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-3 mt-3">
        <View
          className="flex-1 rounded-xl p-3"
          style={{
            backgroundColor:
              (netPositive ? colors.success : colors.error) + "12",
          }}
        >
          <Text
            className="text-xs font-semibold uppercase"
            style={{ color: netPositive ? colors.success : colors.error }}
          >
            Net Flow
          </Text>
          <Text
            className="text-xl font-bold mt-1"
            style={{ color: netPositive ? colors.success : colors.error }}
          >
            {`${netPositive ? "+" : "-"}${formatAmount(Math.abs(netFlow))}`}
          </Text>
        </View>
        <View
          className="flex-1 rounded-xl p-3"
          style={{ backgroundColor: colors.bg.tertiary }}
        >
          <Text
            className="text-xs font-semibold uppercase"
            style={{ color: colors.text.secondary }}
          >
            Transactions
          </Text>
          <Text
            className="text-xl font-bold mt-1"
            style={{ color: colors.text.primary }}
          >
            {formatAmount(summary?.totalTransactions ?? 0, {
              showCurrency: false,
            })}
          </Text>
        </View>
      </View>
    </View>
  );
}
