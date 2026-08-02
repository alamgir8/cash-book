/**
 * LoanReturnModal — record a loan repayment (return) against Loan Given / Loan Received.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormSheetModal } from "@/components/form-sheet-modal";
import { useTheme } from "@/hooks/use-theme";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import {
  amountInputProps,
  normalizeAmountInput,
} from "@/lib/amount-input";
import { createTransaction, type Transaction } from "@/services/transactions";
import { dalFetchCategories } from "@/data/categories";
import { refreshTransactionData } from "@/lib/refresh-app-data";
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

      const categories = await dalFetchCategories();
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
      await refreshTransactionData(queryClient);
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      Alert.alert(
        "Error",
        err?.response?.data?.message ??
          err?.message ??
          "Could not record return",
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
    <FormSheetModal
      visible={visible}
      onClose={onClose}
      title={t("returnLoan") ?? "Return Loan"}
      subtitle={
        isLoanGivenRoot(loanTxn)
          ? `Receiving back from ${counterpartyLabel}`
          : `Paying back to ${counterpartyLabel}`
      }
      submitLabel={
        isFullReturn
          ? (t("recordFullReturn") ?? "Record Full Return")
          : (t("recordPartialReturn") ?? "Record Partial Return")
      }
      submitIcon="checkmark-circle"
      onSubmit={handleSubmit}
      isSubmitting={mutation.isPending}
      submittingLabel={t("saving") ?? "Saving…"}
    >
      <View className="gap-5">
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
            onChangeText={(text) => setAmount(normalizeAmountInput(text))}
            {...amountInputProps}
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
          {showDatePicker ? (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === "ios" ? "compact" : "default"}
              onChange={(_, d) => {
                setShowDatePicker(false);
                if (d) setDate(d);
              }}
            />
          ) : null}
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
    </FormSheetModal>
  );
};
