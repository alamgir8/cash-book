import { Text, View } from "react-native";

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
  return (
    <View className="mt-6 p-4 bg-gray-50 rounded-xl">
      <Text className="text-sm text-gray-500">Current Balance</Text>
      <Text className={`text-2xl font-bold mt-1 ${getBalanceColor(balance)}`}>
        {formatBalance(balance)}
      </Text>
    </View>
  );
}
