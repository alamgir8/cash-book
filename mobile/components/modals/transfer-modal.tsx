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
  transferSchema,
  type TransferFormValues,
  type SelectOption,
} from "./types";

type TransferModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: TransferFormValues) => Promise<void>;
  accountOptions: SelectOption[];
  counterpartyOptions?: SelectOption[];
  isAccountsLoading?: boolean;
  isSubmitting?: boolean;
};

const createTransferDefaults = (): TransferFormValues => ({
  fromAccountId: "",
  toAccountId: "",
  amount: 0,
  date: dayjs().format("YYYY-MM-DD"),
  description: "",
  comment: "",
  counterparty: "",
});

export const TransferModal = ({
  visible,
  onClose,
  onSubmit,
  accountOptions,
  counterpartyOptions = [],
  isAccountsLoading = false,
  isSubmitting = false,
}: TransferModalProps) => {
  const { formatAmount } = usePreferences();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { control, handleSubmit, reset, setValue, watch } =
    useForm<TransferFormValues>({
      resolver: zodResolver(transferSchema),
      defaultValues: createTransferDefaults(),
    });

  const transferAmount = watch("amount");
  const fromAccountId = watch("fromAccountId");

  // Filter destination accounts (exclude source account)
  const destinationAccountOptions = useMemo(
    () => accountOptions.filter((option) => option.value !== fromAccountId),
    [accountOptions, fromAccountId]
  );

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      reset(createTransferDefaults());
      setSelectedDate(new Date());
    }
  }, [visible, reset]);

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      setValue("date", dayjs(date).format("YYYY-MM-DD"), {
        shouldValidate: true,
      });
    }
  };

  const handleFormSubmit = async (values: TransferFormValues) => {
    await onSubmit(values);
  };

  const closeModal = () => {
    setShowDatePicker(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={closeModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View
            className="bg-white rounded-t-3xl flex-1"
            style={{ maxHeight: "90%" }}
          >
            {/* Header */}
            <View className="flex-row justify-between items-center p-6 pb-4 border-b border-gray-100">
              <View>
                <Text className="text-gray-900 text-xl font-bold">
                  Transfer Funds
                </Text>
                <Text className="text-gray-500 text-sm">
                  Move money between your accounts
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
                {/* From Account */}
                <Controller
                  control={control}
                  name="fromAccountId"
                  render={({ field: { value, onChange }, fieldState }) => (
                    <View className="gap-2">
                      <SearchableSelect
                        label="From Account"
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

                {/* To Account */}
                <Controller
                  control={control}
                  name="toAccountId"
                  render={({ field: { value, onChange }, fieldState }) => (
                    <View className="gap-2">
                      <SearchableSelect
                        label="To Account"
                        placeholder={
                          isAccountsLoading
                            ? "Loading accounts..."
                            : destinationAccountOptions.length > 0
                            ? "Select destination account"
                            : "No destination accounts available"
                        }
                        value={value}
                        options={destinationAccountOptions}
                        onSelect={(val) => onChange(val || undefined)}
                        disabled={
                          isAccountsLoading ||
                          destinationAccountOptions.length === 0
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

                {/* Amount */}
                <Controller
                  control={control}
                  name="amount"
                  render={({ field: { value, onChange }, fieldState }) => (
                    <View>
                      <Text className="text-gray-700 text-sm font-semibold mb-2">
                        Amount
                      </Text>
                      <TextInput
                        value={
                          value === undefined || value === null
                            ? ""
                            : String(value)
                        }
                        onChangeText={(text) =>
                          onChange(Number(text.replace(/[^0-9.]/g, "")) || 0)
                        }
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#9ca3af"
                        className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200 text-lg font-semibold"
                      />
                      {fieldState.error ? (
                        <Text className="text-red-500 text-sm mt-1">
                          {fieldState.error.message}
                        </Text>
                      ) : null}
                    </View>
                  )}
                />

                {/* Date */}
                <Controller
                  control={control}
                  name="date"
                  render={({ field: { value } }) => (
                    <View>
                      <Text className="text-gray-700 text-sm font-semibold mb-2">
                        Date
                      </Text>
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

                {/* Description */}
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
                        placeholder="What is this transfer for?"
                        placeholderTextColor="#9ca3af"
                        className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200"
                      />
                    )}
                  />
                </View>

                {/* Counterparty */}
                <Controller
                  control={control}
                  name="counterparty"
                  render={({ field: { value, onChange } }) => (
                    <SearchableSelect
                      label="Counterparty"
                      placeholder="Select or add counterparty"
                      value={value || ""}
                      options={counterpartyOptions}
                      onSelect={(val) => onChange(val || "")}
                      allowCustomValue={true}
                      customDisplayValue={value || ""}
                    />
                  )}
                />

                {/* Comment */}
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

                {/* Transfer Preview */}
                {transferAmount > 0 ? (
                  <View className="bg-green-50 rounded-xl p-3 border border-green-100">
                    <Text className="text-green-700 text-sm font-medium text-center">
                      🔄 Transfer Preview: {formatAmount(transferAmount)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            {/* Submit Button */}
            <View className="p-6 pt-4 pb-8 border-t border-gray-100">
              <TouchableOpacity
                onPress={handleSubmit(handleFormSubmit)}
                disabled={isSubmitting}
                className="bg-indigo-500 rounded-2xl py-4 items-center shadow-lg shadow-indigo-500/25"
                style={{
                  shadowColor: "#6366f1",
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
                    <Ionicons name="swap-horizontal" size={20} color="white" />
                    <Text className="text-white font-bold text-base">
                      Submit Transfer
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
