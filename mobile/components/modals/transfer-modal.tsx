import { useState, useEffect, useMemo, useRef } from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  KeyboardAwareScrollView,
  useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import Toast from "react-native-toast-message";
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
  const insets = useSafeAreaInsets();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  type StagedFile = { uri: string; name: string; type: string; size?: number };
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const MAX_STAGED = 10;
  const MAX_RAW_MB = 10;

  const { height: kbHeight } = useReanimatedKeyboardAnimation();
  const sheetAnimStyle = useAnimatedStyle(() => ({
    paddingBottom: -kbHeight.value,
  }));

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
          text1: "Attachment Upload Failed",
          text2: isTooBig
            ? "File too large. Max 10 MB per file."
            : "Transfer saved, but attachments could not be uploaded.",
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
      Alert.alert("Permission Required", "Camera access is needed.");
      return false;
    }
    return true;
  };

  const requestMediaPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Photo library access is needed.");
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
        Alert.alert("File Too Large", `"${f.name}" exceeds ${MAX_RAW_MB} MB.`);
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
        <Animated.View
          style={[
            {
              height: Dimensions.get("window").height * 0.88,
              backgroundColor: colors.bg.primary,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
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

                {/* Attachments */}
                <View>
                  <Text
                    className="text-sm font-semibold mb-2"
                    style={{ color: colors.text.primary }}
                  >
                    Attachments
                  </Text>
                  <Text
                    className="text-xs mb-3"
                    style={{ color: colors.text.tertiary }}
                  >
                    {stagedFiles.length}/10 files · Images ≤1 MB · PDF ≤1.5 MB ·
                    JPG, PNG, WebP, HEIC, PDF
                  </Text>
                  {/* Action buttons */}
                  <View className="flex-row gap-2 mb-3">
                    {(
                      [
                        {
                          icon: "scan-outline",
                          label: "Scan",
                          handler: handleStagedScan,
                        },
                        {
                          icon: "camera-outline",
                          label: "Photo",
                          handler: handleStagedCamera,
                        },
                        {
                          icon: "images-outline",
                          label: "Gallery",
                          handler: handleStagedGallery,
                        },
                        {
                          icon: "document-outline",
                          label: "PDF",
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
              disabled={isSubmitting || uploadingAttachments}
              className="rounded-2xl py-4 items-center shadow-lg"
              style={{ backgroundColor: colors.info }}
            >
              {isSubmitting || uploadingAttachments ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator color="white" />
                  <Text className="text-white font-bold text-base">
                    {uploadingAttachments
                      ? "Uploading attachments…"
                      : "Saving…"}
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center gap-2">
                  <Ionicons
                    name={stagedFiles.length > 0 ? "attach" : "swap-horizontal"}
                    size={20}
                    color="white"
                  />
                  <Text className="text-white font-bold text-base">
                    {stagedFiles.length > 0
                      ? `Submit with ${stagedFiles.length} attachment${stagedFiles.length > 1 ? "s" : ""}`
                      : "Submit Transfer"}
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
