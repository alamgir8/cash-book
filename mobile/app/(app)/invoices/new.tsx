import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { toast } from "@/lib/toast";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useActiveOrgId } from "@/hooks/use-organization";
import { useCreateInvoice } from "@/hooks/use-invoices";
import type { InvoiceType } from "@/types/invoice";
import { partiesApi } from "@/services/parties";
import { zodResolver } from "@hookform/resolvers/zod";
import { invoiceSchema, type InvoiceFormData } from "@/lib/validations/invoice";
import { LineItemFields, InvoiceTotalsSummary } from "@/components/invoices";
import {
  calculateLineItemTotal,
  calculateInvoiceTotals,
  transformInvoiceFormData,
} from "@/lib/invoice-utils";
import { useTheme } from "@/hooks/use-theme";
import { SearchableSelect } from "@/components/searchable-select";
import type { SelectOption } from "@/components/searchable-select";
import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { uploadAttachments } from "@/services/attachments";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

type StagedFile = { uri: string; name: string; type: string; size?: number };
const MAX_STAGED = 10;
const MAX_RAW_MB = 10;

export default function InvoiceScreen() {
  const { type: typeParam, partyId: partyIdParam } = useLocalSearchParams<{
    type?: string;
    partyId?: string;
  }>();
  const organizationId = useActiveOrgId();
  const { colors } = useTheme();

  const invoiceType: InvoiceType =
    typeParam === "purchase" ? "purchase" : "sale";

  // ── Date picker state ──────────────────────────────────────────────────
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickingField, setPickingField] = useState<"date" | "due_date">("date");

  // ── Attachment state ───────────────────────────────────────────────────
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  const mutation = useCreateInvoice({
    onSuccess: () => router.back(),
  });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      party_id: "",
      date: new Date().toISOString().split("T")[0],
      due_date: "",
      reference: "",
      notes: "",
      discount_type: "percentage",
      discount_value: "",
      items: [
        { description: "", quantity: "1", unit_price: "", tax_rate: "0" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const watchItems = watch("items");
  const watchDiscountType = watch("discount_type");
  const watchDiscountValue = watch("discount_value");
  const watchDate = watch("date");
  const watchDueDate = watch("due_date");

  // Pre-load 50 parties for the dropdown
  const { data: partiesData } = useQuery({
    queryKey: [
      "parties",
      organizationId,
      invoiceType === "sale" ? "customer" : "supplier",
    ],
    queryFn: () =>
      partiesApi.list({
        organization: organizationId || undefined,
        type: invoiceType === "sale" ? "customer" : "supplier",
        limit: 50,
      }),
  });

  const partyOptions: SelectOption[] = (partiesData?.parties ?? []).map(
    (p) => ({
      value: p._id,
      label: p.name,
      subtitle: p.phone ?? p.code,
    }),
  );

  // Pre-select party when navigated with partyId param
  const { data: preSelectedParty } = useQuery({
    queryKey: ["party", partyIdParam],
    queryFn: () => partiesApi.get(partyIdParam!),
    enabled: !!partyIdParam,
  });
  useEffect(() => {
    if (preSelectedParty) setValue("party_id", preSelectedParty._id);
  }, [preSelectedParty, setValue]);

  const totals = calculateInvoiceTotals(
    watchItems,
    watchDiscountType,
    watchDiscountValue,
  );

  // ── Date picker handler ────────────────────────────────────────────────
  const handleDateChange = (_: any, date?: Date) => {
    setShowDatePicker(false);
    if (!date) return;
    setValue(pickingField, dayjs(date).format("YYYY-MM-DD"), {
      shouldValidate: true,
    });
  };

  const dateValueForPicker =
    pickingField === "date"
      ? watchDate
        ? new Date(watchDate)
        : new Date()
      : watchDueDate
        ? new Date(watchDueDate)
        : new Date();

  // ── Attachment helpers ─────────────────────────────────────────────────
  const requestCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Camera access is needed.");
      return false;
    }
    return true;
  };
  const requestMedia = async () => {
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
  const handleStagedCamera = async () => {
    if (!(await requestCamera())) return;
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: false,
      exif: false,
    });
    if (!r.canceled && r.assets[0]) addStaged([mapAsset(r.assets[0])]);
  };
  const handleStagedGallery = async () => {
    if (!(await requestMedia())) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_STAGED - stagedFiles.length,
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
  const removeStagedFile = (i: number) =>
    setStagedFiles((prev) => prev.filter((_, idx) => idx !== i));

  // ── Submit ─────────────────────────────────────────────────────────────
  const onSubmit = async (data: InvoiceFormData) => {
    const validItems = data.items.filter(
      (item) => item.description.trim() && parseFloat(item.unit_price) > 0,
    );
    if (validItems.length === 0) {
      toast.error(
        "Please add at least one valid item with description and price",
      );
      return;
    }
    const transformedData = transformInvoiceFormData(data);
    mutation.mutate(
      {
        type: invoiceType,
        ...transformedData,
        organization: organizationId || undefined,
      },
      {
        onSuccess: async (result: any) => {
          if (stagedFiles.length > 0 && result?._id) {
            setUploadingAttachments(true);
            try {
              await uploadAttachments(result._id, stagedFiles);
            } catch {
              toast.error("Invoice saved but attachments failed to upload.");
            } finally {
              setUploadingAttachments(false);
            }
          }
          router.back();
        },
      },
    );
  };

  const isLoading = mutation.isPending || uploadingAttachments;

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.secondary }}>
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-5 py-3 border-b"
        style={{
          backgroundColor: colors.bg.primary,
          borderColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text
          className="text-lg font-bold"
          style={{ color: colors.text.primary }}
        >
          New {invoiceType === "sale" ? "Sales" : "Purchase"} Invoice
        </Text>
        <View className="w-10" />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={Platform.OS === "ios" ? 100 : 120}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── Party Selection ──────────────────────────────────────── */}
        <View
          className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
          style={{ backgroundColor: colors.card }}
        >
          <Text
            className="text-base font-semibold mb-3"
            style={{ color: colors.text.primary }}
          >
            {invoiceType === "sale" ? "Customer" : "Supplier"}{" "}
            <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <Controller
            control={control}
            name="party_id"
            render={({ field: { value, onChange }, fieldState }) => (
              <View className="gap-2">
                <SearchableSelect
                  label={
                    invoiceType === "sale"
                      ? "Select Customer"
                      : "Select Supplier"
                  }
                  placeholder={`Search ${invoiceType === "sale" ? "customers" : "suppliers"}...`}
                  value={value}
                  options={partyOptions}
                  onSelect={(val) => onChange(val)}
                  fetchOptions={async (q) => {
                    const res = await partiesApi.list({
                      organization: organizationId || undefined,
                      type: invoiceType === "sale" ? "customer" : "supplier",
                      search: q,
                      limit: 50,
                    });
                    return res.parties.map((p) => ({
                      value: p._id,
                      label: p.name,
                      subtitle: p.phone ?? p.code,
                    }));
                  }}
                />
                {fieldState.error && (
                  <Text className="text-sm" style={{ color: colors.error }}>
                    {fieldState.error.message}
                  </Text>
                )}
              </View>
            )}
          />
        </View>

        {/* ── Invoice Details ──────────────────────────────────────── */}
        <View
          className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
          style={{ backgroundColor: colors.card }}
        >
          <Text
            className="text-base font-semibold mb-4"
            style={{ color: colors.text.primary }}
          >
            Invoice Details
          </Text>

          {/* Date row */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text
                className="text-sm font-medium mb-2"
                style={{ color: colors.text.secondary }}
              >
                Date <Text style={{ color: colors.error }}>*</Text>
              </Text>
              <Controller
                control={control}
                name="date"
                render={({ field: { value }, fieldState }) => (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        setPickingField("date");
                        setShowDatePicker(true);
                      }}
                      className="flex-row items-center justify-between border rounded-xl px-4 py-3.5"
                      style={{
                        backgroundColor: colors.bg.secondary,
                        borderColor: fieldState.error
                          ? colors.error
                          : colors.inputBorder,
                      }}
                    >
                      <Text
                        className="text-base flex-1"
                        style={{
                          color: value
                            ? colors.text.primary
                            : colors.inputPlaceholder,
                        }}
                      >
                        {value
                          ? dayjs(value).format("MMM DD, YYYY")
                          : "Select date"}
                      </Text>
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={colors.text.secondary}
                      />
                    </TouchableOpacity>
                    {fieldState.error && (
                      <Text
                        className="text-sm mt-1"
                        style={{ color: colors.error }}
                      >
                        {fieldState.error.message}
                      </Text>
                    )}
                  </>
                )}
              />
            </View>
            <View className="flex-1">
              <Text
                className="text-sm font-medium mb-2"
                style={{ color: colors.text.secondary }}
              >
                Due Date
              </Text>
              <Controller
                control={control}
                name="due_date"
                render={({ field: { value } }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setPickingField("due_date");
                      setShowDatePicker(true);
                    }}
                    className="flex-row items-center justify-between border rounded-xl px-4 py-3.5"
                    style={{
                      backgroundColor: colors.bg.secondary,
                      borderColor: colors.inputBorder,
                    }}
                  >
                    <Text
                      className="text-base flex-1"
                      style={{
                        color: value
                          ? colors.text.primary
                          : colors.inputPlaceholder,
                      }}
                    >
                      {value ? dayjs(value).format("MMM DD, YYYY") : "Optional"}
                    </Text>
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={colors.text.secondary}
                    />
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>

          {/* Reference */}
          <View>
            <Text
              className="text-sm font-medium mb-2"
              style={{ color: colors.text.secondary }}
            >
              Reference
            </Text>
            <Controller
              control={control}
              name="reference"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="PO number, order ref, etc."
                  placeholderTextColor={colors.inputPlaceholder}
                  className="border rounded-xl px-4 py-3.5 text-base"
                  style={{
                    backgroundColor: colors.bg.secondary,
                    borderColor: colors.inputBorder,
                    color: colors.text.primary,
                  }}
                />
              )}
            />
          </View>
        </View>

        {/* ── Line Items ───────────────────────────────────────────── */}
        <View
          className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
          style={{ backgroundColor: colors.card }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text
              className="text-base font-semibold"
              style={{ color: colors.text.primary }}
            >
              Line Items <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TouchableOpacity
              className="flex-row items-center px-3 py-2 rounded-lg"
              style={{ backgroundColor: colors.primary + "15" }}
              onPress={() =>
                append({
                  description: "",
                  quantity: "1",
                  unit_price: "",
                  tax_rate: "0",
                })
              }
            >
              <Ionicons name="add-circle" size={20} color={colors.primary} />
              <Text
                className="ml-1 text-sm font-medium"
                style={{ color: colors.primary }}
              >
                Add Item
              </Text>
            </TouchableOpacity>
          </View>
          {errors.items &&
            typeof errors.items === "object" &&
            "message" in errors.items && (
              <Text className="text-sm mb-3" style={{ color: colors.error }}>
                {(errors.items as any).message}
              </Text>
            )}
          {fields.map((field, index) => (
            <LineItemFields
              key={field.id}
              control={control}
              index={index}
              errors={errors}
              onRemove={() => remove(index)}
              canRemove={fields.length > 1}
              onCalculateTotal={calculateLineItemTotal}
              setValue={setValue}
              invoiceType={invoiceType}
            />
          ))}
        </View>

        {/* ── Discount ─────────────────────────────────────────────── */}
        <View
          className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
          style={{ backgroundColor: colors.card }}
        >
          <Text
            className="text-base font-semibold mb-4"
            style={{ color: colors.text.primary }}
          >
            Discount (Optional)
          </Text>
          <View className="flex-row gap-3">
            <Controller
              control={control}
              name="discount_type"
              render={({ field: { onChange, value } }) => (
                <View className="flex-row gap-2">
                  {(["percentage", "fixed"] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      className="px-4 py-2 rounded-lg border"
                      style={{
                        borderColor:
                          value === opt ? colors.primary : colors.border,
                        backgroundColor:
                          value === opt
                            ? colors.primary + "15"
                            : colors.bg.primary,
                      }}
                      onPress={() => onChange(opt)}
                    >
                      <Text
                        className="font-medium"
                        style={{
                          color:
                            value === opt
                              ? colors.primary
                              : colors.text.secondary,
                        }}
                      >
                        {opt === "percentage" ? "%" : "৳"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
            <Controller
              control={control}
              name="discount_value"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="0"
                  placeholderTextColor={colors.inputPlaceholder}
                  keyboardType="decimal-pad"
                  className="flex-1 border rounded-xl px-4 py-3 text-base"
                  style={{
                    backgroundColor: colors.bg.secondary,
                    borderColor: colors.inputBorder,
                    color: colors.text.primary,
                  }}
                />
              )}
            />
          </View>
        </View>

        <InvoiceTotalsSummary totals={totals} />

        {/* ── Notes ────────────────────────────────────────────────── */}
        <View
          className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
          style={{ backgroundColor: colors.card }}
        >
          <Text
            className="text-base font-semibold mb-3"
            style={{ color: colors.text.primary }}
          >
            Notes
          </Text>
          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Additional notes or terms..."
                placeholderTextColor={colors.inputPlaceholder}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                className="border rounded-xl px-4 py-3.5 text-base min-h-[100px]"
                style={{
                  backgroundColor: colors.bg.secondary,
                  borderColor: colors.inputBorder,
                  color: colors.text.primary,
                }}
              />
            )}
          />
        </View>

        {/* ── Attachments ──────────────────────────────────────────── */}
        <View
          className="mx-4 mt-4 mb-4 rounded-2xl p-5 shadow-sm"
          style={{ backgroundColor: colors.card }}
        >
          <Text
            className="text-base font-semibold mb-3"
            style={{ color: colors.text.primary }}
          >
            Attachments
          </Text>

          {stagedFiles.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: 8,
                paddingVertical: 4,
                marginBottom: 12,
              }}
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
                      style={{ backgroundColor: colors.bg.tertiary }}
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
                    hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {stagedFiles.length < MAX_STAGED && (
            <View className="flex-row gap-2">
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
                  Camera
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
                  Gallery
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
                    PDF
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <Text
            style={{ color: colors.text.tertiary }}
            className="text-xs mt-2"
          >
            {stagedFiles.length}/{MAX_STAGED} files · Max {MAX_RAW_MB} MB each
          </Text>
        </View>
      </KeyboardAwareScrollView>

      {/* ── Date Picker ───────────────────────────────────────────── */}
      {showDatePicker && (
        <DateTimePicker
          value={dateValueForPicker}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
        />
      )}

      {/* ── Submit Button ─────────────────────────────────────────── */}
      <View
        className="absolute bottom-0 left-0 right-0 px-5 py-4 border-t"
        style={{
          backgroundColor: colors.bg.primary,
          borderColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          disabled={isLoading}
          className="rounded-xl py-4 items-center"
          style={{
            backgroundColor: isLoading ? colors.primary + "60" : colors.primary,
          }}
        >
          {isLoading ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator color="white" size="small" />
              <Text className="text-white font-bold text-base">
                {uploadingAttachments ? "Uploading attachments…" : "Creating…"}
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <Ionicons
                name={stagedFiles.length > 0 ? "attach" : "checkmark-circle"}
                size={22}
                color="white"
              />
              <Text className="text-white font-bold text-base">
                {stagedFiles.length > 0
                  ? `Create Invoice + ${stagedFiles.length} attachment${stagedFiles.length > 1 ? "s" : ""}`
                  : "Create Invoice"}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
