/**
 * DueChainSheet
 *
 * Shows the full payment timeline for a due transaction:
 *  - Original due amount
 *  - Each partial/full payment with date, amount, remaining after
 *  - Summary: paid / remaining / settled date
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
import { fetchDueChain, type Transaction } from "@/services/transactions";

type Props = {
  visible: boolean;
  onClose: () => void;
  transaction: Transaction; // any transaction in the chain
};

export const DueChainSheet = ({ visible, onClose, transaction }: Props) => {
  const { colors } = useTheme();
  const { formatAmount } = usePreferences();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["due-chain", transaction._id],
    queryFn: () => fetchDueChain(transaction._id),
    enabled: visible,
  });

  const progressPct = data
    ? Math.min(
        100,
        (data.summary.total_paid / data.summary.original_amount) * 100,
      )
    : 0;

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
          style={{ backgroundColor: colors.bg.primary, maxHeight: 600 }}
        >
          {/* Header */}
          <View
            className="flex-row justify-between items-center px-6 pt-6 pb-4 border-b"
            style={{ borderColor: colors.border }}
          >
            <View>
              <Text
                className="text-lg font-bold"
                style={{ color: colors.text.primary }}
              >
                Payment History
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: colors.text.tertiary }}
              >
                {transaction.vendor
                  ? `Vendor: ${transaction.vendor}`
                  : transaction.counterparty
                    ? `For: ${transaction.counterparty}`
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
                Loading chain…
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
                Could not load payment history
              </Text>
            </View>
          )}

          {data && (
            <ScrollView
              className="px-6 py-4"
              contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            >
              {/* Progress bar */}
              <View
                className="rounded-xl p-4"
                style={{
                  backgroundColor: data.summary.is_settled
                    ? "#16a34a" + "15"
                    : "#d97706" + "15",
                  borderWidth: 1,
                  borderColor: data.summary.is_settled
                    ? "#16a34a" + "40"
                    : "#d97706" + "40",
                }}
              >
                <View className="flex-row justify-between mb-2">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {data.summary.is_settled
                      ? "✅ Fully Settled"
                      : "⏳ Partially Paid"}
                  </Text>
                  <Text
                    className="text-sm font-bold"
                    style={{
                      color: data.summary.is_settled ? "#16a34a" : "#d97706",
                    }}
                  >
                    {Math.round(progressPct)}%
                  </Text>
                </View>
                {/* Bar */}
                <View
                  className="rounded-full overflow-hidden"
                  style={{
                    height: 8,
                    backgroundColor: colors.bg.tertiary,
                  }}
                >
                  <View
                    className="rounded-full h-full"
                    style={{
                      width: `${progressPct}%`,
                      backgroundColor: data.summary.is_settled
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
                    Paid: {formatAmount(data.summary.total_paid)}
                  </Text>
                  <Text
                    className="text-xs"
                    style={{ color: colors.text.secondary }}
                  >
                    Remaining: {formatAmount(data.summary.remaining)}
                  </Text>
                </View>
                {data.summary.settled_at && (
                  <Text className="text-xs mt-1" style={{ color: "#16a34a" }}>
                    Settled on{" "}
                    {dayjs(data.summary.settled_at).format("MMM DD, YYYY")}
                  </Text>
                )}
              </View>

              {/* Timeline */}
              <Text
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: colors.text.tertiary }}
              >
                Transaction Timeline
              </Text>

              {/* Root due */}
              <TimelineRow
                icon="time-outline"
                iconBg="#d97706"
                label="Original Due"
                date={data.root.date}
                amount={data.root.amount}
                note={data.root.description}
                sub={`Remaining: ${formatAmount(data.root.amount)}`}
                isFirst
                formatAmount={formatAmount}
                colors={colors}
              />

              {/* Payments */}
              {data.payments.map((p, i) => (
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
                  isLast={i === data.payments.length - 1}
                  formatAmount={formatAmount}
                  colors={colors}
                />
              ))}

              {data.payments.length === 0 && (
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
    {/* Vertical line + icon */}
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

    {/* Content */}
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
