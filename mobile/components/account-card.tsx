import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { router } from "expo-router";
import { usePreferences } from "../hooks/usePreferences";
import { useTheme } from "../hooks/useTheme";
import type { AccountOverview } from "../services/accounts";

type Props = {
  account: AccountOverview;
  onEdit: (accountId: string) => void;
  onDelete: (accountId: string, accountName: string) => void;
};

const AccountCardComponent = ({ account, onEdit, onDelete }: Props) => {
  const { formatAmount } = usePreferences();
  const { colors } = useTheme();

  const lastActivity = account.summary.lastTransactionDate
    ? dayjs(account.summary.lastTransactionDate).format("MMM D, YYYY")
    : "No activity yet";
  const netFlow = account.summary.net ?? 0;
  const netFlowPositive = netFlow >= 0;

  return (
    <View
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 4,
      }}
      className="rounded-2xl p-4 border shadow-sm"
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-4">
          <Text
            style={{ color: colors.text.primary }}
            className="text-xl font-bold"
          >
            {account.name}
          </Text>
          <View className="flex-row items-center gap-2 mt-2">
            <View
              style={{ backgroundColor: colors.info + "25" }}
              className="px-3 py-1 rounded-full"
            >
              <Text
                style={{ color: colors.info }}
                className="text-xs font-semibold uppercase"
              >
                {account.kind.replace(/_/g, " ")}
              </Text>
            </View>
            <Text style={{ color: colors.text.tertiary }} className="text-xs">
              {lastActivity}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text
            style={{ color: colors.text.primary }}
            className="text-2xl font-bold"
          >
            {formatAmount(account.balance ?? 0)}
          </Text>
          <View className="flex-row items-center gap-1 mt-1">
            <Ionicons
              name={netFlowPositive ? "trending-up" : "trending-down"}
              size={14}
              color={netFlowPositive ? colors.success : colors.error}
            />
            <Text
              style={{
                color: netFlowPositive ? colors.success : colors.error,
              }}
              className="text-xs font-semibold"
            >
              {netFlowPositive ? "+" : ""}
              {formatAmount(netFlow)}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={{
          borderColor: colors.border,
        }}
        className="mt-4 pt-4 border-t"
      >
        <View className="flex-row justify-between mb-3">
          <View className="flex-1">
            <Text
              style={{ color: colors.text.tertiary }}
              className="text-xs mb-1"
            >
              Total Credit
            </Text>
            <Text
              style={{ color: colors.success }}
              className="text-base font-bold"
            >
              {formatAmount(account.summary.totalCredit ?? 0)}
            </Text>
          </View>
          <View className="flex-1 items-center">
            <Text
              style={{ color: colors.text.tertiary }}
              className="text-xs mb-1"
            >
              Total Debit
            </Text>
            <Text
              style={{ color: colors.error }}
              className="text-base font-bold"
            >
              {formatAmount(account.summary.totalDebit ?? 0)}
            </Text>
          </View>
          <View className="flex-1 items-end">
            <Text
              style={{ color: colors.text.tertiary }}
              className="text-xs mb-1"
            >
              Transactions
            </Text>
            <Text
              style={{ color: colors.text.primary }}
              className="text-base font-bold"
            >
              {formatAmount(account.summary.totalTransactions ?? 0)}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => router.push(`/accounts/${account._id}`)}
            style={{ backgroundColor: colors.info }}
            className="flex-1 rounded-xl py-3 active:scale-95"
          >
            <Text
              style={{ color: "#ffffff" }}
              className="font-bold text-center text-sm"
            >
              View Details
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: colors.bg.tertiary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            onPress={() => onEdit(account._id)}
            className="rounded-xl px-4 py-3 active:scale-95"
          >
            <Ionicons name="create" size={18} color={colors.info} />
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: colors.error + "15",
              borderWidth: 1,
              borderColor: colors.error + "40",
            }}
            onPress={() => onDelete(account._id, account.name)}
            className="rounded-xl px-4 py-3 active:scale-95"
          >
            <Ionicons name="trash" size={18} color={colors.error} />
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
  },
);
