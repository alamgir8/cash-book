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
  onDelete?: (transaction: Transaction) => void;
  onAttachmentsPress?: (transaction: Transaction) => void;
  onPayDue?: (transaction: Transaction) => void; // "Record Payment" button
  onViewChain?: (transaction: Transaction) => void; // "View History" button
};

const TransactionCardComponent = ({
  transaction,
  onCategoryPress,
  onCounterpartyPress,
  onEdit,
  onDelete,
  onAttachmentsPress,
  onPayDue,
  onViewChain,
}: Props) => {
  const attachmentCount = transaction.attachments?.length ?? 0;
  const { formatAmount } = usePreferences();
  const { colors } = useTheme();
  const isCredit = transaction.type === "credit";
  const amountColor = isCredit ? colors.success : colors.error;

  const isDue = transaction.payment_status === "due";
  const isPayment = !!transaction.parent_due_id; // payment linked to a due
  const hasChain = isDue || isPayment;
  const remaining = transaction.due_remaining ?? transaction.amount;
  const isSettled = isDue && remaining === 0;

  return (
    <View
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: isDue && !isSettled ? "#d97706" + "60" : colors.border,
        borderWidth: isDue && !isSettled ? 1.5 : 1,
      }}
      className="rounded-2xl p-3 shadow-sm"
    >
      {/* Due / Payment badge row */}
      {(isDue || isPayment) && (
        <View className="flex-row gap-2 mb-2">
          {isDue && (
            <View
              className="flex-row items-center gap-1 px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: isSettled
                  ? "#16a34a" + "20"
                  : "#d97706" + "20",
              }}
            >
              <Ionicons
                name={isSettled ? "checkmark-circle" : "time-outline"}
                size={12}
                color={isSettled ? "#16a34a" : "#d97706"}
              />
              <Text
                className="text-xs font-bold"
                style={{ color: isSettled ? "#16a34a" : "#d97706" }}
              >
                {isSettled
                  ? "Settled"
                  : `Due · ${formatAmount(remaining)} left`}
              </Text>
            </View>
          )}
          {isPayment && (
            <View
              className="flex-row items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#16a34a" + "20" }}
            >
              <Ionicons name="cash-outline" size={12} color="#16a34a" />
              <Text className="text-xs font-bold" style={{ color: "#16a34a" }}>
                Payment
              </Text>
            </View>
          )}
          {transaction.due_date && isDue && !isSettled && (
            <View
              className="flex-row items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ backgroundColor: colors.bg.tertiary }}
            >
              <Ionicons
                name="calendar-outline"
                size={12}
                color={colors.text.tertiary}
              />
              <Text className="text-xs" style={{ color: colors.text.tertiary }}>
                Due {dayjs(transaction.due_date).format("MMM D")}
              </Text>
            </View>
          )}
        </View>
      )}

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

      {/* Vendor tag */}
      {transaction.vendor ? (
        <Text className="text-xs mt-1" style={{ color: colors.text.tertiary }}>
          <Text style={{ color: colors.text.secondary }}>Vendor: </Text>
          {transaction.vendor}
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
              For: {transaction.counterparty}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Action row */}
      {!transaction.is_deleted ? (
        <View
          style={{ borderColor: colors.border }}
          className="pt-2 mt-2 border-t"
        >
          {/* Due chain actions (Pay / History) */}
          {(isDue && !isSettled && onPayDue) || (hasChain && onViewChain) ? (
            <View className="flex-row gap-2 mb-2">
              {isDue && !isSettled && onPayDue && (
                <TouchableOpacity
                  onPress={() => onPayDue(transaction)}
                  style={{ backgroundColor: "#d97706" + "20" }}
                  className="flex-1 flex-row justify-center items-center gap-1.5 px-3 py-2 rounded-lg"
                >
                  <Ionicons name="cash-outline" size={16} color="#d97706" />
                  <Text
                    style={{ color: "#d97706" }}
                    className="text-xs font-semibold"
                  >
                    Pay
                  </Text>
                </TouchableOpacity>
              )}
              {hasChain && onViewChain && (
                <TouchableOpacity
                  onPress={() => onViewChain(transaction)}
                  style={{ backgroundColor: colors.bg.tertiary }}
                  className="flex-1 flex-row justify-center items-center gap-1.5 px-3 py-2 rounded-lg"
                >
                  <Ionicons
                    name="git-branch-outline"
                    size={16}
                    color={colors.text.secondary}
                  />
                  <Text
                    style={{ color: colors.text.secondary }}
                    className="text-xs font-semibold"
                  >
                    History
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* Attach / Edit / Delete — spread between */}
          <View className="flex-row items-center gap-2">
            {onAttachmentsPress ? (
              <TouchableOpacity
                onPress={() => onAttachmentsPress(transaction)}
                style={{ backgroundColor: colors.warning + "20" }}
                className="flex-1 flex-row justify-center items-center gap-1.5 px-3 py-2 rounded-lg"
              >
                <Ionicons name="attach" size={16} color={colors.warning} />
                <Text
                  style={{ color: colors.warning }}
                  className="text-xs font-semibold"
                >
                  {attachmentCount > 0
                    ? `${attachmentCount} file${attachmentCount > 1 ? "s" : ""}`
                    : "Attach"}
                </Text>
              </TouchableOpacity>
            ) : null}

            {onEdit ? (
              <TouchableOpacity
                onPress={() => onEdit(transaction)}
                style={{ backgroundColor: colors.info + "20" }}
                className="flex-1 flex-row justify-center items-center gap-1.5 px-3 py-2 rounded-lg"
              >
                <Ionicons name="create-outline" size={16} color={colors.info} />
                <Text
                  style={{ color: colors.info }}
                  className="text-xs font-semibold"
                >
                  Edit
                </Text>
              </TouchableOpacity>
            ) : null}

            {onDelete ? (
              <TouchableOpacity
                onPress={() => onDelete(transaction)}
                style={{ backgroundColor: colors.error + "20" }}
                className="flex-1 flex-row justify-center items-center gap-1.5 px-3 py-2 rounded-lg"
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} />
                <Text
                  style={{ color: colors.error }}
                  className="text-xs font-semibold"
                >
                  Delete
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
};

export const TransactionCard = memo(
  TransactionCardComponent,
  (prevProps, nextProps) =>
    prevProps.transaction._id === nextProps.transaction._id &&
    prevProps.transaction.amount === nextProps.transaction.amount &&
    prevProps.transaction.type === nextProps.transaction.type &&
    prevProps.transaction.description === nextProps.transaction.description &&
    prevProps.transaction.date === nextProps.transaction.date &&
    prevProps.transaction.due_remaining ===
      nextProps.transaction.due_remaining &&
    prevProps.transaction.payment_status ===
      nextProps.transaction.payment_status &&
    prevProps.transaction.account?.name ===
      nextProps.transaction.account?.name &&
    prevProps.transaction.category?.name ===
      nextProps.transaction.category?.name &&
    prevProps.transaction.counterparty === nextProps.transaction.counterparty &&
    (prevProps.transaction.attachments?.length ?? 0) ===
      (nextProps.transaction.attachments?.length ?? 0) &&
    prevProps.onCategoryPress === nextProps.onCategoryPress &&
    prevProps.onCounterpartyPress === nextProps.onCounterpartyPress &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onPayDue === nextProps.onPayDue &&
    prevProps.onViewChain === nextProps.onViewChain &&
    prevProps.onAttachmentsPress === nextProps.onAttachmentsPress,
);
