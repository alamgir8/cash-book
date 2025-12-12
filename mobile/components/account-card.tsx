import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { router } from "expo-router";
import { usePreferences } from "../hooks/usePreferences";
import type { AccountOverview } from "../services/accounts";

type Props = {
  account: AccountOverview;
  onEdit: (accountId: string) => void;
  onDelete: (accountId: string, accountName: string) => void;
};

const AccountCardComponent = ({ account, onEdit, onDelete }: Props) => {
  const { formatAmount } = usePreferences();

  const lastActivity = account.summary.lastTransactionDate
    ? dayjs(account.summary.lastTransactionDate).format("MMM D, YYYY")
    : "No activity yet";
  const netFlow = account.summary.net ?? 0;
  const netFlowPositive = netFlow >= 0;

  return (
    <View
      className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 4,
      }}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-4">
          <Text className="text-gray-900 text-xl font-bold">
            {account.name}
          </Text>
          <View className="flex-row items-center gap-2 mt-2">
            <View className="bg-blue-100 px-3 py-1 rounded-full">
              <Text className="text-blue-700 text-xs font-semibold uppercase">
                {account.kind.replace(/_/g, " ")}
              </Text>
            </View>
            <Text className="text-gray-500 text-xs">{lastActivity}</Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-2xl font-bold text-gray-900">
            {formatAmount(account.balance ?? 0)}
          </Text>
          <View className="flex-row items-center gap-1 mt-1">
            <Ionicons
              name={netFlowPositive ? "trending-up" : "trending-down"}
              size={14}
              color={netFlowPositive ? "#10b981" : "#ef4444"}
            />
            <Text
              className={`text-xs font-semibold ${
                netFlowPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              {netFlowPositive ? "+" : ""}
              {formatAmount(netFlow)}
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-4 pt-4 border-t border-gray-100">
        <View className="flex-row justify-between mb-3">
          <View className="flex-1">
            <Text className="text-xs text-gray-500 mb-1">Total Credit</Text>
            <Text className="text-base font-bold text-green-600">
              {formatAmount(account.summary.totalCredit ?? 0)}
            </Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-xs text-gray-500 mb-1">Total Debit</Text>
            <Text className="text-base font-bold text-red-600">
              {formatAmount(account.summary.totalDebit ?? 0)}
            </Text>
          </View>
          <View className="flex-1 items-end">
            <Text className="text-xs text-gray-500 mb-1">Transactions</Text>
            <Text className="text-base font-bold text-gray-900">
              {formatAmount(account.summary.totalTransactions ?? 0)}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => router.push(`/accounts/${account._id}`)}
            className="flex-1 bg-blue-50 rounded-xl py-3 active:scale-95"
          >
            <Text className="text-blue-700 font-bold text-center text-sm">
              View Details
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onEdit(account._id)}
            className="bg-gray-100 rounded-xl px-4 py-3 active:scale-95"
          >
            <Ionicons name="create" size={18} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(account._id, account.name)}
            className="bg-red-50 rounded-xl px-4 py-3 active:scale-95"
          >
            <Ionicons name="trash" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// Memoize with custom comparison
export const AccountCard = memo(
  AccountCardComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.account._id === nextProps.account._id &&
      prevProps.account.name === nextProps.account.name &&
      prevProps.account.kind === nextProps.account.kind &&
      prevProps.account.balance === nextProps.account.balance &&
      prevProps.account.summary.totalCredit ===
        nextProps.account.summary.totalCredit &&
      prevProps.account.summary.totalDebit ===
        nextProps.account.summary.totalDebit &&
      prevProps.account.summary.net === nextProps.account.summary.net &&
      prevProps.account.summary.totalTransactions ===
        nextProps.account.summary.totalTransactions &&
      prevProps.account.summary.lastTransactionDate ===
        nextProps.account.summary.lastTransactionDate &&
      prevProps.onEdit === nextProps.onEdit &&
      prevProps.onDelete === nextProps.onDelete
    );
  }
);
