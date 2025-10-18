import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import type { Transaction } from "../services/transactions";
import { usePreferences } from "../hooks/usePreferences";

type Props = {
  transaction: Transaction;
  onCategoryPress?: (categoryId: string) => void;
  onCounterpartyPress?: (counterparty: string) => void;
  onEdit?: (transaction: Transaction) => void;
};

const TransactionCardComponent = ({
  transaction,
  onCategoryPress,
  onCounterpartyPress,
  onEdit,
}: Props) => {
  const { formatAmount } = usePreferences();
  const isCredit = transaction.type === "credit";
  const amountColor = isCredit ? "text-green-600" : "text-red-600";
  const accountKindLabel = transaction.account?.kind
    ? transaction.account.kind.replace(/_/g, " ")
    : "Account";

  return (
    <View className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
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
            {isCredit ? "+" : "-"}
            {formatAmount(transaction.amount)}
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

      <View className="flex-row flex-wrap mt-2 gap-x-4">
        {transaction.category ? (
          <TouchableOpacity
            activeOpacity={onCategoryPress ? 0.8 : 1}
            onPress={() => {
              if (transaction.category?._id && onCategoryPress) {
                onCategoryPress(transaction.category._id);
              }
            }}
            className="self-start mt-3 px-3 py-1 rounded-full bg-blue-50 border border-blue-100"
          >
            <Text className="text-xs font-semibold text-blue-700">
              {transaction.category.name}
            </Text>
          </TouchableOpacity>
        ) : null}
        {transaction.counterparty ? (
          <TouchableOpacity
            activeOpacity={onCounterpartyPress ? 0.8 : 1}
            onPress={() => {
              if (transaction.counterparty && onCounterpartyPress) {
                onCounterpartyPress(transaction.counterparty);
              }
            }}
            className="self-start mt-3 px-3 py-1 rounded-full bg-blue-50 border border-blue-100"
          >
            <Text className="text-xs font-semibold text-blue-700">
              Counterparty: {transaction.counterparty}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-gray-100">
        <Text className="text-xs text-gray-500 font-medium">
          {transaction.category?.name ?? accountKindLabel}
        </Text>
      </View> */}

      {onEdit && !transaction.is_deleted ? (
        <View className="flex-row justify-end pt-2 border-t border-gray-100">
          <TouchableOpacity
            onPress={() => onEdit(transaction)}
            className="flex-row items-center gap-1.5 bg-blue-50 px-3 py-2 rounded-lg active:scale-95"
          >
            <Ionicons name="create-outline" size={16} color="#2563eb" />
            <Text className="text-xs font-semibold text-blue-600">Edit</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

// Memoize the component with custom comparison
export const TransactionCard = memo(
  TransactionCardComponent,
  (prevProps, nextProps) => {
    // Only re-render if transaction ID or callbacks change
    return (
      prevProps.transaction._id === nextProps.transaction._id &&
      prevProps.transaction.amount === nextProps.transaction.amount &&
      prevProps.transaction.type === nextProps.transaction.type &&
      prevProps.transaction.description === nextProps.transaction.description &&
      prevProps.transaction.date === nextProps.transaction.date &&
      prevProps.transaction.account?.name ===
        nextProps.transaction.account?.name &&
      prevProps.transaction.category?.name ===
        nextProps.transaction.category?.name &&
      prevProps.transaction.counterparty ===
        nextProps.transaction.counterparty &&
      prevProps.onCategoryPress === nextProps.onCategoryPress &&
      prevProps.onCounterpartyPress === nextProps.onCounterpartyPress
    );
  }
);
