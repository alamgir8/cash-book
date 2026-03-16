import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import type { Account } from "@/types/account";

type AccountHeaderProps = {
  account: Account;
  lastActivityLabel: string;
  formatAmount: (
    amount: number,
    options?: { showCurrency?: boolean },
  ) => string;
};

export function AccountHeader({
  account,
  lastActivityLabel,
  formatAmount,
}: AccountHeaderProps) {
  const { colors } = useTheme();
  const balancePositive = (account?.balance ?? 0) >= 0;

  return (
    <View
      className="rounded-2xl p-5 border"
      style={{ backgroundColor: colors.card, borderColor: colors.border }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <View className="flex-row items-center gap-2">
            <Text className="text-xs" style={{ color: colors.text.tertiary }}>
              Last activity: {lastActivityLabel}
            </Text>
          </View>
          {account?.description ? (
            <Text
              className="text-sm mt-3 leading-5"
              style={{ color: colors.text.secondary }}
            >
              {account.description}
            </Text>
          ) : null}
        </View>
        <View className="items-end">
          <Text
            className="text-xs font-semibold uppercase"
            style={{ color: colors.text.tertiary }}
          >
            Balance
          </Text>
          <Text
            className="text-3xl font-bold"
            style={{ color: balancePositive ? colors.success : colors.error }}
          >
            {formatAmount(Math.abs(account?.balance ?? 0))}
          </Text>
        </View>
      </View>
    </View>
  );
}
