import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import type { Transaction } from "../services/transactions";
import { usePreferences } from "../hooks/usePreferences";
import { useTheme } from "../hooks/useTheme";

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
  const { colors } = useTheme();
  const isCredit = transaction.type === "credit";
  const amountColor = isCredit ? colors.success : colors.error;
  const accountKindLabel = transaction.account?.kind
    ? transaction.account.kind.replace(/_/g, " ")
    : "Account";

  return (
    <View
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
      }}
      className="rounded-2xl p-3 border shadow-sm"
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-4">
          <View className="flex-row items-center gap-2">
            <View
              style={{
                backgroundColor: isCredit ? colors.success : colors.error,
              }}
              className="w-3 h-3 rounded-full"
            />
            <Text
              style={{ color: colors.text.primary }}
              className="font-bold text-lg"
            >
              {transaction.account?.name ?? "N/A"}
            </Text>
          </View>
          <Text
            style={{ color: colors.text.tertiary }}
            className="text-sm mt-1"
          >
            {dayjs(transaction.date).format("MMM D, YYYY")}
          </Text>
        </View>
        <View className="items-end">
          <Text style={{ color: amountColor }} className="text-xl font-bold">
            {isCredit ? "+" : "-"}
            {formatAmount(transaction.amount)}
          </Text>
          <View
            style={{
              backgroundColor: isCredit
                ? colors.success + "20"
                : colors.error + "20",
            }}
            className="px-2 py-1 rounded-full"
          >
            <Text
              style={{ color: amountColor }}
              className="text-xs font-medium"
            >
              {transaction.type.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {transaction.description ? (
        <Text
          style={{ color: colors.text.secondary }}
          className="mt-3 text-sm leading-5"
        >
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
            style={{
              backgroundColor: colors.info + "25",
              borderColor: colors.info + "40",
            }}
            className="self-start mt-3 px-3 py-1 rounded-full border"
          >
            <Text
              style={{ color: colors.info }}
              className="text-xs font-semibold"
            >
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
            style={{
              backgroundColor: colors.info + "25",
              borderColor: colors.info + "40",
            }}
            className="self-start mt-3 px-3 py-1 rounded-full border"
          >
            <Text
              style={{ color: colors.info }}
              className="text-xs font-semibold"
            >
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
        <View
          style={{ borderColor: colors.border }}
          className="flex-row justify-end pt-2 border-t"
        >
          <TouchableOpacity
            onPress={() => onEdit(transaction)}
            style={{ backgroundColor: colors.info + "20" }}
            className="flex-row items-center gap-1.5 px-3 py-2 rounded-lg active:scale-95"
          >
            <Ionicons name="create-outline" size={16} color={colors.info} />
            <Text
              style={{ color: colors.info }}
              className="text-xs font-semibold"
            >
              Edit
            </Text>
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
  },
);
