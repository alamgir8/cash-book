import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import type { Transaction } from "../services/transactions";
import { usePreferences } from "../hooks/use-preferences";
import { useTheme } from "../hooks/use-theme";
import { useTranslation } from "../hooks/use-translation";
import { translateCategoryName } from "../lib/i18n/category-translations";
import {
  getPartyRefName,
  getCategoryRefName,
} from "../lib/transaction-filters";
import { getLoanReturnRemaining } from "../lib/loan-utils";

type Props = {
  transaction: Transaction;
  onCategoryPress?: (categoryName: string) => void;
  onCounterpartyPress?: (counterparty: string) => void;
  onPartyPress?: (partyName: string) => void;
  onForPartyPress?: (forPartyName: string) => void;
  onVendorPress?: (vendorName: string) => void;
  onPaymentStatusPress?: (status: "paid" | "due") => void;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  onAttachmentsPress?: (transaction: Transaction) => void;
  onPayDue?: (transaction: Transaction) => void;
  onReturnLoan?: (transaction: Transaction) => void;
  onViewChain?: (transaction: Transaction) => void;
  onViewHistory?: (transaction: Transaction) => void;
};

/** Chips repeat a lot on this card; keep their shape defined in one place. */
const Chip = ({
  label,
  value,
  color,
  onPress,
}: {
  label?: string;
  value: string;
  color: string;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    activeOpacity={onPress ? 0.8 : 1}
    onPress={onPress}
    disabled={!onPress}
    style={{ backgroundColor: color + "25", borderColor: color + "40" }}
    className="px-3 py-1 rounded-full border"
  >
    <Text style={{ color }} className="text-xs font-semibold">
      {/* Some label strings already end in ':' — don't double it up. */}
      {label ? `${label.replace(/:\s*$/, "")}: ` : ""}
      {value}
    </Text>
  </TouchableOpacity>
);

/** Label + value kept on one horizontal line (Balance after, due date). */
const DetailRow = ({
  label,
  value,
  labelColor,
  valueColor,
}: {
  label: string;
  value: string;
  labelColor: string;
  valueColor: string;
}) => (
  <View
    className="flex-row items-center gap-1.5"
    style={{ flexWrap: "nowrap" }}
  >
    <Text
      style={{ color: labelColor }}
      className="text-xs font-semibold"
      numberOfLines={1}
    >
      {label}
    </Text>
    <Text
      style={{ color: valueColor, flexShrink: 1 }}
      className="text-xs font-medium mt-1"
      numberOfLines={1}
    >
      {value}
    </Text>
  </View>
);

/** Same text under two different fields shouldn't render as two chips. */
const sameText = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

const TransactionCardComponent = ({
  transaction,
  onCategoryPress,
  onCounterpartyPress,
  onPartyPress,
  onForPartyPress,
  onVendorPress,
  onPaymentStatusPress,
  onEdit,
  onDelete,
  onAttachmentsPress,
  onPayDue,
  onReturnLoan,
  onViewChain,
  onViewHistory,
}: Props) => {
  const attachmentCount = transaction.attachments?.length ?? 0;
  const { formatAmount, preferences } = usePreferences();
  const language = preferences.language ?? "en";
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
  const isLoanLedger =
    isLoanCategory &&
    !!(transaction.counterparty || transaction.party || transaction.for_party);

  const isDue = !isLoanLedger && transaction.payment_status === "due";
  const loanReturnRemaining = getLoanReturnRemaining(transaction);
  const canReturnLoan =
    isLoanLedger &&
    !loanIsSettled &&
    loanReturnRemaining > 0 &&
    Boolean(onReturnLoan);
  const isPayment = !isLoanLedger && !!transaction.parent_due_id; // payment linked to a due
  // Separate history modes: due/payment → Payment History; loan → Loan Ledger
  const showDueHistory = (isDue || isPayment) && !!onViewChain;
  const showLoanHistory = isLoanLedger && !!onViewChain;
  const hasChain = showDueHistory || showLoanHistory;
  const remaining = transaction.due_remaining ?? transaction.amount;
  const isSettled = isDue && remaining === 0;

  const categoryName = getCategoryRefName(transaction.category);
  const partyName = getPartyRefName(transaction.party);
  const forPartyName = getPartyRefName(transaction.for_party);
  const schemeName = transaction.scheme?.name?.trim() || undefined;

  const isTransfer = Boolean(
    transaction.transfer_id || transaction.transfer_direction,
  );
  const transferLabel = isTransfer
    ? transaction.transfer_direction === "incoming"
      ? t("transferIn")
      : transaction.transfer_direction === "outgoing"
        ? t("transferOut")
        : t("transfer")
    : undefined;

  // Legacy free-text vendor duplicates the linked party once a party is set.
  const rawVendor = transaction.vendor?.trim() || undefined;
  const vendorText = sameText(rawVendor, partyName) ? undefined : rawVendor;

  // Transfers often store the literal "Transfer" as counterparty — hide that
  // duplicate, but keep a real counterparty / other-account name when present.
  const rawCounterparty = transaction.counterparty?.trim() || undefined;
  const counterpartyText =
    !rawCounterparty ||
    rawCounterparty.toLowerCase() === "transfer" ||
    sameText(rawCounterparty, partyName) ||
    sameText(rawCounterparty, vendorText)
      ? undefined
      : rawCounterparty;

  // Vendor History only when a real vendor/party is linked — never for
  // transfers or the literal "Transfer" counterparty (that dumped every transfer).
  const hasRealVendor = !!(partyName || vendorText);
  const showVendorHistory =
    !!onViewHistory && hasRealVendor && !hasChain && !isTransfer;

  // Flatten comment/keyword into unique note lines (multiline notes → list items).
  const noteLines = [transaction.comment, transaction.keyword]
    .flatMap((raw) =>
      (raw ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((line, index, all) => all.indexOf(line) === index)
    .filter((line) => !sameText(line, transaction.description));

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
          party: parentDue.party ?? transaction.party,
          for_party: (parentDue as any).for_party ?? transaction.for_party,
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

      {(transaction.description || noteLines.length > 0) && (
        <View className="mt-3 gap-1">
          {/* Description: flat body text, no label, full content */}
          {transaction.description ? (
            <Text
              style={{ color: colors.text.secondary }}
              className="text-sm font-medium"
            >
              {transaction.description}
            </Text>
          ) : null}
          {/* Notes: list view of every unique line, no "Note" label */}
          {noteLines.length > 0 ? (
            <View className="gap-0.5">
              {noteLines.map((line) => (
                <View key={line} className="flex-row items-start gap-1.5">
                  <Text
                    style={{ color: colors.text.tertiary, lineHeight: 18 }}
                    className="text-xs"
                  >
                    •
                  </Text>
                  <Text
                    style={{ color: colors.text.tertiary, flex: 1 }}
                    className="text-xs font-medium"
                  >
                    {line}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}

      <View className="flex-row flex-wrap mt-2 gap-x-2 gap-y-2">
        {categoryName ? (
          <Chip
            value={translateCategoryName(categoryName, language)}
            color={colors.info}
            onPress={
              onCategoryPress ? () => onCategoryPress(categoryName) : undefined
            }
          />
        ) : null}
        {partyName ? (
          <Chip
            label={t("vendorLabel")}
            value={partyName}
            color={colors.info}
            onPress={onPartyPress ? () => onPartyPress(partyName) : undefined}
          />
        ) : null}
        {vendorText ? (
          <Chip
            label={t("vendorLabel")}
            value={vendorText}
            color={colors.info}
            onPress={onPartyPress ? () => onPartyPress(vendorText) : undefined}
          />
        ) : null}
        {counterpartyText ? (
          <Chip
            label={t("counterpartyLabel")}
            value={counterpartyText}
            color={colors.info}
            onPress={
              onCounterpartyPress
                ? () => onCounterpartyPress(counterpartyText)
                : undefined
            }
          />
        ) : null}
        {forPartyName ? (
          <Chip
            label={t("forLabel")}
            value={forPartyName}
            color="#7c3aed"
            onPress={
              onForPartyPress ? () => onForPartyPress(forPartyName) : undefined
            }
          />
        ) : null}
        {schemeName ? (
          <Chip label={t("schemeLabel")} value={schemeName} color="#0891b2" />
        ) : null}
        {transferLabel ? (
          <Chip value={transferLabel} color={colors.text.tertiary} />
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

      {(transaction.due_date ||
        transaction.balance_after_transaction != null) && (
        <View className="mt-2 gap-0.5">
          {transaction.due_date ? (
            <DetailRow
              label={t("dueDateLabel")}
              value={dayjs(transaction.due_date).format("MMM D, YYYY")}
              labelColor={colors.text.tertiary}
              valueColor={colors.text.secondary}
            />
          ) : null}
          {transaction.balance_after_transaction != null ? (
            <DetailRow
              label={t("balanceAfterLabel")}
              value={formatAmount(transaction.balance_after_transaction)}
              labelColor={colors.text.tertiary}
              valueColor={colors.text.secondary}
            />
          ) : null}
        </View>
      )}

      {/* Action row */}
      {!transaction.is_deleted ? (
        <View
          style={{ borderColor: colors.border }}
          className="pt-2 mt-2 border-t"
        >
          {/* Due / Loan chain actions (Pay or Return + History) */}
          {(isDue && !isSettled && onPayDue) ||
          (isPayment && !parentIsSettled && parentAsDueTxn && onPayDue) ||
          canReturnLoan ||
          (hasChain && onViewChain) ? (
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
                    {t("pay")}
                  </Text>
                </TouchableOpacity>
              )}
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
              {canReturnLoan && onReturnLoan && (
                <TouchableOpacity
                  onPress={() => onReturnLoan(transaction)}
                  style={{ backgroundColor: "#2563eb" + "20" }}
                  className="flex-1 flex-row justify-center items-center gap-1.5 px-3 py-2 rounded-lg"
                >
                  <Ionicons
                    name="return-down-back-outline"
                    size={16}
                    color="#2563eb"
                  />
                  <Text
                    style={{ color: "#2563eb" }}
                    className="text-xs font-semibold"
                  >
                    {t("returnLoan")}
                  </Text>
                </TouchableOpacity>
              )}
              {showDueHistory && (
                <TouchableOpacity
                  onPress={() => onViewChain!(transaction)}
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
              {showLoanHistory && (
                <TouchableOpacity
                  onPress={() => onViewChain!(transaction)}
                  style={{ backgroundColor: colors.bg.tertiary }}
                  className="flex-1 flex-row justify-center items-center gap-1.5 px-3 py-2 rounded-lg"
                >
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={colors.text.secondary}
                  />
                  <Text
                    style={{ color: colors.text.secondary }}
                    className="text-xs font-semibold"
                  >
                    Loan History
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* Vendor History — only when a real vendor/party is linked */}
          {showVendorHistory ? (
            <View className="flex-row gap-2 mb-2">
              <TouchableOpacity
                onPress={() => onViewHistory!(transaction)}
                style={{ backgroundColor: colors.bg.tertiary }}
                className="flex-1 flex-row justify-center items-center gap-1.5 px-3 py-2 rounded-lg"
              >
                <Ionicons
                  name="time-outline"
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
    prevProps.transaction.comment === nextProps.transaction.comment &&
    prevProps.transaction.keyword === nextProps.transaction.keyword &&
    prevProps.transaction.vendor === nextProps.transaction.vendor &&
    prevProps.transaction.date === nextProps.transaction.date &&
    prevProps.transaction.due_date === nextProps.transaction.due_date &&
    prevProps.transaction.scheme?.name === nextProps.transaction.scheme?.name &&
    prevProps.transaction.transfer_id === nextProps.transaction.transfer_id &&
    prevProps.transaction.transfer_direction ===
      nextProps.transaction.transfer_direction &&
    prevProps.transaction.balance_after_transaction ===
      nextProps.transaction.balance_after_transaction &&
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
    (typeof prevProps.transaction.party === "object"
      ? `${prevProps.transaction.party?._id}:${prevProps.transaction.party?.name ?? ""}`
      : prevProps.transaction.party) ===
      (typeof nextProps.transaction.party === "object"
        ? `${nextProps.transaction.party?._id}:${nextProps.transaction.party?.name ?? ""}`
        : nextProps.transaction.party) &&
    (typeof prevProps.transaction.for_party === "object"
      ? `${prevProps.transaction.for_party?._id}:${prevProps.transaction.for_party?.name ?? ""}`
      : prevProps.transaction.for_party) ===
      (typeof nextProps.transaction.for_party === "object"
        ? `${nextProps.transaction.for_party?._id}:${nextProps.transaction.for_party?.name ?? ""}`
        : nextProps.transaction.for_party) &&
    (prevProps.transaction.attachments?.length ?? 0) ===
      (nextProps.transaction.attachments?.length ?? 0) &&
    prevProps.onCategoryPress === nextProps.onCategoryPress &&
    prevProps.onCounterpartyPress === nextProps.onCounterpartyPress &&
    prevProps.onPartyPress === nextProps.onPartyPress &&
    prevProps.onForPartyPress === nextProps.onForPartyPress &&
    prevProps.onVendorPress === nextProps.onVendorPress &&
    prevProps.onPaymentStatusPress === nextProps.onPaymentStatusPress &&
    prevProps.onEdit === nextProps.onEdit &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onPayDue === nextProps.onPayDue &&
    prevProps.onReturnLoan === nextProps.onReturnLoan &&
    prevProps.onViewChain === nextProps.onViewChain &&
    prevProps.onViewHistory === nextProps.onViewHistory &&
    prevProps.onAttachmentsPress === nextProps.onAttachmentsPress,
);
