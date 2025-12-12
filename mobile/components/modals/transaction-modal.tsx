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
import { usePreferences } from "../../hooks/usePreferences";
import {
  transactionSchema,
  type TransactionFormValues,
  type SelectOption,
} from "./types";
import type { Transaction } from "../../services/transactions";

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
      (option) => option.value === "" || option.flow === targetFlow
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
        <View className="flex-1 bg-black/40 justify-end">
          <View
            className="bg-white rounded-t-3xl flex-1"
            style={{ maxHeight: "92%" }}
          >
            {/* Header */}
            <View className="flex-row justify-between items-center p-6 pb-4 border-b border-gray-100">
              <View>
                <Text className="text-gray-900 text-xl font-bold">
                  {editingTransaction ? "Edit Transaction" : "New Transaction"}
                </Text>
                <Text className="text-gray-500 text-sm">
                  {editingTransaction
                    ? "Update transaction details"
                    : "Record your debit or credit"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={closeModal}
                className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#6b7280" />
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
                        <Text className="text-red-500 text-sm">
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
                        <Text className="text-red-500 text-sm">
                          {errors.categoryId.message}
                        </Text>
                      ) : null}
                    </View>
                  )}
                />

                {/* Amount and Type Row */}
                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <Text className="text-gray-700 text-sm font-semibold mb-2">
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
                          placeholderTextColor="#9ca3af"
                          className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200 text-lg font-semibold"
                        />
                      )}
                    />
                    {errors.amount ? (
                      <Text className="text-red-500 text-sm mt-1">
                        {errors.amount.message}
                      </Text>
                    ) : null}
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-700 text-sm font-semibold mb-2">
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
                              className={`flex-1 py-3 rounded-xl border-2 ${
                                value === option
                                  ? option === "debit"
                                    ? "border-red-500 bg-red-50"
                                    : "border-green-500 bg-green-50"
                                  : "border-gray-200 bg-gray-50"
                              }`}
                            >
                              <Text
                                className={`text-center font-semibold text-sm ${
                                  value === option
                                    ? option === "debit"
                                      ? "text-red-700"
                                      : "text-green-700"
                                    : "text-gray-600"
                                }`}
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

                {/* Date Field */}
                <View>
                  <Text className="text-gray-700 text-sm font-semibold mb-2">
                    Date
                  </Text>
                  <Controller
                    control={control}
                    name="date"
                    render={({ field: { value } }) => (
                      <View>
                        <TouchableOpacity
                          onPress={() => setShowDatePicker(true)}
                          className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200 flex-row items-center justify-between"
                        >
                          <Text className="text-gray-900 text-base">
                            {value
                              ? dayjs(value).format("MMM DD, YYYY")
                              : "Select Date"}
                          </Text>
                          <Ionicons
                            name="calendar-outline"
                            size={20}
                            color="#6b7280"
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

                {/* Description Field */}
                <View>
                  <Text className="text-gray-700 text-sm font-semibold mb-2">
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
                        placeholderTextColor="#9ca3af"
                        className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200"
                      />
                    )}
                  />
                </View>

                {/* Counterparty Field */}
                <View>
                  <Text className="text-gray-700 text-sm font-semibold mb-2">
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

                {/* Comment Field */}
                <View>
                  <Text className="text-gray-700 text-sm font-semibold mb-2">
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
                        placeholderTextColor="#9ca3af"
                        className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200 min-h-[80px]"
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
            <View className="p-6 pt-4 pb-8 border-t border-gray-100">
              <TouchableOpacity
                onPress={handleSubmit(handleFormSubmit)}
                disabled={isSubmitting}
                className="bg-blue-500 rounded-2xl py-4 items-center shadow-lg shadow-blue-500/25"
                style={{
                  shadowColor: "#3b82f6",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 4,
                }}
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
