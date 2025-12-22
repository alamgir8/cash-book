import { Text, View } from "react-native";
import type { LedgerEntry } from "@/types/party";

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
  if (entries.length === 0) {
    return (
      <View className="bg-white p-8 items-center">
        <Text className="text-gray-500">No ledger entries found</Text>
      </View>
    );
  }

  return (
    <View className="bg-white">
      {/* Table Header */}
      <View className="flex-row bg-gray-50 px-4 py-3 border-b border-gray-200">
        <Text className="flex-1 text-xs font-semibold text-gray-600 uppercase">
          Date
        </Text>
        <Text className="flex-1 text-xs font-semibold text-gray-600 uppercase">
          Description
        </Text>
        <Text className="w-20 text-xs font-semibold text-gray-600 uppercase text-right">
          Debit
        </Text>
        <Text className="w-20 text-xs font-semibold text-gray-600 uppercase text-right">
          Credit
        </Text>
        <Text className="w-24 text-xs font-semibold text-gray-600 uppercase text-right">
          Balance
        </Text>
      </View>

      {/* Table Rows */}
      {entries.map((entry, index) => (
        <View
          key={entry._id || index}
          className="flex-row px-4 py-3 border-b border-gray-100"
        >
          <Text className="flex-1 text-sm text-gray-900">
            {formatDate(entry.date)}
          </Text>
          <Text className="flex-1 text-sm text-gray-700" numberOfLines={2}>
            {entry.description || entry.type}
          </Text>
          <Text className="w-20 text-sm text-red-600 text-right">
            {entry.debit > 0 ? formatAmount(entry.debit) : "-"}
          </Text>
          <Text className="w-20 text-sm text-green-600 text-right">
            {entry.credit > 0 ? formatAmount(entry.credit) : "-"}
          </Text>
          <Text className="w-24 text-sm text-gray-900 font-medium text-right">
            {formatBalance(entry.running_balance)}
          </Text>
        </View>
      ))}
    </View>
  );
}
