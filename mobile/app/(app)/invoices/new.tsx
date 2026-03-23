import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { toast } from "@/lib/toast";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useActiveOrgId } from "@/hooks/useOrganization";
import { useCreateInvoice } from "@/hooks/use-invoices";
import type { InvoiceType } from "@/types/invoice";
import { partiesApi, type Party } from "@/services/parties";
import { zodResolver } from "@hookform/resolvers/zod";
import { invoiceSchema, type InvoiceFormData } from "@/lib/validations/invoice";
import {
  InvoiceTypeHeader,
  PartySelectionModal,
  LineItemFields,
  InvoiceTotalsSummary,
} from "@/components/invoices";
import {
  calculateLineItemTotal,
  calculateInvoiceTotals,
  transformInvoiceFormData,
} from "@/lib/invoice-utils";
import { useTheme } from "@/hooks/useTheme";

export default function InvoiceScreen() {
  const { type: typeParam, partyId: partyIdParam } = useLocalSearchParams<{
    type?: string;
    partyId?: string;
  }>();
  const organizationId = useActiveOrgId();
  const { colors } = useTheme();

  const invoiceType: InvoiceType =
    typeParam === "purchase" ? "purchase" : "sale";

  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [partyModalVisible, setPartyModalVisible] = useState(false);

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

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchItems = watch("items");
  const watchDiscountType = watch("discount_type");
  const watchDiscountValue = watch("discount_value");

  const { data: preSelectedParty } = useQuery({
    queryKey: ["party", partyIdParam],
    queryFn: () => partiesApi.get(partyIdParam!),
    enabled: !!partyIdParam,
  });

  useEffect(() => {
    if (preSelectedParty && !selectedParty) {
      setSelectedParty(preSelectedParty);
      setValue("party_id", preSelectedParty._id);
    }
  }, [preSelectedParty, selectedParty, setValue]);

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
      }),
  });

  const parties = partiesData?.parties || [];

  const totals = calculateInvoiceTotals(
    watchItems,
    watchDiscountType,
    watchDiscountValue
  );

  const onSubmit = (data: InvoiceFormData) => {
    const validItems = data.items.filter(
      (item) => item.description.trim() && parseFloat(item.unit_price) > 0
    );

    if (validItems.length === 0) {
      toast.error(
        "Please add at least one valid item with description and price"
      );
      return;
    }

    const transformedData = transformInvoiceFormData(data);
    mutation.mutate({
      type: invoiceType,
      ...transformedData,
      organization: organizationId || undefined,
    });
  };

  const handlePartySelect = (party: Party) => {
    setSelectedParty(party);
    setValue("party_id", party._id);
    setPartyModalVisible(false);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.secondary }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-5 py-3 border-b"
          style={{ backgroundColor: colors.bg.primary, borderColor: colors.border }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text className="text-lg font-bold" style={{ color: colors.text.primary }}>
            New {invoiceType === "sale" ? "Sales" : "Purchase"} Invoice
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          <InvoiceTypeHeader type={invoiceType} />

          {/* Party Selection */}
          <View
            className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
            style={{ backgroundColor: colors.card }}
          >
            <Text className="text-base font-semibold mb-3" style={{ color: colors.text.primary }}>
              {invoiceType === "sale" ? "Customer" : "Supplier"}{" "}
              <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TouchableOpacity
              className="flex-row items-center p-4 rounded-xl border-2"
              style={{
                borderColor: errors.party_id ? colors.error : colors.border,
                backgroundColor: errors.party_id ? (colors.error + '10') : colors.bg.secondary,
              }}
              onPress={() => setPartyModalVisible(true)}
            >
              {selectedParty ? (
                <>
                  <View
                    className={`w-12 h-12 rounded-xl items-center justify-center ${
                      invoiceType === "sale" ? "bg-emerald-100" : "bg-amber-100"
                    }`}
                  >
                    <Ionicons
                      name={invoiceType === "sale" ? "person" : "business"}
                      size={24}
                      color={invoiceType === "sale" ? "#10B981" : "#F59E0B"}
                    />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-base font-semibold" style={{ color: colors.text.primary }}>
                      {selectedParty.name}
                    </Text>
                    {selectedParty.code && (
                      <Text className="text-sm" style={{ color: colors.text.secondary }}>
                        {selectedParty.code}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={22} color={colors.text.tertiary} />
                </>
              ) : (
                <>
                  <View
                    className="w-12 h-12 rounded-xl items-center justify-center"
                    style={{ backgroundColor: colors.bg.tertiary }}
                  >
                    <Ionicons name="person-add" size={24} color={colors.text.tertiary} />
                  </View>
                  <Text className="flex-1 ml-3 text-base" style={{ color: colors.text.tertiary }}>
                    Select {invoiceType === "sale" ? "customer" : "supplier"}...
                  </Text>
                  <Ionicons name="chevron-forward" size={22} color={colors.text.tertiary} />
                </>
              )}
            </TouchableOpacity>
            {errors.party_id && (
              <Text className="text-sm mt-2" style={{ color: colors.error }}>
                {errors.party_id.message}
              </Text>
            )}
            <Controller control={control} name="party_id" render={() => null} />
          </View>

          {/* Dates & Reference */}
          <View
            className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
            style={{ backgroundColor: colors.card }}
          >
            <Text className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
              Invoice Details
            </Text>

            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Date <Text style={{ color: colors.error }}>*</Text>
                </Text>
                <Controller
                  control={control}
                  name="date"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.inputPlaceholder}
                      className="border rounded-xl px-4 py-3.5 text-base"
                      style={{
                        backgroundColor: colors.bg.secondary,
                        borderColor: errors.date ? colors.error : colors.inputBorder,
                        color: colors.text.primary,
                      }}
                    />
                  )}
                />
                {errors.date && (
                  <Text className="text-sm mt-1" style={{ color: colors.error }}>
                    {errors.date.message}
                  </Text>
                )}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Due Date
                </Text>
                <Controller
                  control={control}
                  name="due_date"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="YYYY-MM-DD"
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

            <View>
              <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
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

          {/* Line Items */}
          <View
            className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
            style={{ backgroundColor: colors.card }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-base font-semibold" style={{ color: colors.text.primary }}>
                Line Items <Text style={{ color: colors.error }}>*</Text>
              </Text>
              <TouchableOpacity
                className="flex-row items-center px-3 py-2 rounded-lg"
                style={{ backgroundColor: colors.primary + '15' }}
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
                <Text className="ml-1 text-sm font-medium" style={{ color: colors.primary }}>
                  Add Item
                </Text>
              </TouchableOpacity>
            </View>

            {errors.items &&
              typeof errors.items === "object" &&
              "message" in errors.items && (
                <Text className="text-sm mb-3" style={{ color: colors.error }}>
                  {errors.items.message}
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
              />
            ))}
          </View>

          {/* Discount */}
          <View
            className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
            style={{ backgroundColor: colors.card }}
          >
            <Text className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
              Discount (Optional)
            </Text>

            <View className="flex-row gap-3 mb-3">
              <Controller
                control={control}
                name="discount_type"
                render={({ field: { onChange, value } }) => (
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      className="px-4 py-2 rounded-lg border"
                      style={{
                        borderColor: value === "percentage" ? colors.primary : colors.border,
                        backgroundColor: value === "percentage" ? (colors.primary + '15') : colors.bg.primary,
                      }}
                      onPress={() => onChange("percentage")}
                    >
                      <Text
                        className="font-medium"
                        style={{ color: value === "percentage" ? colors.primary : colors.text.secondary }}
                      >
                        %
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="px-4 py-2 rounded-lg border"
                      style={{
                        borderColor: value === "fixed" ? colors.primary : colors.border,
                        backgroundColor: value === "fixed" ? (colors.primary + '15') : colors.bg.primary,
                      }}
                      onPress={() => onChange("fixed")}
                    >
                      <Text
                        className="font-medium"
                        style={{ color: value === "fixed" ? colors.primary : colors.text.secondary }}
                      >
                        ৳
                      </Text>
                    </TouchableOpacity>
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

          {/* Notes */}
          <View
            className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
            style={{ backgroundColor: colors.card }}
          >
            <Text className="text-base font-semibold mb-3" style={{ color: colors.text.primary }}>
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
        </ScrollView>

        {/* Submit Button */}
        <View
          className="absolute bottom-0 left-0 right-0 px-5 py-4 border-t"
          style={{ backgroundColor: colors.bg.primary, borderColor: colors.border }}
        >
          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={mutation.isPending}
            className="rounded-xl py-4 items-center"
            style={{ backgroundColor: mutation.isPending ? (colors.primary + '60') : colors.primary }}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={22} color="white" />
                <Text className="ml-2 text-white font-bold text-base">
                  Create Invoice
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <PartySelectionModal
        visible={partyModalVisible}
        onClose={() => setPartyModalVisible(false)}
        parties={parties}
        selectedParty={selectedParty}
        onSelectParty={handlePartySelect}
        invoiceType={invoiceType}
      />
    </View>
  );
}
