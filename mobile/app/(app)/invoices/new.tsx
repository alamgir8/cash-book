import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useActiveOrgId } from "@/hooks/useOrganization";
import { invoicesApi, InvoiceType } from "@/services/invoices";
import { partiesApi, Party } from "@/services/parties";
import { getApiErrorMessage } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { z } from "zod";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Zod validation schemas
const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.string().min(1, "Quantity is required"),
  unit_price: z.string().min(1, "Price is required"),
  tax_rate: z.string().optional(),
});

const invoiceSchema = z.object({
  party_id: z.string().min(1, "Please select a party"),
  date: z.string().min(1, "Invoice date is required"),
  due_date: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "At least one item is required"),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

export default function NewInvoiceScreen() {
  const { type: typeParam, partyId: partyIdParam } = useLocalSearchParams<{
    type?: string;
    partyId?: string;
  }>();
  const queryClient = useQueryClient();
  const organizationId = useActiveOrgId();

  const invoiceType: InvoiceType =
    typeParam === "purchase" ? "purchase" : "sale";

  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [partyModalVisible, setPartyModalVisible] = useState(false);

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

  const mutation = useMutation({
    mutationFn: invoicesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INVOICES });
      Alert.alert("Success", "Invoice created successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (error: any) => {
      Alert.alert("Error", getApiErrorMessage(error));
    },
  });

  const calculateLineTotal = (item: {
    quantity: string;
    unit_price: string;
    tax_rate?: string;
  }) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    const taxRate = parseFloat(item.tax_rate || "0") || 0;
    const subtotal = qty * price;
    const tax = subtotal * (taxRate / 100);
    return subtotal + tax;
  };

  const calculateTotals = useCallback(() => {
    let subtotal = 0;
    let totalTax = 0;

    watchItems.forEach((item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const taxRate = parseFloat(item.tax_rate || "0") || 0;
      const lineSubtotal = qty * price;
      subtotal += lineSubtotal;
      totalTax += lineSubtotal * (taxRate / 100);
    });

    let discountAmount = 0;
    const discountVal = parseFloat(watchDiscountValue || "0") || 0;
    if (watchDiscountType === "percentage") {
      discountAmount = subtotal * (discountVal / 100);
    } else {
      discountAmount = discountVal;
    }

    const total = subtotal + totalTax - discountAmount;

    return { subtotal, totalTax, discountAmount, total };
  }, [watchItems, watchDiscountType, watchDiscountValue]);

  const totals = calculateTotals();

  const formatAmount = (amount: number) => {
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const onSubmit = (data: InvoiceFormData) => {
    const validItems = data.items.filter(
      (item) => item.description.trim() && parseFloat(item.unit_price) > 0
    );

    if (validItems.length === 0) {
      Alert.alert(
        "Error",
        "Please add at least one valid item with description and price"
      );
      return;
    }

    const items = validItems.map((item) => ({
      description: item.description.trim(),
      quantity: parseFloat(item.quantity) || 1,
      unit_price: parseFloat(item.unit_price) || 0,
      tax_rate: parseFloat(item.tax_rate || "0") || 0,
    }));

    mutation.mutate({
      type: invoiceType,
      party: data.party_id,
      date: data.date,
      due_date: data.due_date || undefined,
      notes: data.notes?.trim() || undefined,
      items,
      organization: organizationId || undefined,
    });
  };

  const handlePartySelect = (party: Party) => {
    setSelectedParty(party);
    setValue("party_id", party._id);
    setPartyModalVisible(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-slate-100">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-slate-100"
          >
            <Ionicons name="arrow-back" size={22} color="#334155" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-slate-800">
            {invoiceType === "sale"
              ? "New Sales Invoice"
              : "New Purchase Invoice"}
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Invoice Type Banner */}
          <View
            className={`mx-4 mt-4 p-4 rounded-2xl flex-row items-center ${
              invoiceType === "sale" ? "bg-emerald-50" : "bg-amber-50"
            }`}
          >
            <View
              className={`w-12 h-12 rounded-full items-center justify-center ${
                invoiceType === "sale" ? "bg-emerald-100" : "bg-amber-100"
              }`}
            >
              <Ionicons
                name={invoiceType === "sale" ? "trending-up" : "trending-down"}
                size={24}
                color={invoiceType === "sale" ? "#10B981" : "#F59E0B"}
              />
            </View>
            <View className="ml-3 flex-1">
              <Text
                className={`text-base font-semibold ${
                  invoiceType === "sale" ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {invoiceType === "sale" ? "Sales Invoice" : "Purchase Invoice"}
              </Text>
              <Text className="text-sm text-slate-500">
                {invoiceType === "sale"
                  ? "Bill your customers"
                  : "Record vendor purchases"}
              </Text>
            </View>
          </View>

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
              <View
                key={field.id}
                className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-100"
              >
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center">
                      <Text className="text-indigo-600 font-semibold text-sm">
                        {index + 1}
                      </Text>
                    </View>
                    <Text className="text-sm font-medium text-slate-600 ml-2">
                      Item {index + 1}
                    </Text>
                  </View>
                  {fields.length > 1 && (
                    <TouchableOpacity
                      onPress={() => remove(index)}
                      className="w-8 h-8 rounded-full bg-red-100 items-center justify-center"
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color="#EF4444"
                      />
                    </TouchableOpacity>
                  )}
                </View>

                <Controller
                  control={control}
                  name={`items.${index}.description`}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Item description"
                      placeholderTextColor="#94A3B8"
                      className={`bg-white border rounded-xl px-4 py-3 text-slate-800 text-base mb-3 ${
                        errors.items?.[index]?.description
                          ? "border-red-400"
                          : "border-slate-200"
                      }`}
                    />
                  )}
                />
                {errors.items?.[index]?.description && (
                  <Text className="text-red-500 text-sm mb-2 -mt-2">
                    {errors.items[index]?.description?.message}
                  </Text>
                )}

                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Text className="text-xs font-medium text-slate-500 mb-1">
                      Quantity
                    </Text>
                    <Controller
                      control={control}
                      name={`items.${index}.quantity`}
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          placeholder="1"
                          placeholderTextColor="#94A3B8"
                          keyboardType="decimal-pad"
                          className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-base"
                        />
                      )}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-medium text-slate-500 mb-1">
                      Price
                    </Text>
                    <Controller
                      control={control}
                      name={`items.${index}.unit_price`}
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          placeholder="0.00"
                          placeholderTextColor="#94A3B8"
                          keyboardType="decimal-pad"
                          className={`bg-white border rounded-xl px-3 py-2.5 text-slate-800 text-base ${
                            errors.items?.[index]?.unit_price
                              ? "border-red-400"
                              : "border-slate-200"
                          }`}
                        />
                      )}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-medium text-slate-500 mb-1">
                      Tax %
                    </Text>
                    <Controller
                      control={control}
                      name={`items.${index}.tax_rate`}
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          placeholder="0"
                          placeholderTextColor="#94A3B8"
                          keyboardType="decimal-pad"
                          className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-base"
                        />
                      )}
                    />
                  </View>
                </View>

                <View className="flex-row justify-end mt-3 pt-3 border-t border-slate-200">
                  <Text className="text-sm text-slate-500">
                    Line Total:{" "}
                    <Text className="font-semibold text-slate-800">
                      {formatAmount(
                        calculateLineTotal({
                          quantity: watchItems[index]?.quantity || "0",
                          unit_price: watchItems[index]?.unit_price || "0",
                          tax_rate: watchItems[index]?.tax_rate,
                        })
                      )}
                    </Text>
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Discount */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
            <Text className="text-base font-semibold text-slate-800 mb-4">
              Discount
            </Text>

            <View className="flex-row gap-3">
              <View className="flex-row flex-1 rounded-xl overflow-hidden border-2 border-slate-200">
                <TouchableOpacity
                  className={`flex-1 py-3 ${
                    watchDiscountType === "percentage"
                      ? "bg-indigo-600"
                      : "bg-slate-50"
                  }`}
                  onPress={() => setValue("discount_type", "percentage")}
                >
                  <Text
                    className={`text-center font-semibold ${
                      watchDiscountType === "percentage"
                        ? "text-white"
                        : "text-slate-500"
                    }`}
                  >
                    %
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 py-3 ${
                    watchDiscountType === "fixed"
                      ? "bg-indigo-600"
                      : "bg-slate-50"
                  }`}
                  onPress={() => setValue("discount_type", "fixed")}
                >
                  <Text
                    className={`text-center font-semibold ${
                      watchDiscountType === "fixed"
                        ? "text-white"
                        : "text-slate-500"
                    }`}
                  >
                    Fixed
                  </Text>
                </TouchableOpacity>
              </View>
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
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 text-base"
                  />
                )}
              />
            </View>
          </View>

          {/* Totals */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
            <View className="flex-row justify-between py-3">
              <Text className="text-sm text-slate-500">Subtotal</Text>
              <Text className="text-sm font-medium text-slate-700">
                {formatAmount(totals.subtotal)}
              </Text>
            </View>
            <View className="flex-row justify-between py-3 border-t border-slate-100">
              <Text className="text-sm text-slate-500">Tax</Text>
              <Text className="text-sm font-medium text-slate-700">
                {formatAmount(totals.totalTax)}
              </Text>
            </View>
            {totals.discountAmount > 0 && (
              <View className="flex-row justify-between py-3 border-t border-slate-100">
                <Text className="text-sm text-slate-500">Discount</Text>
                <Text className="text-sm font-medium text-red-600">
                  -{formatAmount(totals.discountAmount)}
                </Text>
              </View>
            )}
            <View className="flex-row justify-between py-4 border-t-2 border-slate-200 mt-2">
              <Text className="text-lg font-bold text-slate-800">Total</Text>
              <Text className="text-xl font-bold text-indigo-600">
                {formatAmount(totals.total)}
              </Text>
            </View>
          </View>

          {/* Notes */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
            <Text className="text-base font-semibold text-slate-800 mb-4">
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
              <View className="flex-row items-center">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white font-semibold text-base ml-2">
                  Creating...
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center">
                <Ionicons
                  name="document-text-outline"
                  size={22}
                  color="white"
                />
                <Text className="text-white font-semibold text-base ml-2">
                  Create Invoice
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Party Selection Modal */}
      <Modal
        visible={partyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView className="flex-1 bg-slate-50">
          <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-slate-100">
            <Text className="text-lg font-semibold text-slate-800">
              Select {invoiceType === "sale" ? "Customer" : "Supplier"}
            </Text>
            <TouchableOpacity
              onPress={() => setPartyModalVisible(false)}
              className="w-10 h-10 items-center justify-center rounded-full bg-slate-100"
            >
              <Ionicons name="close" size={22} color="#334155" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={parties}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                className={`flex-row items-center p-4 rounded-2xl mb-3 border-2 ${
                  selectedParty?._id === item._id
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-100 bg-white"
                }`}
                onPress={() => handlePartySelect(item)}
              >
                <View
                  className={`w-12 h-12 rounded-xl items-center justify-center ${
                    item.type === "customer" ? "bg-emerald-100" : "bg-amber-100"
                  }`}
                >
                  <Ionicons
                    name={item.type === "customer" ? "person" : "business"}
                    size={24}
                    color={item.type === "customer" ? "#10B981" : "#F59E0B"}
                  />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-base font-semibold text-slate-800">
                    {item.name}
                  </Text>
                  {item.code && (
                    <Text className="text-sm text-slate-500">{item.code}</Text>
                  )}
                </View>
                {selectedParty?._id === item._id && (
                  <Ionicons name="checkmark-circle" size={24} color="#6366F1" />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="p-8 items-center">
                <View className="w-20 h-20 rounded-full bg-slate-100 items-center justify-center mb-4">
                  <Ionicons name="people-outline" size={40} color="#94A3B8" />
                </View>
                <Text className="text-slate-500 text-center mb-4">
                  No {invoiceType === "sale" ? "customers" : "suppliers"} found
                </Text>
                <TouchableOpacity
                  className="bg-indigo-600 px-6 py-3 rounded-xl"
                  onPress={() => {
                    setPartyModalVisible(false);
                    router.push("/parties/new");
                  }}
                >
                  <Text className="text-white font-semibold">
                    Create {invoiceType === "sale" ? "Customer" : "Supplier"}
                  </Text>
                </TouchableOpacity>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
