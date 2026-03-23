import { Text, View } from "react-native";
import type { LedgerEntry } from "@/types/party";
import { useTheme } from "@/hooks/useTheme";

type PartyLedgerTableProps = {
  entries: LedgerEntry[];
  formatDate: (date: string) => string;
  formatAmount: (amount: number) => string;
  formatBalance: (balance: number) => string;
};

export function PartyLedgerTable({
  entries,
  formatDate,
  formatAmount,
  formatBalance,
}: PartyLedgerTableProps) {
  const { colors } = useTheme();

  if (entries.length === 0) {
    return (
      <View className="p-8 items-center" style={{ backgroundColor: colors.card }}>
        <Text style={{ color: colors.text.tertiary }}>No ledger entries found</Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.card }}>
      {/* Table Header */}
      <View className="flex-row px-4 py-3 border-b" style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border }}>
        <Text className="flex-1 text-xs font-semibold uppercase" style={{ color: colors.text.secondary }}>
          Date
        </Text>
        <Text className="flex-1 text-xs font-semibold uppercase" style={{ color: colors.text.secondary }}>
          Description
        </Text>
        <Text className="w-20 text-xs font-semibold uppercase text-right" style={{ color: colors.text.secondary }}>
          Debit
        </Text>
        <Text className="w-20 text-xs font-semibold uppercase text-right" style={{ color: colors.text.secondary }}>
          Credit
        </Text>
        <Text className="w-24 text-xs font-semibold uppercase text-right" style={{ color: colors.text.secondary }}>
          Balance
        </Text>
      </View>

      {/* Table Rows */}
      {entries.map((entry, index) => (
        <View
          key={entry._id || index}
          className="flex-row px-4 py-3 border-b"
          style={{ borderColor: colors.border }}
        >
          <Text className="flex-1 text-sm" style={{ color: colors.text.primary }}>
            {formatDate(entry.date)}
          </Text>
          <Text className="flex-1 text-sm" numberOfLines={2} style={{ color: colors.text.secondary }}>
            {entry.description || entry.type}
          </Text>
          <Text className="w-20 text-sm text-right" style={{ color: colors.error }}>
            {entry.debit > 0 ? formatAmount(entry.debit) : "-"}
          </Text>
          <Text className="w-20 text-sm text-right" style={{ color: colors.success }}>
            {entry.credit > 0 ? formatAmount(entry.credit) : "-"}
          </Text>
          <Text className="w-24 text-sm font-medium text-right" style={{ color: colors.text.primary }}>
            {formatBalance(entry.running_balance)}
          </Text>
        </View>
      ))}
    </View>
  );
}
