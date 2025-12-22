import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Account } from "@/types/account";

type AccountHeaderProps = {
  account: Account;
  lastActivityLabel: string;
  formatAmount: (
    amount: number,
    options?: { showCurrency?: boolean }
  ) => string;
};

export function AccountHeader({
  account,
  lastActivityLabel,
  formatAmount,
}: AccountHeaderProps) {
  const balancePositive = (account?.balance ?? 0) >= 0;

  return (
    <View className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-gray-500">
              Last activity: {lastActivityLabel}
            </Text>
          </View>
          {account?.description ? (
            <Text className="text-gray-600 text-sm mt-3 leading-5">
              {account.description}
            </Text>
          ) : null}
        </View>
        <View className="items-end">
          <Text className="text-gray-500 text-xs font-semibold uppercase">
            Balance
          </Text>
          <Text
            className={`text-3xl font-bold ${
              balancePositive ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {formatAmount(Math.abs(account?.balance ?? 0))}
          </Text>
        </View>
      </View>
    </View>
  );
}
