import { Text, View } from "react-native";
import type { AccountSummary } from "@/types/account";

type AccountSummaryCardProps = {
  summary: AccountSummary;
  netFlow: number;
  formatAmount: (
    amount: number,
    options?: { showCurrency?: boolean }
  ) => string;
};

export function AccountSummaryCard({
  summary,
  netFlow,
  formatAmount,
}: AccountSummaryCardProps) {
  const netPositive = netFlow >= 0;

  return (
    <View className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <Text className="text-gray-900 font-bold text-lg mb-4">
        Account Summary
      </Text>
      <View className="flex-row gap-3">
        <View className="flex-1 bg-blue-50 rounded-xl p-3 border border-blue-100">
          <Text className="text-xs font-semibold text-blue-600 uppercase">
            Total Credit
          </Text>
          <Text className="text-xl font-bold text-blue-700 mt-1">
            {formatAmount(summary?.totalCredit ?? 0)}
          </Text>
        </View>
        <View className="flex-1 bg-amber-50 rounded-xl p-3 border border-amber-100">
          <Text className="text-xs font-semibold text-amber-600 uppercase">
            Total Debit
          </Text>
          <Text className="text-xl font-bold text-amber-700 mt-1">
            {formatAmount(summary?.totalDebit ?? 0)}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-3 mt-3">
        <View
          className={`flex-1 rounded-xl p-3 border ${
            netPositive
              ? "bg-emerald-50 border-emerald-100"
              : "bg-rose-50 border-rose-100"
          }`}
        >
          <Text
            className={`text-xs font-semibold uppercase ${
              netPositive ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            Net Flow
          </Text>
          <Text
            className={`text-xl font-bold mt-1 ${
              netPositive ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {`${netPositive ? "+" : "-"}${formatAmount(Math.abs(netFlow))}`}
          </Text>
        </View>
        <View className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-200">
          <Text className="text-xs font-semibold text-gray-600 uppercase">
            Transactions
          </Text>
          <Text className="text-xl font-bold text-gray-700 mt-1">
            {formatAmount(summary?.totalTransactions ?? 0, {
              showCurrency: false,
            })}
          </Text>
        </View>
      </View>
    </View>
  );
}
