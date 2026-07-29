import { useState, useEffect, useMemo } from "react";
import {
  Alert,
  Image,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import Toast from "react-native-toast-message";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { FormSheetModal } from "@/components/form-sheet-modal";
import { SearchableSelect } from "../searchable-select";
import {
  amountInputProps,
  parseAmountInput,
} from "@/lib/amount-input";
import { usePreferences } from "@/hooks/use-preferences";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";
import {
  transferSchema,
  type TransferFormValues,
  type SelectOption,
} from "./types";
import { uploadAttachments } from "@/services/attachments";
import { fetchCounterparties } from "@/services/transactions";

type TransferModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (
    values: TransferFormValues,
  ) => Promise<{ debit_transaction?: { _id: string } } | void>;
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
  const { t } = useTranslation();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  type StagedFile = { uri: string; name: string; type: string; size?: number };
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const MAX_STAGED = 10;
  const MAX_RAW_MB = 10;

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
      setStagedFiles([]);
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
    const result = await onSubmit(values);
    // Upload staged attachments to the debit transaction created by the transfer
    const debitId =
      result && "debit_transaction" in result
        ? result.debit_transaction?._id
        : undefined;
    if (stagedFiles.length > 0 && debitId) {
      setUploadingAttachments(true);
      try {
        await uploadAttachments(debitId, stagedFiles);
      } catch (uploadErr) {
        const isTooBig =
          (uploadErr as any)?.response?.status === 413 ||
          (uploadErr as any)?.message?.includes("413");
        Toast.show({
          type: "error",
          text1: t("attachmentUploadFailed"),
          text2: isTooBig
            ? t("fileTooLargeMsg")
            : t("transferSavedAttachmentsFailed"),
          visibilityTime: 5000,
        });
      } finally {
        setUploadingAttachments(false);
      }
    }
    closeModal();
  };

  // ── Staged file helpers ─────────────────────────────────────────────────
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

  const closeModal = () => {
    setShowDatePicker(false);
    onClose();
  };

  const submitLabel = stagedFiles.length > 0
    ? t("submitWithAttachments", {
        n: String(stagedFiles.length),
        s: stagedFiles.length > 1 ? "s" : "",
      })
    : t("submitTransfer");

  return (
    <FormSheetModal
      visible={visible}
      onClose={closeModal}
      title={t("transferFundsModal")}
      subtitle={t("moveMoneyBetweenAccounts")}
      submitLabel={submitLabel}
      submitIcon={stagedFiles.length > 0 ? "attach" : "swap-horizontal"}
      onSubmit={handleSubmit(handleFormSubmit)}
      isSubmitting={isSubmitting || uploadingAttachments}
      submittingLabel={
        uploadingAttachments ? t("uploadingAttachments") : t("saving")
      }
    >
              <View className="gap-5">
                {/* From Account */}
                <Controller
                  control={control}
                  name="fromAccountId"
                  render={({ field: { value, onChange }, fieldState }) => (
                    <View className="gap-2">
                      <SearchableSelect
                        label={t("fromAccount")}
                        placeholder={
                          isAccountsLoading
                            ? t("loadingAccountsPlaceholder")
                            : accountOptions.length > 0
                              ? t("selectSourceAccount")
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

                {/* To Account */}
                <Controller
                  control={control}
                  name="toAccountId"
                  render={({ field: { value, onChange }, fieldState }) => (
                    <View className="gap-2">
                      <SearchableSelect
                        label={t("toAccount")}
                        placeholder={
                          isAccountsLoading
                            ? t("loadingAccountsPlaceholder")
                            : destinationAccountOptions.length > 0
                              ? t("selectDestinationAccount")
                              : t("noDestinationAccounts")
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
                        {t("amountLabel")}
                      </Text>
                      <TextInput
                        value={
                          value === undefined || value === null
                            ? ""
                            : String(value)
                        }
                        onChangeText={(text) =>
                          onChange(parseAmountInput(text))
                        }
                        {...amountInputProps}
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
                        {t("dateLabel")}
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
                    {t("descriptionLabel")}
                  </Text>
                  <Controller
                    control={control}
                    name="description"
                    render={({ field: { value, onChange } }) => (
                      <TextInput
                        value={value || ""}
                        onChangeText={onChange}
                        placeholder={t("descriptionTransferPlaceholder")}
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
                      label={t("counterpartyLabel")}
                      placeholder={t("selectOrAddCounterparty")}
                      value={value || ""}
                      options={counterpartyOptions}
                      onSelect={(val) => onChange(val || "")}
                      allowCustomValue={true}
                      customDisplayValue={value || ""}
                      fetchOptions={async (q) => {
                        const res = await fetchCounterparties(q);
                        return res.map((v) => ({ value: v, label: v }));
                      }}
                    />
                  )}
                />

                {/* Comment */}
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
                  <Text
                    className="text-xs mb-3"
                    style={{ color: colors.text.tertiary }}
                  >
                    {t("attachmentsHelpText", {
                      count: String(stagedFiles.length),
                      max: "10",
                    })}
                  </Text>
                  {/* Action buttons */}
                  <View className="flex-row gap-2 mb-3">
                    {(
                      [
                        {
                          icon: "scan-outline",
                          label: t("scan"),
                          handler: handleStagedScan,
                        },
                        {
                          icon: "camera-outline",
                          label: t("photo"),
                          handler: handleStagedCamera,
                        },
                        {
                          icon: "images-outline",
                          label: t("gallery"),
                          handler: handleStagedGallery,
                        },
                        {
                          icon: "document-outline",
                          label: t("pdf"),
                          handler: handleStagedDocument,
                        },
                      ] as const
                    ).map(({ icon, label, handler }) => (
                      <TouchableOpacity
                        key={label}
                        onPress={handler}
                        disabled={stagedFiles.length >= MAX_STAGED}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.bg.tertiary,
                          alignItems: "center",
                          gap: 4,
                          opacity: stagedFiles.length >= MAX_STAGED ? 0.4 : 1,
                        }}
                      >
                        <Ionicons
                          name={icon}
                          size={20}
                          color={colors.text.secondary}
                        />
                        <Text
                          style={{ fontSize: 11, color: colors.text.secondary }}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* Staged file previews */}
                  {stagedFiles.length > 0 && (
                    <View className="flex-row flex-wrap gap-2">
                      {stagedFiles.map((file, idx) => (
                        <View
                          key={idx}
                          style={{
                            width: 72,
                            height: 72,
                            borderRadius: 8,
                            overflow: "hidden",
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.bg.tertiary,
                          }}
                        >
                          {file.type.startsWith("image") ? (
                            <Image
                              source={{ uri: file.uri }}
                              style={{ width: "100%", height: "100%" }}
                              resizeMode="cover"
                            />
                          ) : (
                            <View
                              style={{
                                flex: 1,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Ionicons
                                name="document-text"
                                size={28}
                                color={colors.text.tertiary}
                              />
                            </View>
                          )}
                          <TouchableOpacity
                            onPress={() =>
                              setStagedFiles((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                            style={{
                              position: "absolute",
                              top: 2,
                              right: 2,
                              backgroundColor: "rgba(0,0,0,0.55)",
                              borderRadius: 10,
                            }}
                          >
                            <Ionicons name="close" size={16} color="white" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
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
                      {t("transferPreview")} {formatAmount(transferAmount)}
                    </Text>
                  </View>
                ) : null}
              </View>
    </FormSheetModal>
  );
};
