/**
 * DuePaymentModal
 *
 * Records a (partial or full) cash payment against an existing "due" transaction.
 */
import { useState, useEffect } from "react";
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
import {
  amountInputProps,
  normalizeAmountInput,
} from "@/lib/amount-input";
import { FormSheetModal } from "@/components/form-sheet-modal";
import { useTheme } from "@/hooks/use-theme";
import { usePreferences } from "@/hooks/use-preferences";
import { createDuePayment, type Transaction } from "@/services/transactions";
import { refreshTransactionData } from "@/lib/refresh-app-data";
import { SearchableSelect } from "../searchable-select";
import type { SelectOption } from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;
  dueTxn: Transaction;
  accountOptions: SelectOption[];
  onSuccess?: () => void;
};

export const DuePaymentModal = ({
  visible,
  onClose,
  dueTxn,
  accountOptions,
  onSuccess,
}: Props) => {
  const { colors } = useTheme();
  const { formatAmount } = usePreferences();
  const queryClient = useQueryClient();

  const remaining = dueTxn.due_remaining ?? dueTxn.amount;

  const [amount, setAmount] = useState(String(remaining));
  const [accountId, setAccountId] = useState(
    accountOptions[0]?.value ?? dueTxn.account._id,
  );
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (visible) {
      setAmount(String(dueTxn.due_remaining ?? dueTxn.amount));
      setAccountId(accountOptions[0]?.value ?? dueTxn.account._id);
      setDate(new Date());
      setDescription("");
    }
  }, [visible, dueTxn, accountOptions]);

  const mutation = useMutation({
    mutationFn: createDuePayment,
    onSuccess: () => {
      void refreshTransactionData(queryClient);
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      Alert.alert(
        "Error",
        err?.response?.data?.message ?? "Could not record payment",
      );
    },
  });

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid payment amount");
      return;
    }
    if (!accountId) {
      Alert.alert("Account Required", "Please select an account");
      return;
    }
    mutation.mutate({
      parentDueId: dueTxn._id,
      accountId,
      amount: numAmount,
      type: dueTxn.type,
      date: dayjs(date).format("YYYY-MM-DD"),
      description: description.trim() || undefined,
    });
  };

  const isFullPayment = parseFloat(amount) >= remaining - 0.001;
  const subtitle = dueTxn.party?.name
    ? `Party: ${dueTxn.party.name}`
    : dueTxn.counterparty
      ? `For: ${dueTxn.counterparty}`
      : "Due transaction payment";

  return (
    <FormSheetModal
      visible={visible}
      onClose={onClose}
      title="Record Payment"
      subtitle={subtitle}
      submitLabel={
        isFullPayment ? "Mark as Fully Paid" : "Record Partial Payment"
      }
      submitIcon={isFullPayment ? "checkmark-circle" : "cash-outline"}
      onSubmit={handleSubmit}
      isSubmitting={mutation.isPending}
      submittingLabel="Saving…"
    >
      <View className="gap-5">
        <View
          className="rounded-xl p-3"
          style={{
            backgroundColor: "#d97706" + "15",
            borderWidth: 1,
            borderColor: "#d97706" + "40",
          }}
        >
          <View className="flex-row items-center gap-2 mb-1">
            <Ionicons name="time-outline" size={16} color="#d97706" />
            <Text className="text-sm font-bold" style={{ color: "#d97706" }}>
              Original Due Transaction
            </Text>
          </View>
          <View className="flex-row justify-between mt-1">
            <Text className="text-xs" style={{ color: colors.text.secondary }}>
              {dayjs(dueTxn.date).format("MMM DD, YYYY")}
              {dueTxn.description ? ` · ${dueTxn.description}` : ""}
            </Text>
            <Text
              className="text-xs font-semibold"
              style={{ color: colors.text.primary }}
            >
              {formatAmount(dueTxn.amount)}
            </Text>
          </View>
          <View className="flex-row justify-between mt-1">
            <Text className="text-xs" style={{ color: colors.text.tertiary }}>
              Remaining to pay
            </Text>
            <Text
              className="text-xs font-bold"
              style={{
                color: dueTxn.type === "debit" ? "#e11d48" : "#16a34a",
              }}
            >
              {formatAmount(remaining)}
            </Text>
          </View>
        </View>

        <View>
          <Text
            className="text-sm font-semibold mb-2"
            style={{ color: colors.text.primary }}
          >
            Payment Amount
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
          <View className="flex-row gap-2 mt-2">
            {[0.25, 0.5, 0.75, 1].map((fraction) => {
              const val = Math.round(remaining * fraction);
              const label =
                fraction === 1 ? "Full" : `${Math.round(fraction * 100)}%`;
              return (
                <TouchableOpacity
                  key={fraction}
                  onPress={() => setAmount(String(val))}
                  className="flex-1 items-center py-1.5 rounded-lg"
                  style={{
                    backgroundColor:
                      parseFloat(amount) === val
                        ? colors.info + "25"
                        : colors.bg.tertiary,
                    borderWidth: 1,
                    borderColor:
                      parseFloat(amount) === val ? colors.info : colors.border,
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{
                      color:
                        parseFloat(amount) === val
                          ? colors.info
                          : colors.text.secondary,
                    }}
                  >
                    {label}
                  </Text>
                  <Text
                    className="text-xs"
                    style={{ color: colors.text.tertiary }}
                  >
                    {formatAmount(val)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <SearchableSelect
          label="Paid from Account"
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
            Payment Date
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
            Note (Optional)
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Partial payment by cash"
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
