import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import type { LedgerEntry } from "@/services/parties";
import {
  formatLedgerDate,
  formatLedgerAmount,
  formatLedgerBalance,
} from "../../lib/party-utils";

type Props = {
  entry: LedgerEntry;
  onPress?: () => void;
};

function LedgerEntryCardComponent({ entry, onPress }: Props) {
  const { colors } = useTheme();
  const isDebit = entry.type === "debit";
  // Party ledger: debit = money toward party (green/+), credit = from party (red/-)
  const accent = isDebit ? colors.success : colors.error;
  const amount = isDebit ? entry.debit : entry.credit;
  const balance = entry.running_balance ?? 0;
  const balanceColor =
    balance > 0
      ? colors.success
      : balance < 0
        ? colors.error
        : colors.text.secondary;
  const isDue = entry.payment_status === "due";
  const interactive = Boolean(onPress);

  return (
    <TouchableOpacity
      activeOpacity={interactive ? 0.75 : 1}
      disabled={!interactive}
      onPress={onPress}
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: isDue ? "#d97706" + "60" : colors.border,
        borderWidth: isDue ? 1.5 : 1,
      }}
      className="rounded-2xl p-3 shadow-sm mb-2.5"
    >
      {isDue ? (
        <View className="flex-row gap-2 mb-2">
          <View
            className="flex-row items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "#d97706" + "20" }}
          >
            <Ionicons name="time-outline" size={12} color="#d97706" />
            <Text className="text-xs font-bold" style={{ color: "#d97706" }}>
              DUE
            </Text>
          </View>
        </View>
      ) : null}

      {/* Header — same pattern as TransactionCard */}
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-4">
          <View className="flex-row items-center gap-2">
            <View
              style={{ backgroundColor: accent }}
              className="w-3 h-3 rounded-full"
            />
            <Text
              numberOfLines={1}
              style={{ color: colors.text.primary }}
              className="font-bold text-lg flex-1"
            >
              {entry.account_name || "Account"}
            </Text>
          </View>
          <Text
            style={{ color: colors.text.tertiary }}
            className="text-sm mt-1"
          >
            {formatLedgerDate(entry.date)}
          </Text>
        </View>
        <View className="items-end">
          <Text style={{ color: accent }} className="text-xl font-bold">
            {isDebit ? "+" : "-"}
            {formatLedgerAmount(amount)}
          </Text>
          <View
            style={{ backgroundColor: accent + "20" }}
            className="px-2 py-1 rounded-full"
          >
            <Text style={{ color: accent }} className="text-xs font-medium">
              {entry.type.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {entry.description ? (
        <Text
          numberOfLines={2}
          style={{ color: colors.text.secondary }}
          className="mt-3 text-sm leading-5"
        >
          {entry.description}
        </Text>
      ) : null}

      {entry.comment ? (
        <Text
          numberOfLines={2}
          className="text-xs mt-1 italic"
          style={{ color: colors.text.tertiary }}
        >
          {entry.comment}
        </Text>
      ) : null}

      {(entry.category_name ||
        entry.reference ||
        entry.payment_status === "paid") && (
        <View className="flex-row flex-wrap mt-2 gap-x-2 gap-y-2">
          {entry.category_name ? (
            <View
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
                {entry.category_name}
              </Text>
            </View>
          ) : null}
          {entry.reference ? (
            <View
              style={{
                backgroundColor: colors.bg.tertiary,
                borderColor: colors.border,
              }}
              className="px-3 py-1 rounded-full border"
            >
              <Text
                style={{ color: colors.text.secondary }}
                className="text-xs font-semibold"
              >
                {entry.reference}
              </Text>
            </View>
          ) : null}
          {entry.payment_status === "paid" ? (
            <View
              style={{
                backgroundColor: colors.success + "20",
                borderColor: colors.success + "40",
              }}
              className="px-3 py-1 rounded-full border"
            >
              <Text
                style={{ color: colors.success }}
                className="text-xs font-semibold"
              >
                Paid
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Balance after — ledger-specific, text sizes match card chips/body */}
      <View
        className="flex-row mt-3 py-2.5 px-3 rounded-xl border"
        style={{
          backgroundColor: colors.bg.tertiary,
          borderColor: colors.border,
        }}
      >
        <View className="flex-1">
          <Text
            className="text-xs font-semibold uppercase mb-0.5"
            style={{ color: colors.text.tertiary }}
          >
            Debit
          </Text>
          <Text
            className="text-sm font-bold"
            style={{
              color: entry.debit > 0 ? colors.success : colors.text.tertiary,
            }}
          >
            {entry.debit > 0 ? formatLedgerAmount(entry.debit) : "—"}
          </Text>
        </View>
        <View className="flex-1">
          <Text
            className="text-xs font-semibold uppercase mb-0.5"
            style={{ color: colors.text.tertiary }}
          >
            Credit
          </Text>
          <Text
            className="text-sm font-bold"
            style={{
              color: entry.credit > 0 ? colors.error : colors.text.tertiary,
            }}
          >
            {entry.credit > 0 ? formatLedgerAmount(entry.credit) : "—"}
          </Text>
        </View>
        <View className="flex-1 items-end">
          <Text
            className="text-xs font-semibold uppercase mb-0.5"
            style={{ color: colors.text.tertiary }}
          >
            Balance after
          </Text>
          <Text className="text-base font-bold" style={{ color: balanceColor }}>
            {formatLedgerBalance(balance)}
          </Text>
        </View>
      </View>

      {entry.invoice_id ? (
        <View className="flex-row items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-200">
          <Ionicons name="document-text-outline" size={14} color={colors.info} />
          <Text
            className="flex-1 text-sm font-semibold"
            style={{ color: colors.info }}
          >
            View linked invoice
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.info} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export const LedgerEntryCard = memo(LedgerEntryCardComponent);
