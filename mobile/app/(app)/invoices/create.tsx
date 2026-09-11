import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import {
  useForm,
  Controller,
  useFieldArray,
  type FieldErrors,
} from "react-hook-form";
import { toast } from "@/lib/toast";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useActiveOrgId } from "@/hooks/use-organization";
import { useCreateInvoice } from "@/hooks/use-invoices";
import type { InvoiceType } from "@/types/invoice";
import {
  dalFetchParties,
  dalCreateParty,
  dalFetchParty,
} from "@/data/parties";
import { dalFetchAccounts } from "@/data/accounts";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createInvoiceSchema,
  type InvoiceFormData,
} from "@/lib/validations/shop";
import { findFirstErrorMessage } from "@/lib/invoice-utils";
import { LineItemFields, InvoiceTotalsSummary } from "@/components/invoices";
import {
  calculateLineItemTotal,
  calculateInvoiceTotals,
  transformInvoiceFormData,
} from "@/lib/invoice-utils";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";
import { useKeyboardFooterLift } from "@/hooks/use-keyboard-footer-lift";
import { SearchableSelect } from "@/components/searchable-select";
import type { SelectOption } from "@/components/searchable-select";
import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { uploadAttachments } from "@/services/attachments";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  amountInputProps,
  normalizeAmountInput,
} from "@/lib/amount-input";

type StagedFile = { uri: string; name: string; type: string; size?: number };
const MAX_STAGED = 10;
const MAX_RAW_MB = 10;

