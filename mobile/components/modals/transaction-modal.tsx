import { useState, useEffect, useMemo, useRef } from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
  Dimensions,
} from "react-native";
import {
  KeyboardAwareScrollView,
  useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchableSelect } from "../searchable-select";
import { usePreferences } from "@/hooks/use-preferences";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";
import {
  transactionSchema,
  type TransactionFormValues,
  type SelectOption,
} from "./types";
import type { Transaction } from "@/services/transactions";
import { fetchVendors } from "@/services/transactions";
import { uploadAttachments } from "@/services/attachments";
import { AttachmentPicker } from "../transactions/attachment-picker";

type TransactionModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: TransactionFormValues) => Promise<{ _id: string } | void>;
  editingTransaction?: Transaction | null;
  accountOptions: SelectOption[];
  categoryOptions: SelectOption[];
  counterpartyOptions?: SelectOption[];
  vendorOptions?: SelectOption[];
  partyOptions?: SelectOption[];
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
  vendorOptions = [],
  partyOptions = [],
  isAccountsLoading = false,
  isCategoriesLoading = false,
  isSubmitting = false,
}: TransactionModalProps) => {
  const { formatAmount } = usePreferences();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [pickingDueDate, setPickingDueDate] = useState(false);
  // Staged files picked before saving (new transactions only)
  type StagedFile = { uri: string; name: string; type: string; size?: number };
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const MAX_STAGED = 10;
  const MAX_RAW_MB = 10;

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
      party: "",
      for_party: "",
      payment_status: "paid",
      due_date: "",
    },
  });

  const currentAmount = watch("amount");
  const selectedType = watch("type");
  const selectedCategoryId = watch("categoryId");
  const paymentStatus = watch("payment_status");
  const selectedVendor = watch("party");
  const selectedForParty = watch("for_party");

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
          party: editingTransaction.party?._id || "",
          for_party: editingTransaction.for_party?._id || "",
          payment_status: editingTransaction.payment_status || "paid",
          due_date: editingTransaction.due_date
            ? dayjs(editingTransaction.due_date).format("YYYY-MM-DD")
            : "",
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
          party: "",
          for_party: "",
          payment_status: "paid",
          due_date: "",
        });
        setSelectedDate(new Date());
        setStagedFiles([]);
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
      if (pickingDueDate) {
        setValue("due_date", dayjs(date).format("YYYY-MM-DD"), {
          shouldValidate: true,
        });
      } else {
        setSelectedDate(date);
        setValue("date", dayjs(date).format("YYYY-MM-DD"), {
          shouldValidate: true,
        });
      }
    }
    setPickingDueDate(false);
  };

  const handleFormSubmit = async (values: TransactionFormValues) => {
    const result = await onSubmit(values);
    if (result && "_id" in result && !editingTransaction) {
      // Upload any staged files right after creation
      if (stagedFiles.length > 0) {
        setUploadingAttachments(true);
        try {
          await uploadAttachments(result._id, stagedFiles);
        } catch (uploadErr) {
          const isTooBig =
            (uploadErr as any)?.response?.status === 413 ||
            (uploadErr as any)?.message?.includes("413");
          Toast.show({
            type: "error",
            text1: t("attachmentUploadFailed"),
            text2: isTooBig
              ? t("fileTooLargeMsg")
              : t("transactionSavedAttachmentsFailed"),
            visibilityTime: 5000,
          });
        } finally {
          setUploadingAttachments(false);
        }
      }
      closeModal();
    } else if (editingTransaction) {
      closeModal();
    }
  };

  // ── Staged file helpers (new transactions only) ────────────────────────
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("permissionRequired"), t("cameraPermissionNeeded"));
      return false;
    }
    return true;
  };

  const requestMediaPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("permissionRequired"), t("photoLibraryPermissionNeeded"));
      return false;
    }
    return true;
  };

  const mapAsset = (asset: ImagePicker.ImagePickerAsset): StagedFile => ({
    uri: asset.uri,
    name: asset.fileName ?? `photo_${Date.now()}.jpg`,
    type: asset.mimeType ?? "image/jpeg",
    size: asset.fileSize,
  });

  const addStaged = (files: StagedFile[]) => {
    for (const f of files) {
      if (f.size && f.size > MAX_RAW_MB * 1024 * 1024) {
        Alert.alert(
          t("fileTooLargeAlert"),
          `"${f.name}" exceeds ${MAX_RAW_MB} MB.`,
        );
        return;
      }
    }
    setStagedFiles((prev) => [...prev, ...files].slice(0, MAX_STAGED));
  };

  const handleStagedScan = async () => {
    if (!(await requestCameraPermission())) return;
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsEditing: true,
      exif: false,
    });
    if (!r.canceled && r.assets[0]) addStaged([mapAsset(r.assets[0])]);
  };

  const handleStagedCamera = async () => {
    if (!(await requestCameraPermission())) return;
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: false,
      exif: false,
    });
    if (!r.canceled && r.assets[0]) addStaged([mapAsset(r.assets[0])]);
  };

  const handleStagedGallery = async () => {
    if (!(await requestMediaPermission())) return;
    const remaining = MAX_STAGED - stagedFiles.length;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
      exif: false,
    });
    if (!r.canceled && r.assets.length) addStaged(r.assets.map(mapAsset));
  };

  const handleStagedDocument = async () => {
    const r = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!r.canceled && r.assets[0]) {
      const a = r.assets[0];
      addStaged([
        {
          uri: a.uri,
          name: a.name,
          type: a.mimeType ?? "application/pdf",
          size: a.size,
        },
      ]);
    }
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const closeModal = () => {
    setShowDatePicker(false);
    onClose();
  };

  const screenHeight = Dimensions.get("window").height;
  const { height: kbHeight } = useReanimatedKeyboardAnimation();
  const sheetAnimStyle = useAnimatedStyle(() => ({
    // kbHeight is negative when keyboard is open; negate it for paddingBottom
    paddingBottom: -kbHeight.value,
  }));

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      >
        {/* Backdrop — tap to dismiss (absolute so it doesn't compete for flex space) */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            closeModal();
          }}
          style={{ ...StyleSheet.absoluteFillObject }}
        />

        {/* Bottom sheet — explicit height so KeyboardAwareScrollView can flex:1 */}
        <Animated.View
          style={[
            {
              height: screenHeight * 0.88,
              backgroundColor: colors.bg.primary,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              // shadow for iOS elevation
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.12,
              shadowRadius: 16,
              elevation: 24,
            },
            sheetAnimStyle,
          ]}
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
                {editingTransaction
                  ? t("editTransaction")
                  : t("newTransaction")}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.text.secondary,
                  marginTop: 2,
                }}
              >
                {editingTransaction
                  ? t("updateTransactionDetails")
                  : t("recordDebitOrCredit")}
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
                {/* Account Selection */}
                <Controller
                  control={control}
                  name="accountId"
                  render={({ field: { value, onChange }, fieldState }) => (
                    <View className="gap-2">
                      <SearchableSelect
                        label={t("accountFilter")}
                        placeholder={
                          isAccountsLoading
                            ? t("loadingAccountsPlaceholder")
                            : accountOptions.length > 0
                              ? t("selectAccount")
                              : t("noAccountsAvailablePlaceholder")
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
                        label={t("categoryFilter")}
                        placeholder={
                          isCategoriesLoading
                            ? t("loadingCategoriesPlaceholder")
                            : filteredCategoryOptions.length > 0
                              ? t("selectCategory")
                              : t("noCategoriesAvailable")
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
                      {t("amountLabel")}
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
                      {t("transactionType")}
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
                    {t("dateLabel")}
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
                              : t("selectDate")}
                          </Text>
                          <Ionicons
                            name="calendar-outline"
                            size={20}
                            color={colors.text.secondary}
                          />
                        </TouchableOpacity>

                        {showDatePicker && (
                          <DateTimePicker
                            value={
                              pickingDueDate
                                ? watch("due_date")
                                  ? new Date(watch("due_date")!)
                                  : new Date()
                                : selectedDate
                            }
                            mode="date"
                            display={
                              Platform.OS === "ios" ? "compact" : "default"
                            }
                            onChange={handleDateChange}
                            maximumDate={
                              pickingDueDate ? undefined : new Date()
                            }
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
                    {t("descriptionLabel")}
                  </Text>
                  <Controller
                    control={control}
                    name="description"
                    render={({ field: { value, onChange } }) => (
                      <TextInput
                        value={value || ""}
                        onChangeText={onChange}
                        placeholder={t("descriptionPlaceholder")}
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

                {/* Vendor / Supplier */}
                <View>
                  <Text
                    className="text-sm font-semibold mb-1"
                    style={{ color: colors.text.primary }}
                  >
                    {t("vendorLabel") ?? "Vendor / Supplier"}
                  </Text>
                  <Text
                    className="text-xs mb-2"
                    style={{ color: colors.text.tertiary }}
                  >
                    {t("vendorHelpText") ?? "Who you bought from / sold to"}
                  </Text>
                  <Controller
                    control={control}
                    name="party"
                    render={({ field: { value, onChange } }) => {
                      // Exclude the party already selected as beneficiary
                      const vendorOpts = (
                        partyOptions.length > 0 ? partyOptions : vendorOptions
                      ).filter((p) => p.value !== selectedForParty);
                      return (
                        <SearchableSelect
                          value={value || ""}
                          placeholder={
                            t("selectOrAddVendor") ?? "Select vendor"
                          }
                          options={vendorOpts}
                          onSelect={(selectedValue) =>
                            onChange(selectedValue || "")
                          }
                          allowCustomValue={false}
                          customDisplayValue={
                            (partyOptions.length > 0
                              ? partyOptions
                              : vendorOptions
                            ).find((p) => p.value === value)?.label ||
                            (typeof editingTransaction?.party === "object"
                              ? editingTransaction?.party?.name
                              : undefined) ||
                            ""
                          }
                          fetchOptions={async (q) => {
                            const res = await fetchVendors(q);
                            return res
                              .filter((v) => v._id !== selectedForParty)
                              .map((v) => ({ value: v._id, label: v.name }));
                          }}
                        />
                      );
                    }}
                  />
                </View>

                {/* For / Beneficiary */}
                <View>
                  <Text
                    className="text-sm font-semibold mb-1"
                    style={{ color: colors.text.primary }}
                  >
                    {t("counterpartyLabel") ?? "For / Beneficiary"}
                  </Text>
                  <Text
                    className="text-xs mb-2"
                    style={{ color: colors.text.tertiary }}
                  >
                    {t("counterpartyHelpText") ??
                      "Who this expense/income is on behalf of"}
                  </Text>
                  <Controller
                    control={control}
                    name="for_party"
                    render={({ field: { value, onChange } }) => {
                      // Exclude the party already selected as vendor
                      const forOpts = (
                        partyOptions.length > 0 ? partyOptions : vendorOptions
                      ).filter((p) => p.value !== selectedVendor);
                      return (
                        <SearchableSelect
                          value={value || ""}
                          placeholder={
                            t("selectOrAddCounterparty") ?? "Select beneficiary"
                          }
                          options={forOpts}
                          onSelect={(selectedValue) =>
                            onChange(selectedValue || "")
                          }
                          allowCustomValue={false}
                          customDisplayValue={
                            (partyOptions.length > 0
                              ? partyOptions
                              : vendorOptions
                            ).find((p) => p.value === value)?.label ||
                            (typeof editingTransaction?.for_party === "object"
                              ? editingTransaction?.for_party?.name
                              : undefined) ||
                            ""
                          }
                          fetchOptions={async (q) => {
                            const res = await fetchVendors(q);
                            return res
                              .filter((v) => v._id !== selectedVendor)
                              .map((v) => ({ value: v._id, label: v.name }));
                          }}
                        />
                      );
                    }}
                  />
                </View>

                {/* Payment Mode */}
                <View>
                  <Text
                    className="text-sm font-semibold mb-2"
                    style={{ color: colors.text.primary }}
                  >
                    {t("paymentMode")}
                  </Text>
                  <Controller
                    control={control}
                    name="payment_status"
                    render={({ field: { value, onChange } }) => (
                      <View
                        className="flex-row rounded-xl overflow-hidden border"
                        style={{ borderColor: colors.border, height: 52 }}
                      >
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => onChange("paid")}
                          className="flex-1 flex-row items-center justify-center gap-2"
                          style={{
                            backgroundColor:
                              value === "paid" ? "#16a34a" : "transparent",
                          }}
                        >
                          <Ionicons
                            name="cash-outline"
                            size={18}
                            color={
                              value === "paid" ? "#fff" : colors.text.tertiary
                            }
                          />
                          <Text
                            className="font-bold text-sm"
                            style={{
                              color:
                                value === "paid"
                                  ? "#fff"
                                  : colors.text.secondary,
                            }}
                          >
                            {t("cashPaid")}
                          </Text>
                        </TouchableOpacity>

                        <View
                          style={{
                            width: 1,
                            marginVertical: 10,
                            backgroundColor: colors.border,
                          }}
                        />

                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => onChange("due")}
                          className="flex-1 flex-row items-center justify-center gap-2"
                          style={{
                            backgroundColor:
                              value === "due" ? "#d97706" : "transparent",
                          }}
                        >
                          <Ionicons
                            name="time-outline"
                            size={18}
                            color={
                              value === "due" ? "#fff" : colors.text.tertiary
                            }
                          />
                          <Text
                            className="font-bold text-sm"
                            style={{
                              color:
                                value === "due"
                                  ? "#fff"
                                  : colors.text.secondary,
                            }}
                          >
                            {t("dueUnpaid")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  />
                  {paymentStatus === "due" && (
                    <View
                      className="mt-2 px-3 py-2 rounded-xl flex-row items-center gap-2"
                      style={{
                        backgroundColor: "#d97706" + "15",
                        borderWidth: 1,
                        borderColor: "#d97706" + "40",
                      }}
                    >
                      <Ionicons
                        name="warning-outline"
                        size={16}
                        color="#d97706"
                      />
                      <Text
                        className="text-xs flex-1"
                        style={{ color: "#d97706" }}
                      >
                        {t("dueWarning")}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Due Date (shown only when payment_status = due) */}
                {paymentStatus === "due" && (
                  <View>
                    <Text
                      className="text-sm font-semibold mb-2"
                      style={{ color: colors.text.primary }}
                    >
                      {t("dueDateOptional")}
                    </Text>
                    <Controller
                      control={control}
                      name="due_date"
                      render={({ field: { value, onChange } }) => (
                        <TouchableOpacity
                          onPress={() => {
                            // Reuse the date picker — flag which field we’re picking
                            setPickingDueDate(true);
                            setShowDatePicker(true);
                          }}
                          style={{
                            backgroundColor: colors.bg.tertiary,
                            borderColor: colors.border,
                          }}
                          className="px-4 py-3 rounded-xl border flex-row items-center justify-between"
                        >
                          <Text
                            className="text-base"
                            style={{
                              color: value
                                ? colors.text.primary
                                : colors.text.tertiary,
                            }}
                          >
                            {value
                              ? dayjs(value).format("MMM DD, YYYY")
                              : t("selectDueDate")}
                          </Text>
                          <Ionicons
                            name="calendar-outline"
                            size={20}
                            color={colors.text.secondary}
                          />
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                )}

                {/* Additional Notes */}
                <View>
                  <Text
                    className="text-sm font-semibold mb-2"
                    style={{ color: colors.text.primary }}
                  >
                    {t("additionalNotes")}
                  </Text>
                  <Controller
                    control={control}
                    name="comment"
                    render={({ field: { value, onChange } }) => (
                      <TextInput
                        value={value || ""}
                        onChangeText={onChange}
                        placeholder={t("additionalDetailsPlaceholder")}
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

                {/* Attachments */}
                <View>
                  <Text
                    className="text-sm font-semibold mb-2"
                    style={{ color: colors.text.primary }}
                  >
                    {t("attachments")}
                  </Text>

                  {editingTransaction ? (
                    /* Editing: live upload/delete against existing transaction */
                    <AttachmentPicker
                      transactionId={editingTransaction._id}
                      initialAttachments={editingTransaction.attachments ?? []}
                    />
                  ) : (
                    /* New transaction: stage files locally, upload on save */
                    <View className="gap-3">
                      {/* Staged file thumbnails */}
                      {stagedFiles.length > 0 && (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                        >
                          {stagedFiles.map((f, i) => (
                            <View
                              key={i}
                              className="relative rounded-xl overflow-hidden"
                              style={{
                                width: 80,
                                height: 80,
                                borderWidth: 1,
                                borderColor: colors.border,
                              }}
                            >
                              {f.type.startsWith("image/") ? (
                                <Image
                                  source={{ uri: f.uri }}
                                  style={{ width: 80, height: 80 }}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View
                                  className="w-full h-full items-center justify-center"
                                  style={{
                                    backgroundColor: colors.bg.tertiary,
                                  }}
                                >
                                  <Ionicons
                                    name="document-text"
                                    size={28}
                                    color={colors.info}
                                  />
                                  <Text
                                    style={{ color: colors.text.tertiary }}
                                    className="text-xs mt-1 text-center px-1"
                                    numberOfLines={2}
                                  >
                                    {f.name}
                                  </Text>
                                </View>
                              )}
                              <TouchableOpacity
                                onPress={() => removeStagedFile(i)}
                                className="absolute top-1 right-1 rounded-full p-0.5"
                                style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
                                hitSlop={{
                                  top: 6,
                                  right: 6,
                                  bottom: 6,
                                  left: 6,
                                }}
                              >
                                <Ionicons name="close" size={14} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </ScrollView>
                      )}

                      {/* Pick buttons */}
                      {stagedFiles.length < MAX_STAGED && (
                        <View className="flex-row gap-2">
                          <TouchableOpacity
                            onPress={handleStagedScan}
                            className="flex-1 flex-row items-center justify-center gap-1.5 py-3 rounded-xl"
                            style={{
                              backgroundColor: colors.info + "20",
                              borderWidth: 1,
                              borderColor: colors.info + "50",
                            }}
                          >
                            <Ionicons
                              name="scan-outline"
                              size={18}
                              color={colors.info}
                            />
                            <Text
                              style={{ color: colors.info }}
                              className="text-sm font-semibold"
                            >
                              {t("scan")}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={handleStagedCamera}
                            className="flex-1 flex-row items-center justify-center gap-1.5 py-3 rounded-xl"
                            style={{
                              backgroundColor: colors.bg.tertiary,
                              borderWidth: 1,
                              borderStyle: "dashed",
                              borderColor: colors.border,
                            }}
                          >
                            <Ionicons
                              name="camera-outline"
                              size={18}
                              color={colors.text.secondary}
                            />
                            <Text
                              style={{ color: colors.text.secondary }}
                              className="text-sm font-medium"
                            >
                              {t("photo")}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={handleStagedGallery}
                            className="flex-1 flex-row items-center justify-center gap-1.5 py-3 rounded-xl"
                            style={{
                              backgroundColor: colors.bg.tertiary,
                              borderWidth: 1,
                              borderStyle: "dashed",
                              borderColor: colors.border,
                            }}
                          >
                            <Ionicons
                              name="images-outline"
                              size={18}
                              color={colors.text.secondary}
                            />
                            <Text
                              style={{ color: colors.text.secondary }}
                              className="text-sm font-medium"
                            >
                              {t("gallery")}
                            </Text>
                          </TouchableOpacity>
                          {Platform.OS !== "web" && (
                            <TouchableOpacity
                              onPress={handleStagedDocument}
                              className="flex-1 flex-row items-center justify-center gap-1.5 py-3 rounded-xl"
                              style={{
                                backgroundColor: colors.bg.tertiary,
                                borderWidth: 1,
                                borderStyle: "dashed",
                                borderColor: colors.border,
                              }}
                            >
                              <Ionicons
                                name="document-outline"
                                size={18}
                                color={colors.text.secondary}
                              />
                              <Text
                                style={{ color: colors.text.secondary }}
                                className="text-sm font-medium"
                              >
                                {t("pdf")}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      <Text
                        style={{ color: colors.text.tertiary }}
                        className="text-xs"
                      >
                        {t("attachmentsHelpText", {
                          count: String(stagedFiles.length),
                          max: String(MAX_STAGED),
                        })}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Amount Preview */}
                {currentAmount > 0 ? (
                  <View
                    className="rounded-xl p-3 border"
                    style={{
                      backgroundColor: colors.info + "15",
                      borderColor: colors.info + "30",
                    }}
                  >
                    <Text
                      className="text-sm font-medium text-center"
                      style={{ color: colors.info }}
                    >
                      {t("amountPreview")} {formatAmount(currentAmount)}
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
              disabled={isSubmitting || uploadingAttachments}
              className="rounded-2xl py-4 items-center shadow-lg"
              style={{ backgroundColor: colors.info }}
            >
              {isSubmitting || uploadingAttachments ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator color="white" />
                  <Text className="text-white font-bold text-base">
                    {uploadingAttachments
                      ? t("uploadingAttachments")
                      : t("saving")}
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center gap-2">
                  <Ionicons
                    name={
                      editingTransaction
                        ? "checkmark-circle"
                        : stagedFiles.length > 0
                          ? "attach"
                          : "checkmark-circle"
                    }
                    size={20}
                    color="white"
                  />
                  <Text className="text-white font-bold text-base">
                    {editingTransaction
                      ? t("updateTransactionBtn")
                      : stagedFiles.length > 0
                        ? t("saveWithAttachments", {
                            n: String(stagedFiles.length),
                            s: stagedFiles.length > 1 ? "s" : "",
                          })
                        : t("saveTransaction")}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};
