import { useState, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { SearchableSelect } from "../searchable-select";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import {
  transactionSchema,
  type TransactionFormValues,
  type SelectOption,
} from "./types";
import type { Transaction } from "@/services/transactions";

type TransactionModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
  editingTransaction?: Transaction | null;
  accountOptions: SelectOption[];
  categoryOptions: SelectOption[];
  counterpartyOptions?: SelectOption[];
  isAccountsLoading?: boolean;
  isCategoriesLoading?: boolean;
  isSubmitting?: boolean;
};

export const TransactionModal = ({
  visible,
  onClose,
  onSubmit,
  editingTransaction,
  accountOptions,
  categoryOptions,
  counterpartyOptions = [],
  isAccountsLoading = false,
  isCategoriesLoading = false,
  isSubmitting = false,
}: TransactionModalProps) => {
  const { formatAmount } = usePreferences();
  const { colors } = useTheme();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      accountId: "",
      amount: 0,
      type: "debit",
      date: dayjs().format("YYYY-MM-DD"),
      description: "",
      comment: "",
      categoryId: "",
      counterparty: "",
    },
  });

  const currentAmount = watch("amount");
  const selectedType = watch("type");
  const selectedCategoryId = watch("categoryId");

  // Filter categories based on selected transaction type (debit/credit)
  const filteredCategoryOptions = useMemo(() => {
    const targetFlow = selectedType === "credit" ? "credit" : "debit";
    return categoryOptions.filter(
      (option) => option.value === "" || option.flow === targetFlow,
    );
  }, [categoryOptions, selectedType]);

  // Reset form when opening/closing or when editing transaction changes
  useEffect(() => {
    if (visible) {
      if (editingTransaction) {
        reset({
          accountId: editingTransaction.account._id,
          amount: editingTransaction.amount,
          type: editingTransaction.type,
          date: dayjs(editingTransaction.date).format("YYYY-MM-DD"),
          description: editingTransaction.description || "",
          comment: editingTransaction.keyword || "",
          categoryId: editingTransaction.category?._id || "",
          counterparty: editingTransaction.counterparty || "",
        });
        setSelectedDate(new Date(editingTransaction.date));
      } else {
        reset({
          accountId: "",
          amount: 0,
          type: "debit",
          date: dayjs().format("YYYY-MM-DD"),
          description: "",
          comment: "",
          categoryId: "",
          counterparty: "",
        });
        setSelectedDate(new Date());
      }
    }
  }, [visible, editingTransaction, reset]);

  // Clear category if it doesn't match the current flow type
  useEffect(() => {
    if (!selectedCategoryId) return;
    const match = categoryOptions.find((c) => c.value === selectedCategoryId);
    if (match && match.flow) {
      const targetFlow = selectedType === "credit" ? "credit" : "debit";
      if (match.flow !== targetFlow) {
        setValue("categoryId", "");
      }
    }
  }, [categoryOptions, selectedCategoryId, selectedType, setValue]);

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      setValue("date", dayjs(date).format("YYYY-MM-DD"), {
        shouldValidate: true,
      });
    }
  };

  const handleFormSubmit = async (values: TransactionFormValues) => {
    await onSubmit(values);
  };

  const closeModal = () => {
    setShowDatePicker(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <View
            className="rounded-t-3xl flex-1"
            style={{ maxHeight: "92%", backgroundColor: colors.bg.primary }}
          >
            {/* Header */}
            <View
              className="flex-row justify-between items-center p-6 pb-4 border-b"
              style={{ borderColor: colors.border }}
            >
              <View>
                <Text
                  className="text-xl font-bold"
                  style={{ color: colors.text.primary }}
                >
                  {editingTransaction ? "Edit Transaction" : "New Transaction"}
                </Text>
                <Text
                  className="text-sm"
                  style={{ color: colors.text.secondary }}
                >
                  {editingTransaction
                    ? "Update transaction details"
                    : "Record your debit or credit"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={closeModal}
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.bg.tertiary }}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>
            </View>

            {/* Form Content */}
            <ScrollView
              className="flex-1 px-6 py-4"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <View className="gap-5">
                {/* Account Selection */}
                <Controller
                  control={control}
                  name="accountId"
                  render={({ field: { value, onChange }, fieldState }) => (
                    <View className="gap-2">
                      <SearchableSelect
                        label="Account"
                        placeholder={
                          isAccountsLoading
                            ? "Loading accounts..."
                            : accountOptions.length > 0
                              ? "Select source account"
                              : "No accounts available"
                        }
                        value={value}
                        options={accountOptions}
                        onSelect={(val) => onChange(val || undefined)}
                        disabled={
                          isAccountsLoading || accountOptions.length === 0
                        }
                      />
                      {fieldState.error ? (
                        <Text
                          className="text-sm"
                          style={{ color: colors.error }}
                        >
                          {fieldState.error.message}
                        </Text>
                      ) : null}
                    </View>
                  )}
                />

                {/* Category Selection */}
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field: { value, onChange } }) => (
                    <View className="gap-2">
                      <SearchableSelect
                        label="Category"
                        placeholder={
                          isCategoriesLoading
                            ? "Loading categories..."
                            : filteredCategoryOptions.length > 0
                              ? "Select category"
                              : "No categories available"
                        }
                        value={value}
                        options={filteredCategoryOptions}
                        onSelect={(val) => onChange(val || undefined)}
                        disabled={
                          isCategoriesLoading ||
                          filteredCategoryOptions.length === 0
                        }
                      />
                      {errors.categoryId ? (
                        <Text
                          className="text-sm"
                          style={{ color: colors.error }}
                        >
                          {errors.categoryId.message}
                        </Text>
                      ) : null}
                    </View>
                  )}
                />

                {/* Amount and Type Row */}
                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <Text
                      className="text-sm font-semibold mb-2"
                      style={{ color: colors.text.primary }}
                    >
                      Amount
                    </Text>
                    <Controller
                      control={control}
                      name="amount"
                      render={({ field: { onChange, value } }) => (
                        <TextInput
                          value={String(value || "")}
                          onChangeText={(text) =>
                            onChange(Number(text.replace(/[^0-9.]/g, "")) || 0)
                          }
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={colors.text.tertiary}
                          style={{
                            backgroundColor: colors.bg.tertiary,
                            color: colors.text.primary,
                            borderColor: colors.border,
                          }}
                          className="px-4 py-3 rounded-xl border text-lg font-semibold"
                        />
                      )}
                    />
                    {errors.amount ? (
                      <Text
                        className="text-sm mt-1"
                        style={{ color: colors.error }}
                      >
                        {errors.amount.message}
                      </Text>
                    ) : null}
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-sm font-semibold mb-2"
                      style={{ color: colors.text.primary }}
                    >
                      Type
                    </Text>
                    <Controller
                      control={control}
                      name="type"
                      render={({ field: { value, onChange } }) => (
                        <View className="flex-row gap-2">
                          {(["debit", "credit"] as const).map((option) => (
                            <TouchableOpacity
                              key={option}
                              onPress={() => onChange(option)}
                              className="flex-1 py-3 rounded-xl border-2"
                              style={{
                                backgroundColor:
                                  value === option
                                    ? option === "debit"
                                      ? colors.error + "15"
                                      : colors.success + "15"
                                    : colors.bg.tertiary,
                                borderColor:
                                  value === option
                                    ? option === "debit"
                                      ? colors.error
                                      : colors.success
                                    : colors.border,
                              }}
                            >
                              <Text
                                className="text-center font-semibold text-sm"
                                style={{
                                  color:
                                    value === option
                                      ? option === "debit"
                                        ? colors.error
                                        : colors.success
                                      : colors.text.secondary,
                                }}
                              >
                                {option.toUpperCase()}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    />
                  </View>
                </View>

                {/* Date */}
                <View>
                  <Text
                    className="text-sm font-semibold mb-2"
                    style={{ color: colors.text.primary }}
                  >
                    Date
                  </Text>
                  <Controller
                    control={control}
                    name="date"
                    render={({ field: { value } }) => (
                      <View>
                        <TouchableOpacity
                          onPress={() => setShowDatePicker(true)}
                          style={{
                            backgroundColor: colors.bg.tertiary,
                            borderColor: colors.border,
                          }}
                          className="px-4 py-3 rounded-xl border flex-row items-center justify-between"
                        >
                          <Text
                            className="text-base"
                            style={{ color: colors.text.primary }}
                          >
                            {value
                              ? dayjs(value).format("MMM DD, YYYY")
                              : "Select Date"}
                          </Text>
                          <Ionicons
                            name="calendar-outline"
                            size={20}
                            color={colors.text.secondary}
                          />
                        </TouchableOpacity>

                        {showDatePicker && (
                          <DateTimePicker
                            value={selectedDate}
                            mode="date"
                            display={
                              Platform.OS === "ios" ? "compact" : "default"
                            }
                            onChange={handleDateChange}
                            maximumDate={new Date()}
                          />
                        )}
                      </View>
                    )}
                  />
                </View>

                {/* Description */}
                <View>
                  <Text
                    className="text-sm font-semibold mb-2"
                    style={{ color: colors.text.primary }}
                  >
                    Description
                  </Text>
                  <Controller
                    control={control}
                    name="description"
                    render={({ field: { value, onChange } }) => (
                      <TextInput
                        value={value || ""}
                        onChangeText={onChange}
                        placeholder="What is this transaction about?"
                        placeholderTextColor={colors.text.tertiary}
                        style={{
                          backgroundColor: colors.bg.tertiary,
                          color: colors.text.primary,
                          borderColor: colors.border,
                        }}
                        className="px-4 py-3 rounded-xl border"
                      />
                    )}
                  />
                </View>

                {/* Counterparty Field */}
                <View>
                  <Text
                    className="text-sm font-semibold mb-2"
                    style={{ color: colors.text.primary }}
                  >
                    Counterparty
                  </Text>
                  <Controller
                    control={control}
                    name="counterparty"
                    render={({ field: { value, onChange } }) => (
                      <SearchableSelect
                        value={value || ""}
                        placeholder="Select or add counterparty"
                        options={counterpartyOptions}
                        onSelect={(selectedValue) => onChange(selectedValue)}
                        allowCustomValue={true}
                        customDisplayValue={value || ""}
                      />
                    )}
                  />
                </View>

                {/* Additional Notes */}
                <View>
                  <Text
                    className="text-sm font-semibold mb-2"
                    style={{ color: colors.text.primary }}
                  >
                    Additional Notes
                  </Text>
                  <Controller
                    control={control}
                    name="comment"
                    render={({ field: { value, onChange } }) => (
                      <TextInput
                        value={value || ""}
                        onChangeText={onChange}
                        placeholder="Any additional details..."
                        placeholderTextColor={colors.text.tertiary}
                        style={{
                          backgroundColor: colors.bg.tertiary,
                          color: colors.text.primary,
                          borderColor: colors.border,
                        }}
                        className="px-4 py-3 rounded-xl border min-h-[80px]"
                        multiline
                        textAlignVertical="top"
                      />
                    )}
                  />
                </View>

                {/* Amount Preview */}
                {currentAmount > 0 ? (
                  <View className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                    <Text className="text-blue-700 text-sm font-medium text-center">
                      💰 Amount Preview: {formatAmount(currentAmount)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            {/* Submit Button - Fixed at bottom */}
            <View
              className="p-6 pt-4 pb-8 border-t"
              style={{ borderColor: colors.border }}
            >
              <TouchableOpacity
                onPress={handleSubmit(handleFormSubmit)}
                disabled={isSubmitting}
                className="rounded-2xl py-4 items-center shadow-lg"
                style={{ backgroundColor: colors.info }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="checkmark-circle" size={20} color="white" />
                    <Text className="text-white font-bold text-base">
                      {editingTransaction
                        ? "Update Transaction"
                        : "Save Transaction"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