export default function CreateInvoiceScreen() {
  const { type: typeParam, partyId: partyIdParam } = useLocalSearchParams<{
    type?: string;
    partyId?: string;
  }>();
  const organizationId = useActiveOrgId();
  const { colors } = useTheme();
  const { t, language } = useTranslation();
  const { footerContainerStyle, scrollProps } = useKeyboardFooterLift();

  const paymentModeLabels: Record<string, string> = {
    due: t("due"),
    cash: t("paid"),
    partial: t("partial"),
  };

  const paymentMethodLabels: Record<string, string> = {
    cash: t("cash"),
    bank: t("bank"),
    mobile_wallet: t("mobileWallet"),
    cheque: t("cheque"),
    other: t("other"),
  };

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

  // Schema factory is keyed on the language so messages follow the locale.
  const schema = useMemo(() => createInvoiceSchema(t), [language]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(schema),
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
      payment_mode: "due",
      initial_payment_amount: "",
      initial_payment_account: "",
      initial_payment_method: "cash",
      initial_payment_reference: "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const watchItems = watch("items");
  const watchDiscountType = watch("discount_type");
  const watchDiscountValue = watch("discount_value");
  const watchDate = watch("date");
  const watchDueDate = watch("due_date");
  const watchPaymentMode = watch("payment_mode");

  // Load accounts for payment (DAL → SQLite when local-first is on)
  const { data: accountsData } = useQuery({
    queryKey: ["accounts", organizationId ?? "personal"],
    queryFn: () => dalFetchAccounts(organizationId),
  });
  const accountOptions = (accountsData ?? []).map((a: any) => ({
    value: a._id,
    label: a.name,
    subtitle: a.balance !== undefined ? `Balance: ${a.balance}` : undefined,
  }));

  // Pre-load 50 parties for the dropdown (include "both" type)
  const { data: partiesData } = useQuery({
    queryKey: [
      "parties",
      organizationId,
      invoiceType === "sale" ? "customer" : "supplier",
    ],
    queryFn: () =>
      dalFetchParties({
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

  // Inline party creation — creates the party and returns it as a SelectOption
  const handleAddParty = async (name: string): Promise<SelectOption | null> => {
    try {
      const newParty = await dalCreateParty({
        organization: organizationId || undefined,
        name: name.trim(),
        type: invoiceType === "sale" ? "customer" : "supplier",
      });
      return {
        value: newParty._id,
        label: newParty.name,
        subtitle: newParty.phone ?? newParty.code,
      };
    } catch {
      toast.error(t("failedToAddParty"));
      return null;
    }
  };

  // Pre-select party when navigated with partyId param
  const { data: preSelectedParty } = useQuery({
    queryKey: ["party", partyIdParam],
    queryFn: () => dalFetchParty(partyIdParam!),
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
      Alert.alert(t("permissionRequired"), t("cameraPermissionNeeded"));
      return false;
    }
    return true;
  };
  const requestMedia = async () => {
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
  /**
   * Safety net: some invoice fields (notes, reference, internal ones) have no
   * inline error slot, so surface the first problem as a toast rather than
   * letting the submit button appear to do nothing.
   */
  const onInvalid = useCallback(
    (formErrors: FieldErrors<InvoiceFormData>) => {
      const first = findFirstErrorMessage(formErrors);
      if (first) toast.error(first);
    },
    [],
  );

  const onSubmit = async (data: InvoiceFormData) => {
    // Zod already guarantees description + price per line; keep the guard as a
    // defensive check for programmatic callers.
    const validItems = data.items.filter(
      (item) => item.description.trim() && parseFloat(item.unit_price) > 0,
    );
    if (validItems.length === 0) {
      toast.error(t("addAtLeastOneItem"));
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
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.bg.primary,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.bg.tertiary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: colors.text.primary,
              textAlign: "center",
            }}
          >
            {invoiceType === "sale"
              ? `${t("newSale")} ${t("invoice")}`
              : `${t("newPurchase")} ${t("invoice")}`}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.text.secondary,
              textAlign: "center",
              marginTop: 2,
            }}
          >
            {invoiceType === "sale"
              ? "Create a sales invoice"
              : "Create a purchase invoice"}
          </Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAwareScrollView
        {...scrollProps}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
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
            {invoiceType === "sale" ? t("customer") : t("supplier")}{" "}
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
                      ? t("selectCustomer")
                      : t("selectSupplier")
                  }
                  placeholder={
                    invoiceType === "sale"
                      ? t("searchCustomersPlaceholder")
                      : t("searchSuppliersPlaceholder")
                  }
                  value={value}
                  options={partyOptions}
                  onSelect={(val) => onChange(val)}
                  onAddNew={handleAddParty}
                  addNewLabel={
                    invoiceType === "sale" ? t("customer") : t("supplier")
                  }
                  fetchOptions={async (q) => {
                    const res = await dalFetchParties({
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
            {t("invoiceDetails")}
          </Text>

          {/* Date row */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text
                className="text-sm font-medium mb-2"
                style={{ color: colors.text.secondary }}
              >
                {t("invoiceDate")} <Text style={{ color: colors.error }}>*</Text>
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
                          : t("selectDate")}
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
                {t("dueDate")}
              </Text>
              <Controller
                control={control}
                name="due_date"
                render={({ field: { value }, fieldState }) => (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        setPickingField("due_date");
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
                          : t("optional")}
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
          </View>

          {/* Reference */}
          <View>
            <Text
              className="text-sm font-medium mb-2"
              style={{ color: colors.text.secondary }}
            >
              {t("reference")}
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
              {t("lineItems")} <Text style={{ color: colors.error }}>*</Text>
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
                {t("addItem")}
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
              getValues={getValues}
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
            {t("discountOptional")}
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
              render={({ field: { onChange, onBlur, value }, fieldState }) => (
                <View className="flex-1">
                  <TextInput
                    value={value}
                    onChangeText={(t) => onChange(normalizeAmountInput(t))}
                    onBlur={onBlur}
                    placeholder="0"
                    placeholderTextColor={colors.inputPlaceholder}
                    {...amountInputProps}
                    className="border rounded-xl px-4 py-3 text-base"
                    style={{
                      backgroundColor: colors.bg.secondary,
                      borderColor: fieldState.error
                        ? colors.error
                        : colors.inputBorder,
                      color: colors.text.primary,
                    }}
                  />
                  {fieldState.error && (
                    <Text
                      className="text-sm mt-1"
                      style={{ color: colors.error }}
                    >
                      {fieldState.error.message}
                    </Text>
                  )}
                </View>
              )}
            />
          </View>
        </View>

        <InvoiceTotalsSummary totals={totals} />

        {/* ── Payment Mode ─────────────────────────────────────────── */}
        <View
          className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
          style={{ backgroundColor: colors.card }}
        >
          <Text
            className="text-base font-semibold mb-1"
            style={{ color: colors.text.primary }}
          >
            {t("paymentMode")}
          </Text>
          <Text
            className="text-xs mb-4"
            style={{ color: colors.text.secondary }}
          >
            {invoiceType === "sale"
              ? "How will the customer pay?"
              : "How are you paying the supplier?"}
          </Text>

          {/* Toggle: Due / Cash / Partial */}
          <Controller
            control={control}
            name="payment_mode"
            render={({ field: { value, onChange } }) => (
              <View className="flex-row gap-2 mb-4">
                {(
                  [
                    {
                      key: "due",
                      label: "Due / Halkhata",
                      icon: "time-outline",
                    },
                    {
                      key: "cash",
                      label: "Paid Full",
                      icon: "checkmark-circle-outline",
                    },
                    {
                      key: "partial",
                      label: "Partial",
                      icon: "pie-chart-outline",
                    },
                  ] as const
                ).map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    className="flex-1 items-center py-3 rounded-xl border"
                    style={{
                      borderColor:
                        value === opt.key ? colors.primary : colors.border,
                      backgroundColor:
                        value === opt.key
                          ? colors.primary + "15"
                          : colors.bg.secondary,
                    }}
                    onPress={() => onChange(opt.key)}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={20}
                      color={
                        value === opt.key
                          ? colors.primary
                          : colors.text.secondary
                      }
                    />
                    <Text
                      className="text-xs font-medium mt-1 text-center"
                      style={{
                        color:
                          value === opt.key
                            ? colors.primary
                            : colors.text.secondary,
                      }}
                    >
                      {paymentModeLabels[opt.key] ?? opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          />

          {/* Due mode info */}
          {watchPaymentMode === "due" && (
            <View
              className="flex-row items-start gap-2 rounded-xl p-3"
              style={{ backgroundColor: colors.warning + "18" }}
            >
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={colors.warning}
                style={{ marginTop: 1 }}
              />
              <Text
                className="flex-1 text-sm"
                style={{ color: colors.warning }}
              >
                {t("duePaymentNote")}
              </Text>
            </View>
          )}

          {/* Cash / Partial: account + method + amount */}
          {(watchPaymentMode === "cash" || watchPaymentMode === "partial") && (
            <View className="gap-4">
              {/* Account */}
              <Controller
                control={control}
                name="initial_payment_account"
                render={({ field: { value, onChange }, fieldState }) => (
                  <View>
                    <SearchableSelect
                      label={t("depositToAccount")}
                      placeholder={t("selectAccountPlaceholder")}
                      value={value ?? ""}
                      options={accountOptions}
                      onSelect={(val) => onChange(val)}
                    />
                    {fieldState.error && (
                      <Text
                        className="text-sm mt-1"
                        style={{ color: colors.error }}
                      >
                        {fieldState.error.message}
                      </Text>
                    )}
                  </View>
                )}
              />

              {/* Method */}
              <Controller
                control={control}
                name="initial_payment_method"
                render={({ field: { value, onChange } }) => (
                  <View>
                    <Text
                      className="text-sm font-medium mb-2"
                      style={{ color: colors.text.secondary }}
                    >
                      {t("paymentMethod")}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {(
                        [
                          { key: "cash", label: "Cash" },
                          { key: "bank", label: "Bank" },
                          { key: "mobile_wallet", label: "MFS" },
                          { key: "cheque", label: "Cheque" },
                          { key: "other", label: "Other" },
                        ] as const
                      ).map((m) => (
                        <TouchableOpacity
                          key={m.key}
                          className="px-4 py-2 rounded-lg border"
                          style={{
                            borderColor:
                              value === m.key ? colors.primary : colors.border,
                            backgroundColor:
                              value === m.key
                                ? colors.primary + "15"
                                : colors.bg.secondary,
                          }}
                          onPress={() => onChange(m.key)}
                        >
                          <Text
                            className="text-sm font-medium"
                            style={{
                              color:
                                value === m.key
                                  ? colors.primary
                                  : colors.text.secondary,
                            }}
                          >
                            {paymentMethodLabels[m.key] ?? m.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              />

              {/* Amount — only for partial */}
              {watchPaymentMode === "partial" && (
                <Controller
                  control={control}
                  name="initial_payment_amount"
                  render={({ field: { value, onChange }, fieldState }) => (
                    <View>
                      <Text
                        className="text-sm font-medium mb-2"
                        style={{ color: colors.text.secondary }}
                      >
                        {t("amountPaid")}
                      </Text>
                      <TextInput
                        value={value ?? ""}
                        onChangeText={(t) => onChange(normalizeAmountInput(t))}
                        placeholder="0"
                        placeholderTextColor={colors.inputPlaceholder}
                        {...amountInputProps}
                        className="border rounded-xl px-4 py-3.5 text-base"
                        style={{
                          backgroundColor: colors.bg.secondary,
                          borderColor: fieldState.error
                            ? colors.error
                            : colors.inputBorder,
                          color: colors.text.primary,
                        }}
                      />
                      {fieldState.error && (
                        <Text
                          className="text-sm mt-1"
                          style={{ color: colors.error }}
                        >
                          {fieldState.error.message}
                        </Text>
                      )}
                    </View>
                  )}
                />
              )}

              {/* Reference */}
              <Controller
                control={control}
                name="initial_payment_reference"
                render={({ field: { value, onChange } }) => (
                  <View>
                    <Text
                      className="text-sm font-medium mb-2"
                      style={{ color: colors.text.secondary }}
                    >
                      {t("reference")}{" "}
                      <Text style={{ color: colors.text.tertiary }}>
                        ({t("optional")})
                      </Text>
                    </Text>
                    <TextInput
                      value={value ?? ""}
                      onChangeText={onChange}
                      placeholder="Cheque no, txn ID..."
                      placeholderTextColor={colors.inputPlaceholder}
                      className="border rounded-xl px-4 py-3.5 text-base"
                      style={{
                        backgroundColor: colors.bg.secondary,
                        borderColor: colors.inputBorder,
                        color: colors.text.primary,
                      }}
                    />
                  </View>
                )}
              />
            </View>
          )}
        </View>

        {/* ── Notes ────────────────────────────────────────────────── */}
        <View
          className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
          style={{ backgroundColor: colors.card }}
        >
          <Text
            className="text-base font-semibold mb-3"
            style={{ color: colors.text.primary }}
          >
            {t("notesOptional")}
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
            {t("attachments")}
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

      <View
        style={{
          ...footerContainerStyle,
          borderTopColor: colors.border,
          backgroundColor: colors.bg.primary,
        }}
      >
        <TouchableOpacity
          onPress={handleSubmit(onSubmit, onInvalid)}
          disabled={isLoading}
          className="rounded-2xl py-4 items-center shadow-lg"
          style={{
            backgroundColor: colors.info,
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator color="white" size="small" />
              <Text className="text-white font-bold text-base">
                {uploadingAttachments ? t("uploadingAttachments") : "Creating…"}
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <Ionicons
                name={stagedFiles.length > 0 ? "attach" : "checkmark-circle"}
                size={20}
                color="white"
              />
              <Text className="text-white font-bold text-base">
                {stagedFiles.length > 0
                  ? `${t("addInvoice")} + ${stagedFiles.length} ${t("attachments")}`
                  : t("addInvoice")}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Date Picker ───────────────────────────────────────────── */}
      {showDatePicker && (
        <DateTimePicker
          value={dateValueForPicker}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
        />
      )}
    </View>
  );
}
