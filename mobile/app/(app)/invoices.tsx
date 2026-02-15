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
import { ScreenHeader } from "@/components/screen-header";
import { useActiveOrgId, useOrganization } from "@/hooks/useOrganization";
import { useTheme } from "@/hooks/useTheme";
import {
  invoicesApi,
  type InvoiceType,
  type InvoiceStatus,
} from "@/services/invoices";

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
  const { canManageInvoices, canCreateInvoices, canViewInvoices } =
    useOrganization();

  const [activeType, setActiveType] = useState<InvoiceType | "all">("all");
  const [activeStatus, setActiveStatus] = useState<InvoiceStatus | "all">(
    "all",
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
        inv.party?.name?.toLowerCase().includes(query),
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
    [router],
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-white">
        <ScreenHeader title="Invoices" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </View>
    );
  }

  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title="Invoices"
        showBack
        rightAction={
          canCreateInvoices ? (
            <View className="flex-row">
              <TouchableOpacity
                className="p-2 mr-1"
                onPress={() => handleCreateInvoice("sale")}
              >
                <Ionicons name="add-circle" size={28} color={colors.success} />
              </TouchableOpacity>
            </View>
          ) : undefined
        }
      />

      {/* Search Bar */}
      <View
        className="px-4 py-2 border-b"
        style={{
          backgroundColor: colors.bg.secondary,
          borderColor: colors.border,
        }}
      >
        <View
          className="flex-row items-center rounded-lg px-3 py-2"
          style={{ backgroundColor: colors.bg.tertiary }}
        >
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            className="flex-1 ml-2 text-base"
            style={{
              color: colors.text.primary,
            }}
            placeholder="Search by invoice # or party..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.text.tertiary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Type Tabs */}
      <View
        className="flex-row border-b px-4 py-2"
        style={{
          backgroundColor: colors.bg.secondary,
          borderColor: colors.border,
        }}
      >
        {TYPE_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.value}
            className="mr-2 px-4 py-2 rounded-full"
            style={{
              backgroundColor:
                activeType === tab.value ? colors.info : colors.bg.tertiary,
            }}
            onPress={() => setActiveType(tab.value)}
          >
            <Text
              className="text-sm font-medium"
              style={{
                color:
                  activeType === tab.value ? "white" : colors.text.secondary,
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status Filters */}
      <View
        className="border-b py-2"
        style={{
          backgroundColor: colors.bg.secondary,
          borderColor: colors.border,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {STATUS_OPTIONS.map((status) => (
            <TouchableOpacity
              key={status.value}
              className="mr-2 px-3 py-1.5 rounded-full border"
              style={{
                borderColor:
                  activeStatus === status.value ? colors.info : colors.border,
                backgroundColor:
                  activeStatus === status.value
                    ? colors.info + "15"
                    : colors.bg.secondary,
              }}
              onPress={() => setActiveStatus(status.value)}
            >
              <Text
                className="text-xs font-medium"
                style={{
                  color:
                    activeStatus === status.value
                      ? colors.info
                      : colors.text.secondary,
                }}
              >
                {status.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {invoices.length === 0 ? (
          <View className="p-8 items-center">
            <Ionicons
              name="receipt-outline"
              size={64}
              color={colors.text.tertiary}
            />
            <Text
              className="text-lg font-medium mt-4"
              style={{ color: colors.text.secondary }}
            >
              No Invoices Found
            </Text>
            <Text
              className="text-sm text-center mt-2"
              style={{ color: colors.text.tertiary }}
            >
              {canManageInvoices
                ? "Create sales or purchase invoices to track your business transactions."
                : "No invoices available. Contact your organization admin to create invoices."}
            </Text>
            {canManageInvoices && (
              <View className="flex-row mt-6 gap-3">
                <TouchableOpacity
                  className="px-5 py-3 rounded-lg"
                  style={{ backgroundColor: colors.success }}
                  onPress={() => handleCreateInvoice("sale")}
                >
                  <Text className="text-white font-medium">Sales Invoice</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="px-5 py-3 rounded-lg"
                  style={{ backgroundColor: colors.warning }}
                  onPress={() => handleCreateInvoice("purchase")}
                >
                  <Text className="text-white font-medium">
                    Purchase Invoice
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View className="px-4 py-4">
            {invoices.map((invoice) => (
              <TouchableOpacity
                key={invoice._id}
                className="rounded-xl p-4 mb-3 border shadow-sm"
                style={{
                  backgroundColor: colors.bg.secondary,
                  borderColor: colors.border,
                }}
                onPress={() => router.push(`/invoices/${invoice._id}`)}
              >
                <View className="flex-row items-start">
                  <View
                    className="w-12 h-12 rounded-xl items-center justify-center"
                    style={{
                      backgroundColor:
                        invoice.type === "sale"
                          ? colors.success + "20"
                          : colors.warning + "20",
                    }}
                  >
                    <Ionicons
                      name={invoice.type === "sale" ? "arrow-up" : "arrow-down"}
                      size={24}
                      color={
                        invoice.type === "sale"
                          ? colors.success
                          : colors.warning
                      }
                    />
                  </View>
                  <View className="flex-1 ml-3">
                    <View className="flex-row items-center">
                      <Text
                        className="text-base font-semibold flex-1"
                        style={{ color: colors.text.primary }}
                      >
                        {invoice.invoice_number}
                      </Text>
                      <View
                        className="px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor:
                            invoice.status === "paid"
                              ? colors.success + "20"
                              : invoice.status === "pending"
                                ? colors.warning + "20"
                                : invoice.status === "partial"
                                  ? colors.info + "20"
                                  : invoice.status === "cancelled"
                                    ? colors.error + "20"
                                    : colors.bg.tertiary,
                        }}
                      >
                        <Text
                          className="text-xs font-medium capitalize"
                          style={{
                            color:
                              invoice.status === "paid"
                                ? colors.success
                                : invoice.status === "pending"
                                  ? colors.warning
                                  : invoice.status === "partial"
                                    ? colors.info
                                    : invoice.status === "cancelled"
                                      ? colors.error
                                      : colors.text.secondary,
                          }}
                        >
                          {invoice.status}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className="text-sm mt-0.5"
                      style={{ color: colors.text.secondary }}
                    >
                      {invoice.party?.name || "No party"}
                    </Text>
                    <Text
                      className="text-xs mt-1"
                      style={{ color: colors.text.tertiary }}
                    >
                      {formatDate(invoice.date)}
                      {invoice.due_date &&
                        ` • Due: ${formatDate(invoice.due_date)}`}
                    </Text>
                  </View>
                </View>

                <View
                  className="flex-row mt-3 pt-3 border-t"
                  style={{ borderColor: colors.border }}
                >
                  <View className="flex-1">
                    <Text
                      className="text-xs"
                      style={{ color: colors.text.secondary }}
                    >
                      Total
                    </Text>
                    <Text
                      className="text-base font-bold"
                      style={{ color: colors.text.primary }}
                    >
                      {formatAmount(invoice.grand_total)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-xs"
                      style={{ color: colors.text.secondary }}
                    >
                      Paid
                    </Text>
                    <Text
                      className="text-base font-medium"
                      style={{ color: colors.success }}
                    >
                      {formatAmount(invoice.amount_paid)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-xs"
                      style={{ color: colors.text.secondary }}
                    >
                      Balance
                    </Text>
                    <Text
                      className="text-base font-medium"
                      style={{
                        color:
                          invoice.balance_due > 0
                            ? colors.error
                            : colors.text.secondary,
                      }}
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
    </View>
  );
}
