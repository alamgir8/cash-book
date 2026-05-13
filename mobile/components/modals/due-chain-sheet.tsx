/**
 * DueChainSheet
 *
 * Two modes:
 *  1. COUNTERPARTY LEDGER — when the transaction has a `counterparty` field.
 *     Shows ALL borrows + repayments with that party as a single running ledger.
 *  2. SINGLE DUE CHAIN — classic per-loan view (for vendor dues, invoices, etc.)
 */
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { usePreferences } from "@/hooks/usePreferences";
import {
  fetchDueChain,
  fetchCounterpartyLedger,
  type Transaction,
} from "@/services/transactions";

type Props = {
  visible: boolean;
  onClose: () => void;
  transaction: Transaction; // any transaction in the chain
};

export const DueChainSheet = ({ visible, onClose, transaction }: Props) => {
  const { colors } = useTheme();
  const { formatAmount } = usePreferences();
  const insets = useSafeAreaInsets();

  // Use counterparty ledger when the transaction has a counterparty
  const useCounterpartyMode = !!transaction.counterparty;
  const counterparty = transaction.counterparty ?? "";

  const ledgerQuery = useQuery({
    queryKey: ["counterparty-ledger", counterparty],
    queryFn: () => fetchCounterpartyLedger(counterparty),
    enabled: visible && useCounterpartyMode,
  });

  const chainQuery = useQuery({
    queryKey: ["due-chain", transaction._id],
    queryFn: () => fetchDueChain(transaction._id),
    enabled: visible && !useCounterpartyMode,
  });

  const isLoading = useCounterpartyMode
    ? ledgerQuery.isLoading
    : chainQuery.isLoading;
  const isError = useCounterpartyMode
    ? ledgerQuery.isError
    : chainQuery.isError;
  const ledger = ledgerQuery.data;
  const chain = chainQuery.data;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        }}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          className="rounded-t-3xl"
          style={{ backgroundColor: colors.bg.primary, maxHeight: "88%" }}
        >
          {/* Header */}
          <View
            className="flex-row justify-between items-center px-6 pt-6 pb-4 border-b"
            style={{ borderColor: colors.border }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text
                className="text-lg font-bold"
                style={{ color: colors.text.primary }}
              >
                {useCounterpartyMode
                  ? `${counterparty} — Full Ledger`
                  : "Payment History"}
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: colors.text.tertiary }}
              >
                {useCounterpartyMode
                  ? `All transactions with ${counterparty}`
                  : transaction.vendor
                    ? `Vendor: ${transaction.vendor}`
                    : "Due transaction chain"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.bg.tertiary }}
            >
              <Ionicons name="close" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {isLoading && (
            <View className="py-12 items-center">
              <ActivityIndicator color={colors.info} />
              <Text
                className="text-sm mt-3"
                style={{ color: colors.text.tertiary }}
              >
                Loading…
              </Text>
            </View>
          )}

          {isError && (
            <View className="py-12 items-center px-6">
              <Ionicons name="warning-outline" size={32} color={colors.error} />
              <Text
                className="text-sm mt-2 text-center"
                style={{ color: colors.text.secondary }}
              >
                Could not load history
              </Text>
            </View>
          )}

          {/* ─── COUNTERPARTY LEDGER MODE ────────────────────────────── */}
          {ledger && useCounterpartyMode && (
            <ScrollView
              className="px-6 py-4"
              contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            >
              {/* Summary cards */}
              <View className="flex-row gap-3">
                <SummaryCard
                  label="Total Borrowed"
                  value={formatAmount(ledger.summary.total_borrowed)}
                  color="#3b82f6"
                  colors={colors}
                />
                <SummaryCard
                  label="Total Repaid"
                  value={formatAmount(ledger.summary.total_repaid)}
                  color="#16a34a"
                  colors={colors}
                />
              </View>

              {/* Outstanding / Settled */}
              <View
                className="rounded-xl p-4"
                style={{
                  backgroundColor: ledger.summary.is_settled
                    ? "#16a34a15"
                    : "#ef444415",
                  borderWidth: 1,
                  borderColor: ledger.summary.is_settled
                    ? "#16a34a40"
                    : "#ef444440",
                }}
              >
                <View className="flex-row justify-between items-center">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {ledger.summary.is_settled
                      ? "✅ Fully Settled"
                      : "⏳ Outstanding Balance"}
                  </Text>
                  <Text
                    className="text-base font-bold"
                    style={{
                      color: ledger.summary.is_settled ? "#16a34a" : "#ef4444",
                    }}
                  >
                    {formatAmount(ledger.summary.outstanding)}
                  </Text>
                </View>
                <Text
                  className="text-xs mt-1"
                  style={{ color: colors.text.tertiary }}
                >
                  {ledger.summary.transaction_count} transactions total
                </Text>
              </View>

              {/* Timeline */}
              <Text
                className="text-xs font-semibold uppercase tracking-wide mt-2"
                style={{ color: colors.text.tertiary }}
              >
                Full Transaction History
              </Text>

              {ledger.timeline.map((entry, i) => (
                <LedgerRow
                  key={entry._id}
                  isBorrow={entry.entry_type === "borrow"}
                  date={entry.date}
                  description={entry.description}
                  amount={entry.amount}
                  runningBalance={entry.running_balance}
                  isLast={i === ledger.timeline.length - 1}
                  formatAmount={formatAmount}
                  colors={colors}
                />
              ))}
            </ScrollView>
          )}

          {/* ─── SINGLE CHAIN MODE ───────────────────────────────────── */}
          {chain && !useCounterpartyMode && (
            <ScrollView
              className="px-6 py-4"
              contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            >
              {/* Progress bar */}
              <View
                className="rounded-xl p-4"
                style={{
                  backgroundColor: chain.summary.is_settled
                    ? "#16a34a15"
                    : "#d9770615",
                  borderWidth: 1,
                  borderColor: chain.summary.is_settled
                    ? "#16a34a40"
                    : "#d9770640",
                }}
              >
                <View className="flex-row justify-between mb-2">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {chain.summary.is_settled
                      ? "✅ Fully Settled"
                      : "⏳ Partially Paid"}
                  </Text>
                  <Text
                    className="text-sm font-bold"
                    style={{
                      color: chain.summary.is_settled ? "#16a34a" : "#d97706",
                    }}
                  >
                    {Math.round(
                      Math.min(
                        100,
                        (chain.summary.total_paid /
                          chain.summary.original_amount) *
                          100,
                      ),
                    )}
                    %
                  </Text>
                </View>
                <View
                  className="rounded-full overflow-hidden"
                  style={{ height: 8, backgroundColor: colors.bg.tertiary }}
                >
                  <View
                    className="rounded-full h-full"
                    style={{
                      width: `${Math.min(100, (chain.summary.total_paid / chain.summary.original_amount) * 100)}%`,
                      backgroundColor: chain.summary.is_settled
                        ? "#16a34a"
                        : "#d97706",
                    }}
                  />
                </View>
                <View className="flex-row justify-between mt-2">
                  <Text
                    className="text-xs"
                    style={{ color: colors.text.secondary }}
                  >
                    Paid: {formatAmount(chain.summary.total_paid)}
                  </Text>
                  <Text
                    className="text-xs"
                    style={{ color: colors.text.secondary }}
                  >
                    Remaining: {formatAmount(chain.summary.remaining)}
                  </Text>
                </View>
                {chain.summary.settled_at && (
                  <Text className="text-xs mt-1" style={{ color: "#16a34a" }}>
                    Settled on{" "}
                    {dayjs(chain.summary.settled_at).format("MMM DD, YYYY")}
                  </Text>
                )}
              </View>

              <Text
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: colors.text.tertiary }}
              >
                Transaction Timeline
              </Text>

              <TimelineRow
                icon="time-outline"
                iconBg="#d97706"
                label="Original Due"
                date={chain.root.date}
                amount={chain.root.amount}
                note={chain.root.description}
                sub={`Remaining: ${formatAmount(chain.root.amount)}`}
                isFirst
                formatAmount={formatAmount}
                colors={colors}
              />

              {chain.payments.map((p, i) => (
                <TimelineRow
                  key={p._id}
                  icon={
                    p.remaining_after === 0
                      ? "checkmark-circle"
                      : "cash-outline"
                  }
                  iconBg={p.remaining_after === 0 ? "#16a34a" : colors.info}
                  label={
                    p.remaining_after === 0
                      ? `Final Payment (#${i + 1})`
                      : `Partial Payment (#${i + 1})`
                  }
                  date={p.date}
                  amount={p.amount}
                  note={p.description}
                  sub={`After this: ${formatAmount(p.remaining_after)} left`}
                  isLast={i === chain.payments.length - 1}
                  formatAmount={formatAmount}
                  colors={colors}
                />
              ))}

              {chain.payments.length === 0 && (
                <View
                  className="rounded-xl p-4 items-center"
                  style={{
                    backgroundColor: colors.bg.secondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    className="text-sm"
                    style={{ color: colors.text.tertiary }}
                  >
                    No payments recorded yet
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          <View style={{ paddingBottom: Math.max(insets.bottom, 12) }} />
        </View>
      </View>
    </Modal>
  );
};

// ─── Ledger row (counterparty mode) ────────────────────────────────────────

type LedgerRowProps = {
  isBorrow: boolean;
  date: string;
  description?: string;
  amount: number;
  runningBalance: number;
  isLast: boolean;
  formatAmount: (n: number) => string;
  colors: any;
};

const LedgerRow = ({
  isBorrow,
  date,
  description,
  amount,
  runningBalance,
  isLast,
  formatAmount,
  colors,
}: LedgerRowProps) => (
  <View className="flex-row gap-3">
    <View className="items-center" style={{ width: 32 }}>
      <View
        className="w-8 h-8 rounded-full items-center justify-center"
        style={{ backgroundColor: isBorrow ? "#3b82f6" : "#16a34a" }}
      >
        <Ionicons
          name={isBorrow ? "arrow-down-outline" : "arrow-up-outline"}
          size={15}
          color="white"
        />
      </View>
      {!isLast && (
        <View
          style={{
            flex: 1,
            width: 2,
            backgroundColor: colors.border,
            marginTop: 2,
            minHeight: 20,
          }}
        />
      )}
    </View>

    <View
      className="flex-1 rounded-xl p-3 mb-2"
      style={{
        backgroundColor: colors.bg.secondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row justify-between items-start">
        <Text
          className="text-xs font-semibold"
          style={{ color: isBorrow ? "#3b82f6" : "#16a34a" }}
        >
          {isBorrow ? "Borrowed" : "Repaid"}
        </Text>
        <Text
          className="text-sm font-bold"
          style={{ color: isBorrow ? "#3b82f6" : "#16a34a" }}
        >
          {isBorrow ? "+" : "-"}
          {formatAmount(amount)}
        </Text>
      </View>
      {!!description && (
        <Text
          className="text-xs mt-0.5"
          style={{ color: colors.text.primary }}
          numberOfLines={2}
        >
          {description}
        </Text>
      )}
      <View className="flex-row justify-between mt-1">
        <Text className="text-xs" style={{ color: colors.text.tertiary }}>
          {dayjs(date).format("MMM DD, YYYY")}
        </Text>
        <Text
          className="text-xs font-medium"
          style={{ color: runningBalance > 0 ? "#ef4444" : "#16a34a" }}
        >
          Balance: {formatAmount(Math.abs(runningBalance))}
          {runningBalance > 0 ? " owed" : " clear"}
        </Text>
      </View>
    </View>
  </View>
);

// ─── Timeline row (single chain mode) ──────────────────────────────────────

type RowProps = {
  icon: any;
  iconBg: string;
  label: string;
  date: string;
  amount: number;
  note?: string;
  sub?: string;
  isFirst?: boolean;
  isLast?: boolean;
  formatAmount: (n: number) => string;
  colors: any;
};

const TimelineRow = ({
  icon,
  iconBg,
  label,
  date,
  amount,
  note,
  sub,
  isFirst,
  isLast,
  formatAmount,
  colors,
}: RowProps) => (
  <View className="flex-row gap-3">
    <View className="items-center" style={{ width: 32 }}>
      <View
        className="w-8 h-8 rounded-full items-center justify-center"
        style={{ backgroundColor: iconBg }}
      >
        <Ionicons name={icon} size={16} color="white" />
      </View>
      {!isLast && (
        <View
          style={{
            flex: 1,
            width: 2,
            backgroundColor: colors.border,
            marginTop: 2,
            minHeight: 20,
          }}
        />
      )}
    </View>

    <View
      className="flex-1 rounded-xl p-3 mb-2"
      style={{
        backgroundColor: colors.bg.secondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row justify-between items-start">
        <Text
          className="text-sm font-semibold"
          style={{ color: colors.text.primary }}
        >
          {label}
        </Text>
        <Text
          className="text-sm font-bold"
          style={{ color: isFirst ? "#d97706" : "#16a34a" }}
        >
          {formatAmount(amount)}
        </Text>
      </View>
      <Text className="text-xs mt-0.5" style={{ color: colors.text.tertiary }}>
        {dayjs(date).format("MMM DD, YYYY")}
        {note ? ` · ${note}` : ""}
      </Text>
      {sub && (
        <Text className="text-xs mt-1" style={{ color: colors.text.secondary }}>
          {sub}
        </Text>
      )}
    </View>
  </View>
);

// ─── Summary card ────────────────────────────────────────────────────────────

const SummaryCard = ({
  label,
  value,
  color,
  colors,
}: {
  label: string;
  value: string;
  color: string;
  colors: any;
}) => (
  <View
    className="flex-1 rounded-xl p-3"
    style={{
      backgroundColor: color + "15",
      borderWidth: 1,
      borderColor: color + "40",
    }}
  >
    <Text className="text-xs" style={{ color: colors.text.tertiary }}>
      {label}
    </Text>
    <Text className="text-sm font-bold mt-0.5" style={{ color }}>
      {value}
    </Text>
  </View>
);
