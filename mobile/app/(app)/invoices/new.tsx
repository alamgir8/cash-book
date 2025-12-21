import React, { useState, useCallback } from "react";
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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../../components/screen-header";
import { useActiveOrgId } from "../../../hooks/useOrganization";
import { invoicesApi, type InvoiceType } from "../../../services/invoices";
import { partiesApi, type Party } from "../../../services/parties";
import { getApiErrorMessage } from "../../../lib/api";

type LineItemForm = {
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
};

const emptyLineItem: LineItemForm = {
  description: "",
  quantity: "1",
  unit_price: "",
  tax_rate: "0",
};

export default function NewInvoiceScreen() {
  const { type: typeParam, partyId: partyIdParam } = useLocalSearchParams<{
    type?: string;
    partyId?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizationId = useActiveOrgId();

  const invoiceType: InvoiceType =
    typeParam === "purchase" ? "purchase" : "sales";

  const [party, setParty] = useState<Party | null>(null);
  const [partyModalVisible, setPartyModalVisible] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItemForm[]>([
    { ...emptyLineItem },
  ]);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
    "percentage"
  );
  const [discountValue, setDiscountValue] = useState("");

  // Load party if partyId is provided
  const { data: preSelectedParty } = useQuery({
    queryKey: ["party", partyIdParam],
    queryFn: () => partiesApi.get(partyIdParam!),
    enabled: !!partyIdParam,
  });

  // Set party when preselected party loads
  React.useEffect(() => {
    if (preSelectedParty && !party) {
      setParty(preSelectedParty);
    }
  }, [preSelectedParty, party]);

  // Load parties for selection
  const { data: partiesData } = useQuery({
    queryKey: [
      "parties",
      organizationId,
      invoiceType === "sales" ? "customer" : "supplier",
    ],
    queryFn: () =>
      partiesApi.list({
        organization: organizationId || undefined,
        type: invoiceType === "sales" ? "customer" : "supplier",
      }),
  });

  const parties = partiesData?.parties || [];

  const mutation = useMutation({
    mutationFn: invoicesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      Alert.alert("Success", "Invoice created successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (error) => {
      Alert.alert("Error", getApiErrorMessage(error));
    },
  });

  const calculateLineTotal = (item: LineItemForm) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    const taxRate = parseFloat(item.tax_rate) || 0;
    const subtotal = qty * price;
    const tax = subtotal * (taxRate / 100);
    return subtotal + tax;
  };

  const calculateTotals = useCallback(() => {
    let subtotal = 0;
    let totalTax = 0;

    lineItems.forEach((item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const taxRate = parseFloat(item.tax_rate) || 0;
      const lineSubtotal = qty * price;
      subtotal += lineSubtotal;
      totalTax += lineSubtotal * (taxRate / 100);
    });

    let discountAmount = 0;
    const discountVal = parseFloat(discountValue) || 0;
    if (discountType === "percentage") {
      discountAmount = subtotal * (discountVal / 100);
    } else {
      discountAmount = discountVal;
    }

    const total = subtotal + totalTax - discountAmount;

    return { subtotal, totalTax, discountAmount, total };
  }, [lineItems, discountType, discountValue]);

  const totals = calculateTotals();

  const addLineItem = () => {
    setLineItems([...lineItems, { ...emptyLineItem }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (
    index: number,
    field: keyof LineItemForm,
    value: string
  ) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleSubmit = () => {
    if (!party) {
      Alert.alert("Error", "Please select a party");
      return;
    }

    const validLineItems = lineItems.filter(
      (item) => item.description.trim() && parseFloat(item.unit_price) > 0
    );

    if (validLineItems.length === 0) {
      Alert.alert(
        "Error",
        "Please add at least one line item with description and price"
      );
      return;
    }

    const items = validLineItems.map((item) => ({
      description: item.description.trim(),
      quantity: parseFloat(item.quantity) || 1,
      unit_price: parseFloat(item.unit_price) || 0,
      tax_rate: parseFloat(item.tax_rate) || 0,
    }));

    mutation.mutate({
      type: invoiceType,
      party: party._id,
      invoice_date: invoiceDate,
      due_date: dueDate || undefined,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      items,
      discount_type: discountType,
      discount_value: parseFloat(discountValue) || 0,
      organization: organizationId || undefined,
    });
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScreenHeader
        title={
          invoiceType === "sales" ? "New Sales Invoice" : "New Purchase Invoice"
        }
        showBack
      />

      <ScrollView className="flex-1 p-4">
        {/* Invoice Type Indicator */}
        <View
          className={`p-3 rounded-xl mb-4 ${
            invoiceType === "sales" ? "bg-green-50" : "bg-orange-50"
          }`}
        >
          <View className="flex-row items-center">
            <Ionicons
              name={
                invoiceType === "sales"
                  ? "arrow-up-circle"
                  : "arrow-down-circle"
              }
              size={24}
              color={invoiceType === "sales" ? "#10B981" : "#F97316"}
            />
            <Text
              className={`ml-2 font-medium ${
                invoiceType === "sales" ? "text-green-700" : "text-orange-700"
              }`}
            >
              {invoiceType === "sales" ? "Sales Invoice" : "Purchase Invoice"}
            </Text>
          </View>
        </View>

        {/* Party Selection */}
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            {invoiceType === "sales" ? "Customer" : "Supplier"} *
          </Text>
          <TouchableOpacity
            className="flex-row items-center p-3 bg-gray-50 rounded-lg border border-gray-200"
            onPress={() => setPartyModalVisible(true)}
          >
            {party ? (
              <>
                <View className="w-10 h-10 bg-blue-100 rounded-xl items-center justify-center">
                  <Ionicons
                    name={invoiceType === "sales" ? "person" : "storefront"}
                    size={20}
                    color="#3B82F6"
                  />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-base font-medium text-gray-900">
                    {party.name}
                  </Text>
                  <Text className="text-sm text-gray-500">{party.code}</Text>
                </View>
              </>
            ) : (
              <>
                <Ionicons name="person-add" size={20} color="#9CA3AF" />
                <Text className="ml-2 text-gray-400">
                  Select {invoiceType === "sales" ? "customer" : "supplier"}...
                </Text>
              </>
            )}
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Dates */}
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Invoice Date *
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
                placeholder="YYYY-MM-DD"
                value={invoiceDate}
                onChangeText={setInvoiceDate}
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Due Date
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
                placeholder="YYYY-MM-DD"
                value={dueDate}
                onChangeText={setDueDate}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
          <View className="mt-3">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Reference
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
              placeholder="PO number, order ref, etc."
              value={reference}
              onChangeText={setReference}
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Line Items */}
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-semibold text-gray-900">
              Line Items
            </Text>
            <TouchableOpacity
              className="flex-row items-center"
              onPress={addLineItem}
            >
              <Ionicons name="add-circle" size={20} color="#3B82F6" />
              <Text className="ml-1 text-sm text-blue-500 font-medium">
                Add
              </Text>
            </TouchableOpacity>
          </View>

          {lineItems.map((item, index) => (
            <View
              key={index}
              className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100"
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium text-gray-600">
                  Item {index + 1}
                </Text>
                {lineItems.length > 1 && (
                  <TouchableOpacity onPress={() => removeLineItem(index)}>
                    <Ionicons name="trash" size={18} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-900 mb-2"
                placeholder="Description"
                value={item.description}
                onChangeText={(v) => updateLineItem(index, "description", v)}
                placeholderTextColor="#9CA3AF"
              />

              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 mb-1">Qty</Text>
                  <TextInput
                    className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-900"
                    placeholder="1"
                    value={item.quantity}
                    onChangeText={(v) => updateLineItem(index, "quantity", v)}
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 mb-1">Price</Text>
                  <TextInput
                    className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-900"
                    placeholder="0.00"
                    value={item.unit_price}
                    onChangeText={(v) => updateLineItem(index, "unit_price", v)}
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 mb-1">Tax %</Text>
                  <TextInput
                    className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-900"
                    placeholder="0"
                    value={item.tax_rate}
                    onChangeText={(v) => updateLineItem(index, "tax_rate", v)}
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View className="flex-row justify-end mt-2">
                <Text className="text-sm text-gray-600">
                  Total:{" "}
                  <Text className="font-medium">
                    {formatAmount(calculateLineTotal(item))}
                  </Text>
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Discount */}
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
          <Text className="text-sm font-semibold text-gray-900 mb-3">
            Discount
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-row flex-1 bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
              <TouchableOpacity
                className={`flex-1 py-3 ${
                  discountType === "percentage" ? "bg-blue-500" : "bg-gray-50"
                }`}
                onPress={() => setDiscountType("percentage")}
              >
                <Text
                  className={`text-center font-medium ${
                    discountType === "percentage"
                      ? "text-white"
                      : "text-gray-600"
                  }`}
                >
                  %
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-3 ${
                  discountType === "fixed" ? "bg-blue-500" : "bg-gray-50"
                }`}
                onPress={() => setDiscountType("fixed")}
              >
                <Text
                  className={`text-center font-medium ${
                    discountType === "fixed" ? "text-white" : "text-gray-600"
                  }`}
                >
                  Fixed
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
              placeholder="0"
              value={discountValue}
              onChangeText={setDiscountValue}
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Totals */}
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
          <View className="flex-row justify-between py-2">
            <Text className="text-sm text-gray-500">Subtotal</Text>
            <Text className="text-sm text-gray-900">
              {formatAmount(totals.subtotal)}
            </Text>
          </View>
          <View className="flex-row justify-between py-2">
            <Text className="text-sm text-gray-500">Tax</Text>
            <Text className="text-sm text-gray-900">
              {formatAmount(totals.totalTax)}
            </Text>
          </View>
          {totals.discountAmount > 0 && (
            <View className="flex-row justify-between py-2">
              <Text className="text-sm text-gray-500">Discount</Text>
              <Text className="text-sm text-red-600">
                -{formatAmount(totals.discountAmount)}
              </Text>
            </View>
          )}
          <View className="flex-row justify-between py-3 border-t border-gray-100 mt-2">
            <Text className="text-base font-semibold text-gray-900">Total</Text>
            <Text className="text-lg font-bold text-gray-900">
              {formatAmount(totals.total)}
            </Text>
          </View>
        </View>

        {/* Notes */}
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
          <Text className="text-sm font-medium text-gray-700 mb-1">Notes</Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
            placeholder="Additional notes..."
            value={notes}
            onChangeText={setNotes}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          className={`py-4 rounded-xl mb-8 ${
            mutation.isPending ? "bg-blue-300" : "bg-blue-500"
          }`}
          onPress={handleSubmit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-center text-white font-semibold text-base">
              Create Invoice
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Party Selection Modal */}
      <Modal
        visible={partyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
            <Text className="text-lg font-semibold text-gray-900">
              Select {invoiceType === "sales" ? "Customer" : "Supplier"}
            </Text>
            <TouchableOpacity onPress={() => setPartyModalVisible(false)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={parties}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="flex-row items-center p-4 bg-gray-50 rounded-xl mb-2"
                onPress={() => {
                  setParty(item);
                  setPartyModalVisible(false);
                }}
              >
                <View
                  className={`w-10 h-10 rounded-xl items-center justify-center ${
                    item.type === "customer" ? "bg-green-100" : "bg-orange-100"
                  }`}
                >
                  <Ionicons
                    name={item.type === "customer" ? "person" : "storefront"}
                    size={20}
                    color={item.type === "customer" ? "#10B981" : "#F97316"}
                  />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-base font-medium text-gray-900">
                    {item.name}
                  </Text>
                  <Text className="text-sm text-gray-500">{item.code}</Text>
                </View>
                {party?._id === item._id && (
                  <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="p-8 items-center">
                <Text className="text-gray-500">No parties found</Text>
                <TouchableOpacity
                  className="mt-4 bg-blue-500 px-4 py-2 rounded-lg"
                  onPress={() => {
                    setPartyModalVisible(false);
                    router.push("/parties/new");
                  }}
                >
                  <Text className="text-white font-medium">
                    Create {invoiceType === "sales" ? "Customer" : "Supplier"}
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
