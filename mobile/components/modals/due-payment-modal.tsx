/**
 * DuePaymentModal
 *
 * Records a (partial or full) cash payment against an existing "due" transaction.
 * Shows context from the original due transaction so the user knows what they're paying.
 */
import { useState, useEffect } from "react";
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
import { createDuePayment, type Transaction } from "@/services/transactions";
import { refreshAppData } from "@/lib/refresh-app-data";
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
  const insets = useSafeAreaInsets();
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
      void refreshAppData(queryClient);
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

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        }}
      >
        {/* Backdrop dismiss (absolute so sheet container is the sole flex child) */}
        <TouchableOpacity
          style={{ ...StyleSheet.absoluteFillObject }}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Bottom sheet */}
        <View
          style={{
            height: Math.min(680, Dimensions.get("window").height * 0.82),
            backgroundColor: colors.bg.primary,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 24,
          }}
        >
          {/* ── FIXED HEADER ─────────────────────────────────────────── */}
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
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: colors.bg.primary,
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
                Record Payment
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.text.tertiary,
                  marginTop: 2,
                }}
              >
                {dueTxn.party?.name
                  ? `Party: ${dueTxn.party.name}`
                  : dueTxn.counterparty
                    ? `For: ${dueTxn.counterparty}`
                    : "Due transaction payment"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.bg.tertiary,
                alignItems: "center",
                justifyContent: "center",
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* ── SCROLLABLE FORM CONTENT ───────────────────────────────── */}
          <KeyboardAwareScrollView
            bottomOffset={Platform.OS === "ios" ? 100 : 120}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
          >
            <View
              style={{ paddingHorizontal: 24, paddingVertical: 16, gap: 16 }}
            >
              {/* Due context banner */}
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
                  <Text
                    className="text-sm font-bold"
                    style={{ color: "#d97706" }}
                  >
                    Original Due Transaction
                  </Text>
                </View>
                <View className="flex-row justify-between mt-1">
                  <Text
                    className="text-xs"
                    style={{ color: colors.text.secondary }}
                  >
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
                  <Text
                    className="text-xs"
                    style={{ color: colors.text.tertiary }}
                  >
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

              {/* Amount */}
              <View>
                <Text
                  className="text-sm font-semibold mb-2"
                  style={{ color: colors.text.primary }}
                >
                  Payment Amount
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
                {/* Quick-fill buttons */}
                <View className="flex-row gap-2 mt-2">
                  {[0.25, 0.5, 0.75, 1].map((fraction) => {
                    const val = Math.round(remaining * fraction);
                    const label =
                      fraction === 1
                        ? "Full"
                        : `${Math.round(fraction * 100)}%`;
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
                            parseFloat(amount) === val
                              ? colors.info
                              : colors.border,
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

              {/* Account */}
              <SearchableSelect
                label="Paid from Account"
                placeholder="Select account"
                value={accountId}
                options={accountOptions}
                onSelect={(v) => setAccountId(v ?? "")}
              />

              {/* Date */}
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

              {/* Description */}
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
          </KeyboardAwareScrollView>

          {/* ── FIXED FOOTER ─────────────────────────────────────────── */}
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 16),
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.bg.primary,
            }}
          >
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={mutation.isPending}
              className="rounded-2xl py-4 items-center"
              style={{
                backgroundColor: isFullPayment ? "#16a34a" : colors.info,
              }}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <View className="flex-row items-center gap-2">
                  <Ionicons
                    name={isFullPayment ? "checkmark-circle" : "cash-outline"}
                    size={20}
                    color="white"
                  />
                  <Text className="text-white font-bold text-base">
                    {isFullPayment
                      ? "Mark as Fully Paid"
                      : "Record Partial Payment"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
