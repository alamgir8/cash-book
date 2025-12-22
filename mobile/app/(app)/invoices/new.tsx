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
import { toast } from "@/lib/toast";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useActiveOrgId } from "@/hooks/useOrganization";
import { useCreateInvoice } from "@/hooks/use-invoices";
import type { InvoiceType } from "@/types/invoice";
import { invoiceSchema, type InvoiceFormData } from "@/lib/validations/invoice";
import { partiesApi, type Party } from "@/services/parties";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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

export default function InvoiceScreen() {
  const { type: typeParam, partyId: partyIdParam } = useLocalSearchParams<{
    type?: string;
    partyId?: string;
  }>();
  const organizationId = useActiveOrgId();

  const invoiceType: InvoiceType =
    typeParam === "purchase" ? "purchase" : "sale";

  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [partyModalVisible, setPartyModalVisible] = useState(false);

  // Use custom hook for creating invoice
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

  // Load party if partyId is provided
  const { data: preSelectedParty } = useQuery({
    queryKey: ["party", partyIdParam],
    queryFn: () => partiesApi.get(partyIdParam!),
    enabled: !!partyIdParam,
  });

  // Set party when preselected party loads
  useEffect(() => {
    if (preSelectedParty && !selectedParty) {
      setSelectedParty(preSelectedParty);
      setValue("party_id", preSelectedParty._id);
    }
  }, [preSelectedParty, selectedParty, setValue]);

  // Load parties for selection
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

  // Calculate totals using utility function
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
    <View className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-3 bg-white border-b border-slate-100">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-slate-900">
            New {invoiceType === "sale" ? "Sales" : "Purchase"} Invoice
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Invoice Type Header */}
          <InvoiceTypeHeader type={invoiceType} />

          {/* Party Selection */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
            <Text className="text-base font-semibold text-slate-800 mb-3">
              {invoiceType === "sale" ? "Customer" : "Supplier"}{" "}
              <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              className={`flex-row items-center p-4 rounded-xl border-2 ${
                errors.party_id
                  ? "border-red-400 bg-red-50"
                  : "border-slate-200 bg-slate-50"
              }`}
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
                    <Text className="text-base font-semibold text-slate-800">
                      {selectedParty.name}
                    </Text>
                    {selectedParty.code && (
                      <Text className="text-sm text-slate-500">
                        {selectedParty.code}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
                </>
              ) : (
                <>
                  <View className="w-12 h-12 rounded-xl items-center justify-center bg-slate-200">
                    <Ionicons name="person-add" size={24} color="#94A3B8" />
                  </View>
                  <Text className="flex-1 ml-3 text-slate-400 text-base">
                    Select {invoiceType === "sale" ? "customer" : "supplier"}...
                  </Text>
                  <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
                </>
              )}
            </TouchableOpacity>
            {errors.party_id && (
              <Text className="text-red-500 text-sm mt-2">
                {errors.party_id.message}
              </Text>
            )}
            <Controller control={control} name="party_id" render={() => null} />
          </View>

          {/* Dates & Reference */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
            <Text className="text-base font-semibold text-slate-800 mb-4">
              Invoice Details
            </Text>

            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-sm font-medium text-slate-600 mb-2">
                  Date <Text className="text-red-500">*</Text>
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
                      placeholderTextColor="#94A3B8"
                      className={`bg-slate-50 border rounded-xl px-4 py-3.5 text-slate-800 text-base ${
                        errors.date ? "border-red-400" : "border-slate-200"
                      }`}
                    />
                  )}
                />
                {errors.date && (
                  <Text className="text-red-500 text-sm mt-1">
                    {errors.date.message}
                  </Text>
                )}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-slate-600 mb-2">
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
                      placeholderTextColor="#94A3B8"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 text-base"
                    />
                  )}
                />
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-slate-600 mb-2">
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
                    placeholderTextColor="#94A3B8"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 text-base"
                  />
                )}
              />
            </View>
          </View>

          {/* Line Items */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-base font-semibold text-slate-800">
                Line Items <Text className="text-red-500">*</Text>
              </Text>
              <TouchableOpacity
                className="flex-row items-center bg-indigo-50 px-3 py-2 rounded-lg"
                onPress={() =>
                  append({
                    description: "",
                    quantity: "1",
                    unit_price: "",
                    tax_rate: "0",
                  })
                }
              >
                <Ionicons name="add-circle" size={20} color="#6366F1" />
                <Text className="ml-1 text-sm text-indigo-600 font-medium">
                  Add Item
                </Text>
              </TouchableOpacity>
            </View>

            {errors.items &&
              typeof errors.items === "object" &&
              "message" in errors.items && (
                <Text className="text-red-500 text-sm mb-3">
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
          <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
            <Text className="text-base font-semibold text-slate-800 mb-4">
              Discount (Optional)
            </Text>

            <View className="flex-row gap-3 mb-3">
              <Controller
                control={control}
                name="discount_type"
                render={({ field: { onChange, value } }) => (
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      className={`px-4 py-2 rounded-lg border ${
                        value === "percentage"
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 bg-white"
                      }`}
                      onPress={() => onChange("percentage")}
                    >
                      <Text
                        className={
                          value === "percentage"
                            ? "text-indigo-600 font-medium"
                            : "text-slate-600"
                        }
                      >
                        %
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`px-4 py-2 rounded-lg border ${
                        value === "fixed"
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 bg-white"
                      }`}
                      onPress={() => onChange("fixed")}
                    >
                      <Text
                        className={
                          value === "fixed"
                            ? "text-indigo-600 font-medium"
                            : "text-slate-600"
                        }
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
                    placeholderTextColor="#94A3B8"
                    keyboardType="decimal-pad"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base"
                  />
                )}
              />
            </View>
          </View>

          {/* Invoice Summary */}
          <InvoiceTotalsSummary totals={totals} />

          {/* Notes */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
            <Text className="text-base font-semibold text-slate-800 mb-3">
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
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 text-base min-h-[100px]"
                />
              )}
            />
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View className="absolute bottom-0 left-0 right-0 bg-white px-5 py-4 border-t border-slate-100">
          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={mutation.isPending}
            className={`rounded-xl py-4 items-center ${
              mutation.isPending ? "bg-indigo-300" : "bg-indigo-600"
            }`}
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

      {/* Party Selection Modal */}
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
