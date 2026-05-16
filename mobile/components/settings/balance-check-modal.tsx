import { useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { useTheme } from "@/hooks/use-theme";
import {
  verifyBalances,
  reconcileBalances,
  fixAccount,
  type BalanceVerificationReport,
  type AccountDiscrepancy,
} from "@/services/reconciliation";

type Props = {
  visible: boolean;
  onClose: () => void;
  organizationId?: string;
};

export function BalanceCheckModal({ visible, onClose, organizationId }: Props) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<BalanceVerificationReport | null>(null);
  const [fixingAll, setFixingAll] = useState(false);
  const [fixingId, setFixingId] = useState<string | null>(null);
  // Track which accounts have been fixed this session
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());

  const runVerify = useCallback(async () => {
    setLoading(true);
    setReport(null);
    setFixedIds(new Set());
    try {
      const r = await verifyBalances(organizationId);
      setReport(r);
    } catch {
      Toast.show({
        type: "error",
        text1: "Verification failed",
        text2: "Could not reach server.",
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const handleFixOne = useCallback(
    async (d: AccountDiscrepancy) => {
      Alert.alert(
        "Fix This Account?",
        `Recalculate balance for "${d.account_name}"?\n\nStored: ${d.stored_balance.toFixed(2)}\nCorrect: ${d.computed_balance.toFixed(2)}\nDiff: ${d.difference > 0 ? "+" : ""}${d.difference.toFixed(2)}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Fix",
            onPress: async () => {
              setFixingId(d.account_id);
              try {
                await fixAccount(d.account_id, organizationId);
                setFixedIds((prev) => new Set([...prev, d.account_id]));
                void queryClient.invalidateQueries({ queryKey: ["accounts"] });
                void queryClient.invalidateQueries({
                  queryKey: ["transactions"],
                });
                Toast.show({
                  type: "success",
                  text1: `"${d.account_name}" fixed`,
                });
              } catch {
                Toast.show({
                  type: "error",
                  text1: "Fix failed",
                  text2: "Please try again.",
                });
              } finally {
                setFixingId(null);
              }
            },
          },
        ],
      );
    },
    [organizationId, queryClient],
  );

  const handleFixAll = useCallback(async () => {
    if (!report) return;
    const remaining = report.discrepancies.filter(
      (d) => !fixedIds.has(d.account_id),
    );
    if (remaining.length === 0) return;
    Alert.alert(
      "Fix All Accounts?",
      `This will recalculate balances for ${remaining.length} account(s) with discrepancies. All transaction running balances will also be corrected.\n\nThis cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Fix ${remaining.length} Account${remaining.length > 1 ? "s" : ""}`,
          style: "destructive",
          onPress: async () => {
            setFixingAll(true);
            try {
              const result = await reconcileBalances(organizationId);
              void queryClient.invalidateQueries({ queryKey: ["accounts"] });
              void queryClient.invalidateQueries({
                queryKey: ["transactions"],
              });
              // Mark all as fixed
              setFixedIds(
                new Set(report.discrepancies.map((d) => d.account_id)),
              );
              Toast.show({
                type: "success",
                text1: `Fixed ${result.corrections_made} account(s)`,
                text2: `${result.transactions_updated} transaction running balances updated`,
              });
            } catch {
              Toast.show({
                type: "error",
                text1: "Fix failed",
                text2: "Please try again.",
              });
            } finally {
              setFixingAll(false);
            }
          },
        },
      ],
    );
  }, [report, fixedIds, organizationId, queryClient]);

  const handleClose = () => {
    setReport(null);
    setFixedIds(new Set());
    onClose();
  };

  const fmt = (n: number) => {
    const abs = Math.abs(n).toFixed(2);
    return n < 0 ? `-${abs}` : abs;
  };

  const remainingDiscrepancies =
    report?.discrepancies.filter((d) => !fixedIds.has(d.account_id)) ?? [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={{ backgroundColor: colors.bg.primary }} className="flex-1">
        {/* Header */}
        <View
          style={{ borderColor: colors.border }}
          className="flex-row items-center justify-between px-4 pt-4 pb-3 border-b"
        >
          <View className="flex-row items-center gap-2">
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={colors.info}
            />
            <Text
              style={{ color: colors.text.primary }}
              className="text-lg font-bold"
            >
              Balance Health Check
            </Text>
          </View>
          <TouchableOpacity onPress={handleClose} className="p-1">
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Run verify button */}
          <TouchableOpacity
            onPress={runVerify}
            disabled={loading || fixingAll}
            className="flex-row items-center justify-center gap-2 py-3.5 rounded-xl"
            style={{
              backgroundColor: colors.info + "20",
              borderWidth: 1,
              borderColor: colors.info + "50",
            }}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.info} />
            ) : (
              <Ionicons name="scan-outline" size={18} color={colors.info} />
            )}
            <Text
              style={{ color: colors.info }}
              className="font-semibold text-base"
            >
              {loading
                ? "Checking…"
                : report
                  ? "Re-check All Accounts"
                  : "Check All Accounts"}
            </Text>
          </TouchableOpacity>

          {/* Results */}
          {report && (
            <View className="gap-3">
              {/* Summary bar */}
              <View
                style={{
                  backgroundColor:
                    remainingDiscrepancies.length === 0
                      ? colors.success + "15"
                      : colors.warning + "15",
                  borderColor:
                    remainingDiscrepancies.length === 0
                      ? colors.success + "40"
                      : colors.warning + "40",
                  borderWidth: 1,
                }}
                className="flex-row items-center gap-3 px-4 py-3 rounded-xl"
              >
                <Ionicons
                  name={
                    remainingDiscrepancies.length === 0
                      ? "checkmark-circle"
                      : "warning"
                  }
                  size={22}
                  color={
                    remainingDiscrepancies.length === 0
                      ? colors.success
                      : colors.warning
                  }
                />
                <View className="flex-1">
                  <Text
                    style={{
                      color:
                        remainingDiscrepancies.length === 0
                          ? colors.success
                          : colors.warning,
                    }}
                    className="font-semibold text-sm"
                  >
                    {remainingDiscrepancies.length === 0
                      ? `All ${report.accounts_checked} account(s) are correct`
                      : `${remainingDiscrepancies.length} of ${report.accounts_checked} account(s) need fixing`}
                  </Text>
                  <Text
                    style={{ color: colors.text.tertiary }}
                    className="text-xs mt-0.5"
                  >
                    {report.transfers_checked} transfer(s) checked
                    {report.orphaned_transfer_legs.length > 0
                      ? ` · ${report.orphaned_transfer_legs.length} orphaned leg(s)`
                      : ""}
                  </Text>
                </View>
              </View>

              {/* Fix All button — only show when there are remaining issues */}
              {remainingDiscrepancies.length > 1 && (
                <TouchableOpacity
                  onPress={handleFixAll}
                  disabled={fixingAll || fixingId !== null}
                  className="flex-row items-center justify-center gap-2 py-3 rounded-xl"
                  style={{
                    backgroundColor: colors.error + "15",
                    borderWidth: 1,
                    borderColor: colors.error + "40",
                  }}
                >
                  {fixingAll ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <Ionicons
                      name="build-outline"
                      size={16}
                      color={colors.error}
                    />
                  )}
                  <Text
                    style={{ color: colors.error }}
                    className="font-semibold text-sm"
                  >
                    {fixingAll
                      ? "Fixing all…"
                      : `Fix All ${remainingDiscrepancies.length} Accounts`}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Discrepancy list */}
              {report.discrepancies.map((d) => {
                const isFixed = fixedIds.has(d.account_id);
                const isFixingThis = fixingId === d.account_id;
                return (
                  <View
                    key={d.account_id}
                    style={{
                      backgroundColor: isFixed
                        ? colors.success + "10"
                        : colors.bg.secondary,
                      borderColor: isFixed
                        ? colors.success + "40"
                        : colors.border,
                      borderWidth: 1,
                    }}
                    className="rounded-xl px-4 py-3 gap-2"
                  >
                    {/* Account name + fix button */}
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2 flex-1">
                        <Ionicons
                          name={
                            isFixed
                              ? "checkmark-circle"
                              : "alert-circle-outline"
                          }
                          size={16}
                          color={isFixed ? colors.success : colors.warning}
                        />
                        <Text
                          style={{ color: colors.text.primary, flex: 1 }}
                          className="font-semibold text-sm"
                          numberOfLines={1}
                        >
                          {d.account_name}
                        </Text>
                      </View>
                      {!isFixed && (
                        <TouchableOpacity
                          onPress={() => handleFixOne(d)}
                          disabled={fixingId !== null || fixingAll}
                          className="flex-row items-center gap-1 px-3 py-1 rounded-lg"
                          style={{ backgroundColor: colors.info + "20" }}
                        >
                          {isFixingThis ? (
                            <ActivityIndicator size={12} color={colors.info} />
                          ) : (
                            <Ionicons
                              name="build-outline"
                              size={13}
                              color={colors.info}
                            />
                          )}
                          <Text
                            style={{ color: colors.info }}
                            className="text-xs font-semibold"
                          >
                            {isFixingThis ? "Fixing…" : "Fix"}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {isFixed && (
                        <Text
                          style={{ color: colors.success }}
                          className="text-xs font-semibold"
                        >
                          Fixed ✓
                        </Text>
                      )}
                    </View>

                    {/* Balance details */}
                    <View className="gap-1 pl-6">
                      <View className="flex-row justify-between">
                        <Text
                          style={{ color: colors.text.tertiary }}
                          className="text-xs"
                        >
                          Stored balance
                        </Text>
                        <Text
                          style={{ color: colors.text.secondary }}
                          className="text-xs font-medium"
                        >
                          {fmt(d.stored_balance)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text
                          style={{ color: colors.text.tertiary }}
                          className="text-xs"
                        >
                          Correct balance
                        </Text>
                        <Text
                          style={{ color: colors.success }}
                          className="text-xs font-medium"
                        >
                          {fmt(d.computed_balance)}
                        </Text>
                      </View>
                      <View
                        style={{
                          borderTopColor: colors.border,
                          borderTopWidth: 1,
                        }}
                        className="flex-row justify-between pt-1 mt-0.5"
                      >
                        <Text
                          style={{ color: colors.text.tertiary }}
                          className="text-xs"
                        >
                          Difference
                        </Text>
                        <Text
                          style={{
                            color:
                              d.difference > 0 ? colors.success : colors.error,
                          }}
                          className="text-xs font-semibold"
                        >
                          {d.difference > 0 ? "+" : ""}
                          {fmt(d.difference)}
                        </Text>
                      </View>
                      {(d.transaction_count ?? 0) > 0 && (
                        <Text
                          style={{ color: colors.text.tertiary }}
                          className="text-xs mt-0.5"
                        >
                          {d.transaction_count} transaction(s) · opening{" "}
                          {fmt(d.opening_balance)}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}

              {/* Orphaned transfer warnings */}
              {report.orphaned_transfer_legs.length > 0 && (
                <View
                  style={{
                    backgroundColor: colors.error + "10",
                    borderColor: colors.error + "40",
                    borderWidth: 1,
                  }}
                  className="rounded-xl px-4 py-3 gap-1"
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      name="git-branch-outline"
                      size={16}
                      color={colors.error}
                    />
                    <Text
                      style={{ color: colors.error }}
                      className="font-semibold text-sm"
                    >
                      {report.orphaned_transfer_legs.length} Orphaned Transfer
                      Leg(s)
                    </Text>
                  </View>
                  <Text
                    style={{ color: colors.text.secondary }}
                    className="text-xs pl-6"
                  >
                    One side of a transfer is deleted but the other is not.
                    These require manual review.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Initial empty state */}
          {!report && !loading && (
            <View className="items-center py-12 gap-3">
              <Ionicons
                name="shield-outline"
                size={48}
                color={colors.text.tertiary}
              />
              <Text
                style={{ color: colors.text.tertiary }}
                className="text-center text-sm px-8"
              >
                Run a check to see if your account balances match your
                transaction history.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
