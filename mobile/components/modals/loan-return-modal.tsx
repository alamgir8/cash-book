/**
 * LoanReturnModal — record a loan repayment (return) against Loan Given / Loan Received.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/use-theme";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import { createTransaction, type Transaction } from "@/services/transactions";
import { fetchCategories } from "@/services/categories";
import { refreshAppData } from "@/lib/refresh-app-data";
import {
  getLoanRepaymentConfig,
  getLoanPartyPayload,
  isLoanGivenRoot,
} from "@/lib/loan-utils";
import { SearchableSelect } from "../searchable-select";
import type { SelectOption } from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;
  loanTxn: Transaction;
  accountOptions: SelectOption[];
  onSuccess?: () => void;
};

export const LoanReturnModal = ({
  visible,
  onClose,
  loanTxn,
  accountOptions,
  onSuccess,
}: Props) => {
  const { colors } = useTheme();
  const { formatAmount } = usePreferences();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const repaymentConfig = useMemo(
    () => getLoanRepaymentConfig(loanTxn),
    [loanTxn],
  );
  const remaining = repaymentConfig?.remaining ?? 0;

  const [amount, setAmount] = useState(String(remaining));
  const [accountId, setAccountId] = useState(
    accountOptions[0]?.value ?? loanTxn.account._id,
  );
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (visible) {
      setAmount(String(repaymentConfig?.remaining ?? 0));
      setAccountId(accountOptions[0]?.value ?? loanTxn.account._id);
      setDate(new Date());
      setDescription("");
    }
  }, [visible, loanTxn, accountOptions, repaymentConfig?.remaining]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!repaymentConfig) {
        throw new Error("Unsupported loan transaction");
      }

      const categories = await fetchCategories();
      const category = categories.find(
        (c) => c.name === repaymentConfig.categoryName,
      );
      if (!category) {
        throw new Error(`Category "${repaymentConfig.categoryName}" not found`);
      }

      const partyPayload = getLoanPartyPayload(loanTxn);

      return createTransaction({
        accountId,
        amount: parseFloat(amount),
        type: repaymentConfig.type,
        date: dayjs(date).format("YYYY-MM-DD"),
        description: description.trim() || undefined,
        categoryId: category._id,
        party: partyPayload.party,
        for_party: partyPayload.for_party,
        payment_status: "paid",
      });
    },
    onSuccess: async () => {
      await refreshAppData(queryClient);
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      Alert.alert(
        "Error",
        err?.response?.data?.message ?? err?.message ?? "Could not record return",
      );
    },
  });

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid return amount");
      return;
    }
    if (!accountId) {
      Alert.alert("Account Required", "Please select an account");
      return;
    }
    if (!repaymentConfig) {
      Alert.alert("Error", "This transaction is not a supported loan type");
      return;
    }
    mutation.mutate();
  };

  if (!repaymentConfig) return null;

  const isFullReturn = parseFloat(amount) >= remaining - 0.001;
  const counterpartyLabel =
    (typeof loanTxn.for_party === "object"
      ? loanTxn.for_party?.name
      : undefined) ??
    (typeof loanTxn.party === "object" ? loanTxn.party?.name : undefined) ??
    loanTxn.counterparty ??
    "";

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
          style={{ ...StyleSheet.absoluteFillObject }}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={{
            height: Math.min(680, Dimensions.get("window").height * 0.82),
            backgroundColor: colors.bg.primary,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: colors.text.primary,
                }}
              >
                {t("returnLoan") ?? "Return Loan"}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.text.tertiary,
                  marginTop: 2,
                }}
              >
                {isLoanGivenRoot(loanTxn)
                  ? `Receiving back from ${counterpartyLabel}`
                  : `Paying back to ${counterpartyLabel}`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView
            bottomOffset={Platform.OS === "ios" ? 100 : 120}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
          >
            <View style={{ paddingHorizontal: 24, paddingVertical: 16, gap: 16 }}>
              <View
                className="rounded-xl p-3"
                style={{
                  backgroundColor: "#2563eb15",
                  borderWidth: 1,
                  borderColor: "#2563eb40",
                }}
              >
                <Text className="text-sm font-bold" style={{ color: "#2563eb" }}>
                  {loanTxn.category?.name ?? "Loan"}
                </Text>
                <Text
                  className="text-xs mt-1"
                  style={{ color: colors.text.secondary }}
                >
                  {dayjs(loanTxn.date).format("MMM DD, YYYY")}
                  {loanTxn.description ? ` · ${loanTxn.description}` : ""}
                </Text>
                <Text
                  className="text-xs font-bold mt-1"
                  style={{ color: colors.text.primary }}
                >
                  {t("remaining") ?? "Remaining"}: {formatAmount(remaining)}
                </Text>
              </View>

              <View>
                <Text
                  className="text-sm font-semibold mb-2"
                  style={{ color: colors.text.primary }}
                >
                  {t("returnAmount") ?? "Return Amount"}
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.text.tertiary}
                  style={{
                    backgroundColor: colors.bg.tertiary,
                    borderColor: colors.border,
                    color: colors.text.primary,
                  }}
                  className="px-4 py-3 rounded-xl border text-lg font-semibold"
                />
              </View>

              <SearchableSelect
                label={
                  isLoanGivenRoot(loanTxn)
                    ? "Received in Account"
                    : "Paid from Account"
                }
                placeholder="Select account"
                value={accountId}
                options={accountOptions}
                onSelect={(v) => setAccountId(v ?? "")}
              />

              <View>
                <Text
                  className="text-sm font-semibold mb-2"
                  style={{ color: colors.text.primary }}
                >
                  {t("date") ?? "Date"}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className="px-4 py-3 rounded-xl border flex-row items-center justify-between"
                  style={{
                    backgroundColor: colors.bg.tertiary,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.text.primary }}>
                    {dayjs(date).format("MMM DD, YYYY")}
                  </Text>
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={colors.text.secondary}
                  />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display={Platform.OS === "ios" ? "compact" : "default"}
                    onChange={(_, d) => {
                      setShowDatePicker(false);
                      if (d) setDate(d);
                    }}
                  />
                )}
              </View>

              <View>
                <Text
                  className="text-sm font-semibold mb-2"
                  style={{ color: colors.text.primary }}
                >
                  {t("noteOptional") ?? "Note (Optional)"}
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholderTextColor={colors.text.tertiary}
                  style={{
                    backgroundColor: colors.bg.tertiary,
                    borderColor: colors.border,
                    color: colors.text.primary,
                  }}
                  className="px-4 py-3 rounded-xl border"
                />
              </View>
            </View>
          </KeyboardAwareScrollView>

          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 16),
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={mutation.isPending}
              className="rounded-2xl py-4 items-center"
              style={{ backgroundColor: isFullReturn ? "#16a34a" : "#2563eb" }}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">
                  {isFullReturn
                    ? (t("recordFullReturn") ?? "Record Full Return")
                    : (t("recordPartialReturn") ?? "Record Partial Return")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
