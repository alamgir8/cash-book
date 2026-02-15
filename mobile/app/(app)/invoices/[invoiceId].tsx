import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { toast } from "@/lib/toast";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { exportInvoicePdf } from "@/services/reports";
import { getApiErrorMessage } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";
import {
  useInvoice,
  useUpdateInvoiceStatus,
  useRecordPayment,
  useDeleteInvoice,
} from "@/hooks/use-invoices";
import {
  InvoiceStatusBadge,
  InvoiceHeader,
  InvoiceItemsTable,
  InvoiceSummary,
  PaymentModal,
  InvoicePaymentsList,
} from "@/components/invoices";
import type { InvoiceStatus } from "@/types/invoice";
import { STATUS_TRANSITIONS } from "@/types/invoice";

export default function InvoiceDetailScreen() {
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const router = useRouter();

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Use custom hooks for data fetching and mutations
  const { data: invoice, isLoading, error, isError } = useInvoice(invoiceId);
  const statusMutation = useUpdateInvoiceStatus(invoiceId!);
  const paymentMutation = useRecordPayment(invoiceId!);
  const deleteMutation = useDeleteInvoice({
    onSuccess: () => router.back(),
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
      ],
    );
  };

  const handlePaymentSubmit = (paymentData: any) => {
    paymentMutation.mutate(
      {
        invoiceId: invoiceId!,
        ...paymentData,
      },
      {
        onSuccess: () => {
          setPaymentModalVisible(false);
        },
      },
    );
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
      ],
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

  const availableTransitions = invoice
    ? STATUS_TRANSITIONS[invoice.status] || []
    : [];

  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
        <ScreenHeader title="Invoice Details" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.info} />
        </View>
      </View>
    );
  }

  if (isError || !invoice) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
        <ScreenHeader title="Error" showBack />
        <View className="flex-1 items-center justify-center p-4">
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.error}
          />
          <Text
            className="text-lg font-semibold mt-4"
            style={{ color: colors.text.primary }}
          >
            Failed to load invoice
          </Text>
          <Text
            className="text-center mt-2"
            style={{ color: colors.text.secondary }}
          >
            {error ? getApiErrorMessage(error) : "Invoice not found"}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-6 px-6 py-3 rounded-lg"
            style={{ backgroundColor: colors.bg.tertiary }}
          >
            <Text
              className="font-medium"
              style={{ color: colors.text.primary }}
            >
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
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
        <View className="pb-24 p-4">
          {/* Status Badge and Type */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <View
                className={`w-12 h-12 rounded-xl items-center justify-center ${
                  invoice.type === "sale" ? "bg-green-100" : "bg-orange-100"
                }`}
              >
                <Ionicons
                  name={invoice.type === "sale" ? "arrow-up" : "arrow-down"}
                  size={24}
                  color={invoice.type === "sale" ? "#10B981" : "#F97316"}
                />
              </View>
              <Text className="ml-3 text-sm text-gray-600 capitalize">
                {invoice.type} Invoice
              </Text>
            </View>
            <InvoiceStatusBadge status={invoice.status} />
          </View>

          {/* Invoice Header */}
          <InvoiceHeader invoice={invoice} />

          {/* Amount Summary Card */}
          <View className="bg-white p-4 rounded-lg shadow-sm mb-4">
            <View className="flex-row justify-around">
              <View className="items-center">
                <Text className="text-xs text-gray-500 mb-1">Total</Text>
                <Text className="text-lg font-bold text-gray-900">
                  ৳{formatAmount(invoice.grand_total)}
                </Text>
              </View>
              <View className="w-px bg-gray-200" />
              <View className="items-center">
                <Text className="text-xs text-gray-500 mb-1">Paid</Text>
                <Text className="text-lg font-bold text-green-600">
                  ৳{formatAmount(invoice.amount_paid)}
                </Text>
              </View>
              <View className="w-px bg-gray-200" />
              <View className="items-center">
                <Text className="text-xs text-gray-500 mb-1">Balance</Text>
                <Text
                  className={`text-lg font-bold ${
                    invoice.balance_due > 0
                      ? "text-orange-600"
                      : "text-gray-600"
                  }`}
                >
                  ৳{formatAmount(invoice.balance_due)}
                </Text>
              </View>
            </View>

            {/* Record Payment Button */}
            {invoice.balance_due > 0 && invoice.status !== "cancelled" && (
              <TouchableOpacity
                className="mt-4 py-3 bg-blue-500 rounded-lg flex-row items-center justify-center"
                onPress={() => setPaymentModalVisible(true)}
              >
                <Ionicons name="wallet-outline" size={20} color="white" />
                <Text className="ml-2 text-white font-semibold">
                  Record Payment
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Invoice Items */}
          <InvoiceItemsTable items={invoice.items} />

          {/* Invoice Summary */}
          <InvoiceSummary invoice={invoice} />

          {/* Payments List */}
          {invoice.payments && invoice.payments.length > 0 && (
            <InvoicePaymentsList payments={invoice.payments} />
          )}

          {/* Notes */}
          {invoice.notes && (
            <View className="bg-white p-4 rounded-lg shadow-sm mb-4">
              <Text className="text-xs font-semibold text-gray-600 uppercase mb-2">
                Notes
              </Text>
              <Text className="text-sm text-gray-700">{invoice.notes}</Text>
            </View>
          )}

          {/* Terms */}
          {invoice.terms && (
            <View className="bg-white p-4 rounded-lg shadow-sm mb-4">
              <Text className="text-xs font-semibold text-gray-600 uppercase mb-2">
                Terms & Conditions
              </Text>
              <Text className="text-sm text-gray-700">{invoice.terms}</Text>
            </View>
          )}

          {/* Status Change Actions */}
          {availableTransitions.length > 0 && (
            <View className="bg-white p-4 rounded-lg shadow-sm mb-4">
              <Text className="text-xs font-semibold text-gray-600 uppercase mb-3">
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
                        status === "cancelled"
                          ? "text-red-600"
                          : "text-blue-600"
                      }`}
                    >
                      {status === "paid" ? "Mark as Paid" : status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Delete Invoice */}
          {invoice.status === "draft" && (
            <TouchableOpacity
              className="py-4 bg-red-50 rounded-lg border border-red-200"
              onPress={handleDelete}
            >
              <Text className="text-center text-red-600 font-medium">
                Delete Invoice
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Payment Modal */}
      <PaymentModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        onSubmit={handlePaymentSubmit}
        isSubmitting={paymentMutation.isPending}
        maxAmount={invoice.balance_due}
      />
    </View>
  );
}
