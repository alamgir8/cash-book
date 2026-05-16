import { useState, useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchableSelect } from "../searchable-select";
import { usePreferences } from "@/hooks/use-preferences";
import { useTheme } from "@/hooks/use-theme";
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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
    [accountOptions, fromAccountId],
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
      <View
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      >
        {/* Backdrop dismiss (absolute so sheet is the sole flex child) */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            closeModal();
          }}
          style={{ ...StyleSheet.absoluteFillObject }}
        />

        {/* Bottom sheet — explicit height so KeyboardAwareScrollView can flex:1 */}
        <View
          style={{
            height: Dimensions.get("window").height * 0.88,
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
            <View>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: colors.text.primary,
                }}
              >
                Transfer Funds
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.text.secondary,
                  marginTop: 2,
                }}
              >
                Move money between your accounts
              </Text>
            </View>
            <TouchableOpacity
              onPress={closeModal}
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
              <Ionicons name="close" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* ── SCROLLABLE FORM CONTENT ───────────────────────────────── */}
          <KeyboardAwareScrollView
            bottomOffset={Platform.OS === "ios" ? 100 : 120}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
          >
            <View style={{ paddingHorizontal: 24, paddingVertical: 20 }}>
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
                        <Text
                          className="text-sm mt-1"
                          style={{ color: colors.error }}
                        >
                          {fieldState.error.message}
                        </Text>
                      ) : null}
                    </View>
                  )}
                />

                {/* Date */}
                <Controller
                  control={control}
                  name="amount"
                  render={({ field: { value, onChange }, fieldState }) => (
                    <View>
                      <Text
                        className="text-sm font-semibold mb-2"
                        style={{ color: colors.text.primary }}
                      >
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
                        placeholderTextColor={colors.text.tertiary}
                        style={{
                          backgroundColor: colors.bg.tertiary,
                          color: colors.text.primary,
                          borderColor: colors.border,
                        }}
                        className="px-4 py-3 rounded-xl border text-lg font-semibold"
                      />
                      {fieldState.error ? (
                        <Text
                          className="text-sm mt-1"
                          style={{ color: colors.error }}
                        >
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
                      <Text
                        className="text-sm font-semibold mb-2"
                        style={{ color: colors.text.primary }}
                      >
                        Date
                      </Text>
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
                        placeholder="What is this transfer for?"
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

                {/* Transfer Preview */}
                {transferAmount > 0 ? (
                  <View
                    className="rounded-xl p-3 border"
                    style={{
                      backgroundColor: colors.success + "15",
                      borderColor: colors.success + "40",
                    }}
                  >
                    <Text
                      className="text-sm font-medium text-center"
                      style={{ color: colors.success }}
                    >
                      🔄 Transfer Preview: {formatAmount(transferAmount)}
                    </Text>
                  </View>
                ) : null}
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
              onPress={handleSubmit(handleFormSubmit)}
              disabled={isSubmitting}
              className="rounded-2xl py-4 items-center shadow-lg"
              style={{ backgroundColor: colors.info }}
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
    </Modal>
  );
};
