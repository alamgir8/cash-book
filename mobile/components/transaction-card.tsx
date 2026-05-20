import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import type { Transaction } from "../services/transactions";
import { usePreferences } from "../hooks/use-preferences";
import { useTheme } from "../hooks/use-theme";
import { useTranslation } from "../hooks/use-translation";

type Props = {
  transaction: Transaction;
  onCategoryPress?: (categoryId: string) => void;
  onCounterpartyPress?: (counterparty: string) => void;
  onVendorPress?: (vendor: string) => void;
  onPaymentStatusPress?: (status: "paid" | "due") => void;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  onAttachmentsPress?: (transaction: Transaction) => void;
  onPayDue?: (transaction: Transaction) => void;
  onViewChain?: (transaction: Transaction) => void;
};

const TransactionCardComponent = ({
  transaction,
  onCategoryPress,
  onCounterpartyPress,
  onVendorPress,
  onPaymentStatusPress,
  onEdit,
  onDelete,
  onAttachmentsPress,
  onPayDue,
  onViewChain,
}: Props) => {
  const attachmentCount = transaction.attachments?.length ?? 0;
  const { formatAmount } = usePreferences();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isCredit = transaction.type === "credit";
  const amountColor = isCredit ? colors.success : colors.error;

  const isLoanCategory =
    transaction.category?.type === "loan_in" ||
    transaction.category?.type === "loan_out";
  const loanSummary = transaction.loan_summary;
  const loanOutstanding = loanSummary?.outstanding ?? 0;
  const loanIsSettled = !!loanSummary && loanSummary.is_settled;
  const loanDirectionLabel = loanSummary?.owed_by_them
    ? t("theyOwe")
    : loanSummary?.owed_by_me
      ? t("youOwe")
      : t("settled");
  const isLoanLedger = isLoanCategory && !!transaction.counterparty;

  const isDue = !isLoanLedger && transaction.payment_status === "due";
  const isPayment = !isLoanLedger && !!transaction.parent_due_id; // payment linked to a due
  const hasChain = isDue || isPayment || isLoanLedger;
  const remaining = transaction.due_remaining ?? transaction.amount;
  const isSettled = isDue && remaining === 0;

  // For payment cards: check if the parent due still has balance outstanding
  const parentDue =
    isPayment && typeof transaction.parent_due_id === "object"
      ? transaction.parent_due_id
      : null;
  const parentRemaining = parentDue?.due_remaining ?? parentDue?.amount ?? 0;
  const parentIsSettled = !!parentDue && parentRemaining === 0;
  const paymentShowsParentDue = !!parentDue && !parentIsSettled;
  // Reconstruct a minimal Transaction shape to pass to onPayDue from a payment card
  const parentAsDueTxn =
    parentDue && !parentIsSettled
      ? ({
          ...transaction,
          _id: parentDue._id,
          amount: parentDue.amount ?? transaction.amount,
          due_remaining: parentRemaining,
          description: parentDue.description ?? transaction.description,
          vendor: parentDue.vendor ?? transaction.vendor,
          counterparty: parentDue.counterparty ?? transaction.counterparty,
          payment_status: "due" as const,
          parent_due_id: undefined,
        } as any)
      : null;

  return (
    <View
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor:
          (isDue && !isSettled) || (isLoanLedger && !loanIsSettled)
            ? "#d97706" + "60"
            : colors.border,
        borderWidth:
          (isDue && !isSettled) || (isLoanLedger && !loanIsSettled) ? 1.5 : 1,
      }}
      className="rounded-2xl p-3 shadow-sm"
    >
      {/* Due / Payment badge row */}
      {(isDue || isPayment || isLoanLedger) && (
        <View className="flex-row gap-2 mb-2">
          {isLoanLedger && (
            <View
              className="flex-row items-center gap-1 px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: loanIsSettled
                  ? "#16a34a" + "20"
                  : "#d97706" + "20",
              }}
            >
              <Ionicons
                name={loanIsSettled ? "checkmark-circle" : "time-outline"}
                size={12}
                color={loanIsSettled ? "#16a34a" : "#d97706"}
              />
              <Text
                className="text-xs font-bold"
                style={{ color: loanIsSettled ? "#16a34a" : "#d97706" }}
              >
                {loanIsSettled
                  ? `${t("loanSettledBadge")}`
                  : `Loan Due · ${formatAmount(loanOutstanding)} ${loanDirectionLabel}`}
              </Text>
            </View>
          )}
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
                  ? t("settled")
                  : `Due · ${formatAmount(remaining)} left`}
              </Text>
            </View>
          )}
          {isPayment && (
            <View
              className="flex-row items-center gap-1 px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: parentIsSettled
                  ? "#16a34a" + "20"
                  : "#d97706" + "20",
              }}
            >
              <Ionicons
                name={parentIsSettled ? "checkmark-circle" : "cash-outline"}
                size={12}
                color={parentIsSettled ? "#16a34a" : "#d97706"}
              />
              <Text
                className="text-xs font-bold"
                style={{ color: parentIsSettled ? "#16a34a" : "#d97706" }}
              >
                {parentIsSettled
                  ? "Payment · Settled"
                  : parentDue
                    ? `Payment · ${formatAmount(parentRemaining)} left`
                    : "Payment"}
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

      {/* Additional info / comment */}
      {transaction.comment ? (
        <Text
          className="text-xs mt-1 italic"
          style={{ color: colors.text.tertiary }}
        >
          {transaction.comment}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap mt-2 gap-x-2 gap-y-2">
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
            className="px-3 py-1 rounded-full border"
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
            className="px-3 py-1 rounded-full border"
          >
            <Text
              style={{ color: colors.info }}
              className="text-xs font-semibold"
            >
              {t("forLabel")} {transaction.counterparty}
            </Text>
          </TouchableOpacity>
        ) : null}
        {transaction.vendor ? (
          <TouchableOpacity
            activeOpacity={onVendorPress ? 0.8 : 1}
            onPress={() => {
              if (transaction.vendor && onVendorPress) {
                onVendorPress(transaction.vendor);
              }
            }}
            style={{
              backgroundColor: "#f59e0b" + "25",
              borderColor: "#f59e0b" + "40",
            }}
            className="px-3 py-1 rounded-full border"
          >
            <Text
              style={{ color: "#f59e0b" }}
              className="text-xs font-semibold"
            >
              {t("vendorLabel")} {transaction.vendor}
            </Text>
          </TouchableOpacity>
        ) : null}
        {isLoanLedger ? (
          <View
            style={{
              backgroundColor: loanIsSettled
                ? "#16a34a" + "20"
                : "#d97706" + "20",
              borderColor: loanIsSettled ? "#16a34a" + "40" : "#d97706" + "40",
            }}
            className="px-3 py-1 rounded-full border"
          >
            <Text
              style={{ color: loanIsSettled ? "#16a34a" : "#d97706" }}
              className="text-xs font-semibold"
            >
              {loanIsSettled
                ? t("loanSettledBadge")
                : `Loan Due · ${formatAmount(loanOutstanding)} ${loanDirectionLabel}`}
            </Text>
          </View>
        ) : transaction.payment_status ? (
          <TouchableOpacity
            activeOpacity={onPaymentStatusPress ? 0.8 : 1}
            onPress={() => {
              if (transaction.payment_status && onPaymentStatusPress) {
                onPaymentStatusPress(
                  transaction.payment_status as "paid" | "due",
                );
              }
            }}
            style={{
              backgroundColor:
                transaction.payment_status === "due" || paymentShowsParentDue
                  ? "#d97706" + "20"
                  : "#16a34a" + "20",
              borderColor:
                transaction.payment_status === "due" || paymentShowsParentDue
                  ? "#d97706" + "40"
                  : "#16a34a" + "40",
            }}
            className="px-3 py-1 rounded-full border"
          >
            <Text
              style={{
                color:
                  transaction.payment_status === "due" || paymentShowsParentDue
                    ? "#d97706"
                    : "#16a34a",
              }}
              className="text-xs font-semibold"
            >
              {paymentShowsParentDue
                ? `Due · ${formatAmount(parentRemaining)} left`
                : transaction.payment_status === "due"
                  ? t("due")
                  : t("paid")}
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
          {(isDue && !isSettled && onPayDue) ||
          (isPayment && !parentIsSettled && parentAsDueTxn && onPayDue) ||
          (hasChain && onViewChain) ? (
            <View className="flex-row gap-2 mb-2">
              {/* Pay — on root due card */}
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
                    {t("pay")}
                  </Text>
                </TouchableOpacity>
              )}
              {/* Pay — on payment card when parent due still has balance */}
              {isPayment && !parentIsSettled && parentAsDueTxn && onPayDue && (
                <TouchableOpacity
                  onPress={() => onPayDue(parentAsDueTxn)}
                  style={{ backgroundColor: "#d97706" + "20" }}
                  className="flex-1 flex-row justify-center items-center gap-1.5 px-3 py-2 rounded-lg"
                >
                  <Ionicons name="cash-outline" size={16} color="#d97706" />
                  <Text
                    style={{ color: "#d97706" }}
                    className="text-xs font-semibold"
                  >
                    Pay ({formatAmount(parentRemaining)} left)
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
                    : t("attach")}
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
                  {t("edit")}
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
                  {t("delete")}
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
    prevProps.transaction.loan_summary?.outstanding ===
      nextProps.transaction.loan_summary?.outstanding &&
    prevProps.transaction.loan_summary?.is_settled ===
      nextProps.transaction.loan_summary?.is_settled &&
    prevProps.transaction.loan_summary?.owed_by_me ===
      nextProps.transaction.loan_summary?.owed_by_me &&
    prevProps.transaction.loan_summary?.owed_by_them ===
      nextProps.transaction.loan_summary?.owed_by_them &&
    prevProps.transaction.account?.name ===
      nextProps.transaction.account?.name &&
    prevProps.transaction.category?.name ===
      nextProps.transaction.category?.name &&
    prevProps.transaction.counterparty === nextProps.transaction.counterparty &&
    prevProps.transaction.vendor === nextProps.transaction.vendor &&
    prevProps.transaction.payment_status ===
      nextProps.transaction.payment_status &&
    (prevProps.transaction.attachments?.length ?? 0) ===
      (nextProps.transaction.attachments?.length ?? 0) &&
    prevProps.onCategoryPress === nextProps.onCategoryPress &&
    prevProps.onCounterpartyPress === nextProps.onCounterpartyPress &&
    prevProps.onVendorPress === nextProps.onVendorPress &&
    prevProps.onPaymentStatusPress === nextProps.onPaymentStatusPress &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onPayDue === nextProps.onPayDue &&
    prevProps.onViewChain === nextProps.onViewChain &&
    prevProps.onAttachmentsPress === nextProps.onAttachmentsPress,
);
