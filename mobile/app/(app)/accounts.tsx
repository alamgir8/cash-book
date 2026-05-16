import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { ScreenHeader } from "@/components/screen-header";
import { EmptyState } from "@/components/empty-state";
import { AccountFormModal } from "@/components/accounts/account-form-modal";
import { useTheme } from "@/hooks/use-theme";
import { useAccountsScreen } from "@/hooks/use-accounts-screen";

export default function AccountsScreen() {
  const { colors } = useTheme();

  const {
    modalVisible,
    selectedAccount,
    accountsQuery,
    accounts,
    totals,
    lastActivityLabel,
    canManageAccounts,
    isSubmitting,
    openModal,
    closeModal,
    handleSubmit,
    handleViewHistory,
    formatAmount,
    formatSignedAmount,
  } = useAccountsScreen();

  const netPositive = totals.netBalance >= 0;

  const renderHeader = () => (
    <View className="gap-4 mb-2">
      <View
        className="rounded-2xl p-5 border shadow-sm"
        style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border }}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold" style={{ color: colors.text.primary }}>
            Portfolio Overview
          </Text>
          <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.info + "25" }}>
            <Text className="text-xs font-semibold" style={{ color: colors.info }}>
              {totals.totalAccounts} Accounts
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3 mt-4">
          <View
            className="flex-1 rounded-xl p-4 border"
            style={{ backgroundColor: colors.success + "15", borderColor: colors.success + "40" }}
          >
            <Text className="text-xs font-semibold uppercase" style={{ color: colors.success }}>
              Total Credit
            </Text>
            <Text className="text-2xl font-bold mt-2" style={{ color: colors.success }}>
              {formatAmount(totals.totalCredit)}
            </Text>
            <Text className="text-xs mt-1" style={{ color: colors.text.secondary }}>
              Across all accounts
            </Text>
          </View>
          <View
            className="flex-1 rounded-xl p-4 border"
            style={{ backgroundColor: colors.error + "15", borderColor: colors.error + "40" }}
          >
            <Text className="text-xs font-semibold uppercase" style={{ color: colors.error }}>
              Total Debit
            </Text>
            <Text className="text-2xl font-bold mt-2" style={{ color: colors.error }}>
              {formatAmount(totals.totalDebit)}
            </Text>
            <Text className="text-xs mt-1" style={{ color: colors.text.secondary }}>
              Overall spending
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3 mt-3">
          <View
            className="flex-1 rounded-xl p-4 border"
            style={{
              backgroundColor: netPositive ? colors.success + "15" : colors.error + "15",
              borderColor: netPositive ? colors.success + "40" : colors.error + "40",
            }}
          >
            <Text
              className="text-xs font-semibold uppercase"
              style={{ color: netPositive ? colors.success : colors.error }}
            >
              Net Balance
            </Text>
            <Text
              className="text-2xl font-bold mt-2"
              style={{ color: netPositive ? colors.success : colors.error }}
            >
              {formatAmount(Math.abs(totals.netBalance))}
            </Text>
            <Text className="text-xs mt-1" style={{ color: colors.text.secondary }}>
              {netPositive ? "Surplus across accounts" : "Outstanding balance"}
            </Text>
          </View>
          <View
            className="flex-1 rounded-xl p-4 border"
            style={{ backgroundColor: colors.info + "15", borderColor: colors.info + "40" }}
          >
            <Text className="text-xs font-semibold uppercase" style={{ color: colors.info }}>
              Transactions
            </Text>
            <Text className="text-2xl font-bold mt-2" style={{ color: colors.info }}>
              {formatAmount(totals.totalTransactions, { showCurrency: false })}
            </Text>
            <Text className="text-xs mt-1" style={{ color: colors.text.secondary }}>
              Last activity: {lastActivityLabel}
            </Text>
          </View>
        </View>
      </View>

      <Text
        className="text-sm font-semibold uppercase tracking-wide px-1"
        style={{ color: colors.text.secondary }}
      >
        Accounts
      </Text>
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const lastActivity = item.summary.lastTransactionDate
        ? dayjs(item.summary.lastTransactionDate).format("MMM D, YYYY")
        : "No activity yet";
      const netFlow = item.summary.net ?? 0;
      const netFlowPositive = netFlow >= 0;

      return (
        <View
          className="rounded-2xl p-4 border shadow-sm"
          style={{
            backgroundColor: colors.bg.secondary,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.06,
            shadowRadius: 10,
            elevation: 4,
          }}
        >
          <View className="flex-row justify-between items-start">
            <View className="flex-1 mr-4">
              <Text className="text-xl font-bold" style={{ color: colors.text.primary }}>
                {item.name}
              </Text>
              <View className="flex-row items-center gap-2 mt-2">
                <Text className="text-xs" style={{ color: colors.text.secondary }}>
                  Last activity: {lastActivity}
                </Text>
              </View>
            </View>
            <View className="items-end">
              <Text className="text-xs font-medium uppercase" style={{ color: colors.text.secondary }}>
                Balance
              </Text>
              <Text
                className="text-2xl font-bold"
                style={{ color: item.balance >= 0 ? colors.success : colors.error }}
              >
                {formatAmount(Math.abs(item.balance))}
              </Text>
            </View>
          </View>

          {item.description ? (
            <Text className="text-sm mt-4 leading-5" style={{ color: colors.text.secondary }}>
              {item.description}
            </Text>
          ) : null}

          <View className="flex-row gap-3 mt-4">
            <View
              className="flex-1 rounded-xl p-3 border"
              style={{ backgroundColor: colors.success + "15", borderColor: colors.success + "40" }}
            >
              <Text className="text-xs font-semibold uppercase" style={{ color: colors.success }}>
                Total Credit
              </Text>
              <Text className="text-lg font-bold mt-1" style={{ color: colors.success }}>
                {formatAmount(item.summary.totalCredit ?? 0)}
              </Text>
            </View>
            <View
              className="flex-1 rounded-xl p-3 border"
              style={{ backgroundColor: colors.error + "15", borderColor: colors.error + "40" }}
            >
              <Text className="text-xs font-semibold uppercase" style={{ color: colors.error }}>
                Total Debit
              </Text>
              <Text className="text-lg font-bold mt-1" style={{ color: colors.error }}>
                {formatAmount(item.summary.totalDebit ?? 0)}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3 mt-3">
            <View
              className="flex-1 rounded-xl p-3 border"
              style={{ backgroundColor: colors.bg.tertiary, borderColor: colors.border }}
            >
              <Text className="text-xs font-semibold uppercase" style={{ color: colors.text.secondary }}>
                Transactions
              </Text>
              <Text className="text-lg font-bold mt-1" style={{ color: colors.text.primary }}>
                {formatAmount(item.summary.totalTransactions ?? 0, { showCurrency: false })}
              </Text>
            </View>
            <View
              className="flex-1 rounded-xl p-3 border"
              style={{
                backgroundColor: netFlowPositive ? colors.success + "15" : colors.error + "15",
                borderColor: netFlowPositive ? colors.success + "40" : colors.error + "40",
              }}
            >
              <Text
                className="text-xs font-semibold uppercase"
                style={{ color: netFlowPositive ? colors.success : colors.error }}
              >
                Net Flow
              </Text>
              <Text
                className="text-lg font-bold mt-1"
                style={{ color: netFlowPositive ? colors.success : colors.error }}
              >
                {formatSignedAmount(netFlow)}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={() => handleViewHistory(item._id)}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 active:opacity-90"
              style={{ backgroundColor: colors.info }}
            >
              <Ionicons name="time-outline" size={18} color="#fff" />
              <Text className="text-white font-semibold">View History</Text>
            </TouchableOpacity>
            {canManageAccounts && (
              <TouchableOpacity
                onPress={() => openModal(item)}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5"
                style={{ backgroundColor: colors.bg.tertiary, borderColor: colors.border, borderWidth: 1 }}
              >
                <Ionicons name="pencil" size={18} color={colors.text.secondary} />
                <Text className="font-semibold" style={{ color: colors.text.primary }}>
                  Edit
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    },
    [colors, canManageAccounts, formatAmount, formatSignedAmount, handleViewHistory, openModal],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title="Accounts"
        subtitle="Manage your financial accounts"
        actionButton={
          canManageAccounts
            ? { label: "Add", onPress: () => openModal(), icon: "add" }
            : undefined
        }
        icon="analytics"
      />

      <FlatList
        data={accounts}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          gap: 16,
          paddingBottom: 88,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={accountsQuery.isRefetching}
            onRefresh={() => accountsQuery.refetch()}
            tintColor={colors.info}
            colors={[colors.info]}
          />
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          accountsQuery.isLoading ? (
            <View className="items-center mt-12">
              <ActivityIndicator color={colors.info} size="large" />
              <Text className="mt-4 text-base" style={{ color: colors.text.secondary }}>
                Loading accounts...
              </Text>
            </View>
          ) : (
            <EmptyState
              isLoading={false}
              icon="wallet-outline"
              title="No Accounts Yet"
              description={
                canManageAccounts
                  ? "Create your first account to start tracking your finances."
                  : "No accounts available. Contact your organization owner to add accounts."
              }
              actionButton={
                canManageAccounts
                  ? { label: "Create Account", onPress: () => openModal() }
                  : undefined
              }
            />
          )
        }
        renderItem={renderItem}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        initialNumToRender={10}
        windowSize={10}
      />

      <AccountFormModal
        visible={modalVisible}
        editingAccount={selectedAccount}
        isSubmitting={isSubmitting}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </View>
  );
}
