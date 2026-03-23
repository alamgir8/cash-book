import { Text, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";

type PartyBalanceCardProps = {
  balance: number;
  formatBalance: (balance: number) => string;
  getBalanceColor: (balance: number) => string;
};

export function PartyBalanceCard({
  balance,
  formatBalance,
  getBalanceColor,
}: PartyBalanceCardProps) {
  const { colors } = useTheme();

  return (
    <View className="mt-6 p-4 rounded-xl" style={{ backgroundColor: colors.bg.secondary }}>
      <Text className="text-sm" style={{ color: colors.text.tertiary }}>Current Balance</Text>
      <Text className={`text-2xl font-bold mt-1 ${getBalanceColor(balance)}`}>
        {formatBalance(balance)}
      </Text>
    </View>
  );
}
