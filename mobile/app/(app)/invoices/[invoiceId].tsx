import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { toast } from "@/lib/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { invoicesApi, type InvoiceStatus } from "@/services/invoices";
import { exportInvoicePdf } from "@/services/reports";
import { getApiErrorMessage } from "@/lib/api";

const STATUS_COLORS: Record<InvoiceStatus, { bg: string; text: string }> = {
  draft: { bg: "bg-gray-100", text: "text-gray-600" },
  pending: { bg: "bg-yellow-100", text: "text-yellow-700" },
  partial: { bg: "bg-blue-100", text: "text-blue-700" },
  paid: { bg: "bg-green-100", text: "text-green-700" },
  cancelled: { bg: "bg-red-100", text: "text-red-700" },
  overdue: { bg: "bg-orange-100", text: "text-orange-700" },
};

const STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["pending", "cancelled"],
  pending: ["partial", "paid", "cancelled"],
  partial: ["paid", "cancelled"],
  paid: [],
  overdue: ["partial", "paid", "cancelled"],
  cancelled: [],
};

export default function InvoiceDetailScreen() {
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

  const {
    data: invoice,
    isLoading,
    error,
    isError,
  } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => invoicesApi.get(invoiceId!),
    enabled: !!invoiceId,
  });

  const statusMutation = useMutation({
    mutationFn: ({ status }: { status: InvoiceStatus }) =>
      invoicesApi.updateStatus(invoiceId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const paymentMutation = useMutation({
    mutationFn: invoicesApi.recordPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      setPaymentModalVisible(false);
      setPaymentAmount("");
      setPaymentReference("");
      toast.success("Payment recorded successfully");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: invoicesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice deleted successfully");
      router.back();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const handleStatusChange = (newStatus: InvoiceStatus) => {
    Alert.alert(
      "Change Status",
      `Are you sure you want to change status to "${newStatus}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => statusMutation.mutate({ status: newStatus }),
        },
      ]
    );
  };

  const handleRecordPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    paymentMutation.mutate({
      invoiceId: invoiceId!,
      amount,
      method: paymentMethod as any,
      reference: paymentReference.trim() || undefined,
    });
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Invoice",
      "Are you sure you want to delete this invoice? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(invoiceId!),
        },
      ]
    );
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await exportInvoicePdf(invoiceId!);
      toast.success("Invoice PDF exported successfully");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-white">
        <ScreenHeader title="Invoice Details" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </View>
    );
  }

  if (isError || !invoice) {
    return (
      <View className="flex-1 bg-white">
        <ScreenHeader title="Error" showBack />
        <View className="flex-1 items-center justify-center p-4">
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text className="text-lg font-semibold text-gray-900 mt-4">
            Failed to load invoice
          </Text>
          <Text className="text-gray-500 text-center mt-2">
            {error ? getApiErrorMessage(error) : "Invoice not found"}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-6 bg-gray-100 px-6 py-3 rounded-lg"
          >
            <Text className="text-gray-700 font-medium">Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const availableTransitions = STATUS_TRANSITIONS[invoice.status] || [];
  const statusColor = STATUS_COLORS[invoice.status] || STATUS_COLORS.draft;

  return (
    <View className="flex-1 bg-gray-50">
      <ScreenHeader
        title={invoice.invoice_number}
        showBack
        rightAction={
          <TouchableOpacity
            className="flex-row items-center bg-blue-500 px-3 py-1.5 rounded-lg"
            onPress={handleExportPdf}
            disabled={exportingPdf}
          >
            {exportingPdf ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="#ffffff" />
                <Text className="ml-1.5 text-sm font-semibold text-white">
                  Export
                </Text>
              </>
            )}
          </TouchableOpacity>
        }
      />

      <ScrollView className="flex-1">
        <View className="pb-24">
        {/* Header Card */}}
        <View className="bg-white p-6 border-b border-gray-100">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View
                className={`w-14 h-14 rounded-2xl items-center justify-center ${
                  invoice.type === "sale" ? "bg-green-100" : "bg-orange-100"
                }`}
              >
                <Ionicons
                  name={invoice.type === "sale" ? "arrow-up" : "arrow-down"}
                  size={28}
                  color={invoice.type === "sale" ? "#10B981" : "#F97316"}
                />
              </View>
              <View className="ml-3">
                <Text className="text-lg font-bold text-gray-900">
                  {invoice.invoice_number}
                </Text>
                <Text className="text-sm text-gray-500 capitalize">
                  {invoice.type} Invoice
                </Text>
              </View>
            </View>
            <View className={`px-3 py-1.5 rounded-full ${statusColor.bg}`}>
              <Text
                className={`text-sm font-medium capitalize ${statusColor.text}`}
              >
                {invoice.status}
              </Text>
            </View>
          </View>

          {/* Party Info */}
          {invoice.party && (
            <TouchableOpacity
              className="mt-4 p-3 bg-gray-50 rounded-xl flex-row items-center"
              onPress={() => router.push(`/parties/${invoice.party._id}`)}
            >
              <View
                className={`w-10 h-10 rounded-xl items-center justify-center ${
                  invoice.party.type === "customer"
                    ? "bg-green-100"
                    : "bg-orange-100"
                }`}
              >
                <Ionicons
                  name={
                    invoice.party.type === "customer" ? "person" : "storefront"
                  }
                  size={20}
                  color={
                    invoice.party.type === "customer" ? "#10B981" : "#F97316"
                  }
                />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-base font-medium text-gray-900">
                  {invoice.party.name}
                </Text>
                <Text className="text-sm text-gray-500">
                  {invoice.party.phone ||
                    invoice.party.email ||
                    invoice.party.code}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}

          {/* Amount Summary */}
          <View className="mt-4 p-4 bg-gray-50 rounded-xl">
            <View className="flex-row">
              <View className="flex-1">
                <Text className="text-sm text-gray-500">Total Amount</Text>
                <Text className="text-2xl font-bold text-gray-900 mt-1">
                  {formatAmount(invoice.grand_total)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm text-gray-500">Paid</Text>
                <Text className="text-xl font-semibold text-green-600 mt-1">
                  {formatAmount(invoice.amount_paid)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm text-gray-500">Balance</Text>
                <Text
                  className={`text-xl font-semibold mt-1 ${
                    invoice.balance_due > 0 ? "text-red-600" : "text-gray-600"
                  }`}
                >
                  {formatAmount(invoice.balance_due)}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          {invoice.balance_due > 0 && invoice.status !== "cancelled" && (
            <TouchableOpacity
              className="mt-4 py-3 bg-blue-500 rounded-xl flex-row items-center justify-center"
              onPress={() => {
                setPaymentAmount(invoice.balance_due.toString());
                setPaymentModalVisible(true);
              }}
            >
              <Ionicons name="wallet" size={20} color="white" />
              <Text className="ml-2 text-white font-semibold">
                Record Payment
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Dates */}
        <View className="bg-white p-4 mt-3 border-y border-gray-100">
          <View className="flex-row">
            <View className="flex-1">
              <Text className="text-sm text-gray-500">Invoice Date</Text>
              <Text className="text-base text-gray-900 mt-1">
                {formatDate(invoice.date)}
              </Text>
            </View>
            {invoice.due_date && (
              <View className="flex-1">
                <Text className="text-sm text-gray-500">Due Date</Text>
                <Text className="text-base text-gray-900 mt-1">
                  {formatDate(invoice.due_date)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Line Items */}
        <View className="bg-white p-4 mt-3 border-y border-gray-100">
          <Text className="text-sm font-semibold text-gray-900 mb-3">
            Line Items
          </Text>

          {invoice.items?.map((item, index) => (
            <View
              key={index}
              className={`py-3 ${
                index < (invoice.items?.length || 0) - 1
                  ? "border-b border-gray-100"
                  : ""
              }`}
            >
              <View className="flex-row justify-between">
                <Text className="text-base text-gray-900 flex-1">
                  {item.description}
                </Text>
                <Text className="text-base font-medium text-gray-900">
                  {formatAmount(item.total || item.quantity * item.unit_price)}
                </Text>
              </View>
              <Text className="text-sm text-gray-500 mt-1">
                {item.quantity} × {formatAmount(item.unit_price)}
                {item.tax_rate > 0 && ` (+${item.tax_rate}% tax)`}
              </Text>
            </View>
          ))}

          {/* Totals */}
          <View className="mt-4 pt-3 border-t border-gray-200">
            <View className="flex-row justify-between py-1">
              <Text className="text-sm text-gray-500">Subtotal</Text>
              <Text className="text-sm text-gray-900">
                {formatAmount(invoice.subtotal)}
              </Text>
            </View>
            {invoice.total_tax > 0 && (
              <View className="flex-row justify-between py-1">
                <Text className="text-sm text-gray-500">Tax</Text>
                <Text className="text-sm text-gray-900">
                  {formatAmount(invoice.total_tax)}
                </Text>
              </View>
            )}
            {invoice.total_discount > 0 && (
              <View className="flex-row justify-between py-1">
                <Text className="text-sm text-gray-500">Discount</Text>
                <Text className="text-sm text-red-600">
                  -{formatAmount(invoice.total_discount)}
                </Text>
              </View>
            )}
            <View className="flex-row justify-between py-2 border-t border-gray-100 mt-2">
              <Text className="text-base font-semibold text-gray-900">
                Total
              </Text>
              <Text className="text-lg font-bold text-gray-900">
                {formatAmount(invoice.grand_total)}
              </Text>
            </View>
          </View>
        </View>

        {/* Payments */}
        {invoice.payments && invoice.payments.length > 0 && (
          <View className="bg-white p-4 mt-3 border-y border-gray-100">
            <Text className="text-sm font-semibold text-gray-900 mb-3">
              Payments
            </Text>
            {invoice.payments.map((payment, index) => (
              <View
                key={index}
                className={`flex-row items-center py-3 ${
                  index < invoice.payments!.length - 1
                    ? "border-b border-gray-100"
                    : ""
                }`}
              >
                <View className="w-10 h-10 bg-green-100 rounded-xl items-center justify-center">
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-base text-gray-900">
                    {formatAmount(payment.amount)}
                  </Text>
                  <Text className="text-sm text-gray-500">
                    {formatDate(payment.date)} • {payment.method}
                    {payment.reference && ` • ${payment.reference}`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Notes */}
        {invoice.notes && (
          <View className="bg-white p-4 mt-3 border-y border-gray-100">
            <Text className="text-sm font-semibold text-gray-900 mb-2">
              Notes
            </Text>
            <Text className="text-base text-gray-600">{invoice.notes}</Text>
          </View>
        )}

        {/* Status Actions */}
        {availableTransitions.length > 0 && (
          <View className="bg-white p-4 mt-3 border-y border-gray-100">
            <Text className="text-sm font-semibold text-gray-900 mb-3">
              Change Status
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {availableTransitions.map((status) => (
                <TouchableOpacity
                  key={status}
                  className={`px-4 py-2 rounded-lg border ${
                    status === "cancelled"
                      ? "border-red-200 bg-red-50"
                      : "border-blue-200 bg-blue-50"
                  }`}
                  onPress={() => handleStatusChange(status)}
                >
                  <Text
                    className={`font-medium capitalize ${
                      status === "cancelled" ? "text-red-600" : "text-blue-600"
                    }`}
                  >
                    {status === "paid" ? "Mark as Paid" : status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Delete */}
        {invoice.status === "draft" && (
          <View className="p-4">
            <TouchableOpacity
              className="py-4 bg-red-50 rounded-xl border border-red-200"
              onPress={handleDelete}
            >
              <Text className="text-center text-red-600 font-medium">
                Delete Invoice
              </Text>
            </TouchableOpacity>
          </View>
        )}}
        </View>
      </ScrollView>

      {/* Payment Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View className="flex-1 bg-white">
          <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
            <Text className="text-lg font-semibold text-gray-900">
              Record Payment
            </Text>
            <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4">
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Amount *
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xl text-gray-900 font-semibold"
                placeholder="0.00"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
              <Text className="text-sm text-gray-500 mt-1">
                Balance due: {formatAmount(invoice.balance_due)}
              </Text>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Payment Method
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {["cash", "bank", "card", "upi", "cheque", "other"].map(
                  (method) => (
                    <TouchableOpacity
                      key={method}
                      className={`px-4 py-2 rounded-lg border ${
                        paymentMethod === method
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-white"
                      }`}
                      onPress={() => setPaymentMethod(method)}
                    >
                      <Text
                        className={`capitalize ${
                          paymentMethod === method
                            ? "text-blue-600"
                            : "text-gray-600"
                        }`}
                      >
                        {method}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Reference (Optional)
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
                placeholder="Transaction ID, cheque number, etc."
                value={paymentReference}
                onChangeText={setPaymentReference}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <TouchableOpacity
              className={`py-4 rounded-xl ${
                paymentMutation.isPending ? "bg-blue-300" : "bg-blue-500"
              }`}
              onPress={handleRecordPayment}
              disabled={paymentMutation.isPending}
            >
              {paymentMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-center text-white font-semibold text-base">
                  Record Payment
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
