import { View, Text } from "react-native";
import dayjs from "dayjs";
import type { Transaction } from "../services/transactions";

type Props = {
  transaction: Transaction;
};

export const TransactionCard = ({ transaction }: Props) => {
  const isCredit = transaction.type === "credit";
  const amountColor = isCredit ? "text-green-600" : "text-red-600";

  return (
    <View className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-4">
          <View className="flex-row items-center gap-2">
            <View
              className={`w-3 h-3 rounded-full ${
                isCredit ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <Text className="text-gray-900 font-bold text-lg">
              {transaction.account?.name ?? "N/A"}
            </Text>
          </View>
          <Text className="text-gray-500 text-sm mt-1">
            {dayjs(transaction.date).format("MMM D, YYYY")}
          </Text>
        </View>
        <View className="items-end">
          <Text className={`text-xl font-bold ${amountColor}`}>
            {isCredit ? "+" : "-"}$
            {Math.round(transaction.amount).toLocaleString()}
          </Text>
          <View
            className={`px-2 py-1 rounded-full ${
              isCredit ? "bg-green-50" : "bg-red-50"
            }`}
          >
            <Text className={`text-xs font-medium ${amountColor}`}>
              {transaction.type.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {transaction.description ? (
        <Text className="text-gray-700 mt-3 text-sm leading-5">
          {transaction.description}
        </Text>
      ) : null}

      <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-gray-100">
        <Text className="text-xs text-gray-500 font-medium">
          {transaction.account?.type || "Account"}
        </Text>
        {transaction.createdViaVoice ? (
          <View className="flex-row items-center gap-1 bg-blue-50 px-2 py-1 rounded-full">
            <Text className="text-xs text-blue-700 font-medium">🎤 Voice</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};
