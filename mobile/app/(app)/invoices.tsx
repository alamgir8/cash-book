import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../components/screen-header";
import { useActiveOrgId } from "../../hooks/useOrganization";
import {
  invoicesApi,
  type InvoiceType,
  type InvoiceStatus,
} from "../../services/invoices";

const TYPE_TABS: { value: InvoiceType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sale", label: "Sales" },
  { value: "purchase", label: "Purchase" },
];

const STATUS_OPTIONS: {
  value: InvoiceStatus | "all";
  label: string;
  color: string;
}[] = [
  { value: "all", label: "All", color: "bg-gray-100 text-gray-600" },
  { value: "draft", label: "Draft", color: "bg-gray-100 text-gray-600" },
  {
    value: "pending",
    label: "Pending",
    color: "bg-yellow-100 text-yellow-700",
  },
  {
    value: "partial",
    label: "Partial",
    color: "bg-blue-100 text-blue-700",
  },
  { value: "paid", label: "Paid", color: "bg-green-100 text-green-700" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-700" },
];

const getStatusColor = (status: InvoiceStatus) => {
  switch (status) {
    case "draft":
      return "bg-gray-100 text-gray-600";
    case "pending":
      return "bg-yellow-100 text-yellow-700";
    case "partial":
      return "bg-blue-100 text-blue-700";
    case "paid":
      return "bg-green-100 text-green-700";
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "overdue":
      return "bg-orange-100 text-orange-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

export default function InvoicesScreen() {
  const router = useRouter();
  const organizationId = useActiveOrgId();

  const [activeType, setActiveType] = useState<InvoiceType | "all">("all");
  const [activeStatus, setActiveStatus] = useState<InvoiceStatus | "all">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["invoices", organizationId, activeType, activeStatus],
    queryFn: () =>
      invoicesApi.list({
        organization: organizationId || undefined,
        type: activeType === "all" ? undefined : activeType,
        status: activeStatus === "all" ? undefined : activeStatus,
      }),
  });

  const invoices = useMemo(() => {
    const list = data?.invoices || [];
    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase();
    return list.filter(
      (inv) =>
        inv.invoice_number.toLowerCase().includes(query) ||
        inv.party?.name?.toLowerCase().includes(query)
    );
  }, [data?.invoices, searchQuery]);

  const formatAmount = (amount: number) => {
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleCreateInvoice = useCallback(
    (type: InvoiceType) => {
      router.push(`/invoices/new?type=${type}`);
    },
    [router]
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <ScreenHeader title="Invoices" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScreenHeader
        title="Invoices"
        showBack
        rightAction={
          <View className="flex-row">
            <TouchableOpacity
              className="p-2 mr-1"
              onPress={() => handleCreateInvoice("sale")}
            >
              <Ionicons name="add-circle" size={28} color="#10B981" />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Search Bar */}
      <View className="px-4 py-2 bg-white border-b border-gray-100">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            className="flex-1 ml-2 text-base text-gray-900"
            placeholder="Search by invoice # or party..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Type Tabs */}
      <View className="flex-row bg-white border-b border-gray-100 px-4 py-2">
        {TYPE_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.value}
            className={`mr-2 px-4 py-2 rounded-full ${
              activeType === tab.value ? "bg-blue-500" : "bg-gray-100"
            }`}
            onPress={() => setActiveType(tab.value)}
          >
            <Text
              className={`text-sm font-medium ${
                activeType === tab.value ? "text-white" : "text-gray-600"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="bg-white border-b border-gray-100 py-2"
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {STATUS_OPTIONS.map((status) => (
          <TouchableOpacity
            key={status.value}
            className={`mr-2 px-3 py-1.5 rounded-full border ${
              activeStatus === status.value
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white"
            }`}
            onPress={() => setActiveStatus(status.value)}
          >
            <Text
              className={`text-xs font-medium ${
                activeStatus === status.value
                  ? "text-blue-600"
                  : "text-gray-500"
              }`}
            >
              {status.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {invoices.length === 0 ? (
          <View className="p-8 items-center">
            <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
            <Text className="text-lg font-medium text-gray-500 mt-4">
              No Invoices Found
            </Text>
            <Text className="text-sm text-gray-400 text-center mt-2">
              Create sales or purchase invoices to track your business
              transactions.
            </Text>
            <View className="flex-row mt-6 gap-3">
              <TouchableOpacity
                className="bg-green-500 px-5 py-3 rounded-lg"
                onPress={() => handleCreateInvoice("sale")}
              >
                <Text className="text-white font-medium">Sales Invoice</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-orange-500 px-5 py-3 rounded-lg"
                onPress={() => handleCreateInvoice("purchase")}
              >
                <Text className="text-white font-medium">Purchase Invoice</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View className="px-4 py-4">
            {invoices.map((invoice) => (
              <TouchableOpacity
                key={invoice._id}
                className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm"
                onPress={() => router.push(`/invoices/${invoice._id}`)}
              >
                <View className="flex-row items-start">
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
                  <View className="flex-1 ml-3">
                    <View className="flex-row items-center">
                      <Text className="text-base font-semibold text-gray-900 flex-1">
                        {invoice.invoice_number}
                      </Text>
                      <View
                        className={`px-2 py-0.5 rounded-full ${
                          getStatusColor(invoice.status).split(" ")[0]
                        }`}
                      >
                        <Text
                          className={`text-xs font-medium capitalize ${
                            getStatusColor(invoice.status).split(" ")[1]
                          }`}
                        >
                          {invoice.status}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-sm text-gray-500 mt-0.5">
                      {invoice.party?.name || "No party"}
                    </Text>
                    <Text className="text-xs text-gray-400 mt-1">
                      {formatDate(invoice.date)}
                      {invoice.due_date &&
                        ` • Due: ${formatDate(invoice.due_date)}`}
                    </Text>
                  </View>
                </View>

                <View className="flex-row mt-3 pt-3 border-t border-gray-100">
                  <View className="flex-1">
                    <Text className="text-xs text-gray-500">Total</Text>
                    <Text className="text-base font-bold text-gray-900">
                      {formatAmount(invoice.grand_total)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-gray-500">Paid</Text>
                    <Text className="text-base font-medium text-green-600">
                      {formatAmount(invoice.amount_paid)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-gray-500">Balance</Text>
                    <Text
                      className={`text-base font-medium ${
                        invoice.balance_due > 0
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}
                    >
                      {formatAmount(invoice.balance_due)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
