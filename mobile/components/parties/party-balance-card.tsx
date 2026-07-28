import { Text, View } from "react-native";
import { useTheme } from "@/hooks/use-theme";

type PartyBalanceCardProps = {
  balance: number;
  formatBalance: (balance: number) => string;
};

export function PartyBalanceCard({
  balance,
  formatBalance,
}: PartyBalanceCardProps) {
  const { colors } = useTheme();

  const balanceColor =
    balance > 0
      ? colors.success
      : balance < 0
        ? colors.error
        : colors.text.secondary;

  return (
    <View
      className="mt-6 p-4 rounded-xl"
      style={{ backgroundColor: colors.bg.tertiary }}
    >
      <Text className="text-sm" style={{ color: colors.text.secondary }}>
        Current Balance
      </Text>
      <Text
        className="text-2xl font-bold mt-1"
        style={{ color: balanceColor }}
      >
        {formatBalance(balance)}
      </Text>
    </View>
  );
}
