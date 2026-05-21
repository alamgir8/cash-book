import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { refreshAppData } from "@/lib/refresh-app-data";
import { useActiveOrgId, useOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import {
  invoicesApi,
  type InvoiceType,
  type InvoiceStatus,
} from "@/services/invoices";

const TYPE_TABS: {
  value: InvoiceType | "all";
  label: string;
  icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
}[] = [
  { value: "all", label: "All", icon: "documents-outline" },
  { value: "sale", label: "Sales", icon: "arrow-up-circle-outline" },
  { value: "purchase", label: "Purchase", icon: "arrow-down-circle-outline" },
];

const STATUS_OPTIONS: { value: InvoiceStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#F3F4F6", text: "#6B7280" },
  pending: { bg: "#FEF3C7", text: "#D97706" },
  partial: { bg: "#DBEAFE", text: "#2563EB" },
  paid: { bg: "#D1FAE5", text: "#059669" },
  cancelled: { bg: "#FEE2E2", text: "#DC2626" },
  all: { bg: "#E5E7EB", text: "#374151" },
};

export default function InvoicesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizationId = useActiveOrgId();
  const { canManageInvoices, canCreateInvoices } = useOrganization();

  const [activeType, setActiveType] = useState<InvoiceType | "all">("all");
  const [activeStatus, setActiveStatus] = useState<InvoiceStatus | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const { data, isLoading, isRefetching } = useQuery({
    queryKey: ["invoices", organizationId, activeType, activeStatus],
    queryFn: () =>
      invoicesApi.list({
        organization: organizationId || undefined,
        type: activeType === "all" ? undefined : activeType,
        status: activeStatus === "all" ? undefined : activeStatus,
      }),
  });

  const { colors } = useTheme();

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
      setCreateModalVisible(false);
      router.push(`/invoices/new?type=${type}`);
    },
    [router],
  );

  if (isLoading) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
        <ScreenHeader title="Invoices" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            className="mt-3 text-sm"
            style={{ color: colors.text.secondary }}
          >
            Loading invoices…
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title="Invoices"
        showBack
        rightAction={
          canCreateInvoices ? (
            <TouchableOpacity
              onPress={() => setCreateModalVisible(true)}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Search Bar */}
      <View
        className="px-4 pt-3 pb-2"
        style={{ backgroundColor: colors.bg.primary }}
      >
        <View
          className="flex-row items-center rounded-2xl px-4 py-3 border"
          style={{
            backgroundColor: colors.bg.secondary,
            borderColor: colors.border,
          }}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.text.tertiary}
          />
          <TextInput
            className="flex-1 ml-2 text-base"
            style={{ color: colors.text.primary }}
            placeholder="Search invoice # or party…"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.text.tertiary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Type Tabs — segmented control style */}
      <View
        style={{
          flexDirection: "row",
          marginHorizontal: 16,
          marginBottom: 8,
          padding: 4,
          borderRadius: 16,
          backgroundColor: colors.bg.secondary,
        }}
      >
        {TYPE_TABS.map((tab) => {
          const isActive = activeType === tab.value;
          return (
            <TouchableOpacity
              key={tab.value}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 9,
                borderRadius: 12,
                gap: 5,
                backgroundColor: isActive ? colors.primary : "transparent",
              }}
              onPress={() => setActiveType(tab.value)}
            >
              <Ionicons
                name={tab.icon}
                size={15}
                color={isActive ? "#fff" : colors.text.secondary}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: isActive ? "#fff" : colors.text.secondary,
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Status Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 10,
          paddingTop: 4,
          gap: 8,
          alignItems: "center",
        }}
      >
        {STATUS_OPTIONS.map((s) => {
          const isActive = activeStatus === s.value;
          const sc = STATUS_COLORS[s.value] ?? STATUS_COLORS.all;
          return (
            <TouchableOpacity
              key={s.value}
              className="px-4 py-1.5 rounded-full border"
              style={{
                borderColor: isActive ? colors.primary : colors.border,
                backgroundColor: isActive ? sc.bg : colors.bg.secondary,
              }}
              onPress={() => setActiveStatus(s.value)}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: isActive ? sc.text : colors.text.secondary }}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refreshAppData(queryClient)}
            tintColor={colors.primary}
          />
        }
      >
        {invoices.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8 pt-16">
            <View
              className="w-24 h-24 rounded-3xl items-center justify-center mb-6"
              style={{ backgroundColor: colors.primary + "15" }}
            >
              <Ionicons
                name="receipt-outline"
                size={48}
                color={colors.primary}
              />
            </View>
            <Text
              className="text-xl font-bold text-center"
              style={{ color: colors.text.primary }}
            >
              No Invoices Found
            </Text>
            <Text
              className="text-sm text-center mt-2 leading-5"
              style={{ color: colors.text.secondary }}
            >
              {canManageInvoices
                ? "Create your first invoice to start tracking business transactions."
                : "No invoices yet. Contact your admin to create invoices."}
            </Text>
            {canManageInvoices && (
              <View className="flex-row mt-8 gap-3">
                <TouchableOpacity
                  className="flex-1 flex-row items-center justify-center py-3.5 rounded-2xl gap-2"
                  style={{ backgroundColor: colors.success }}
                  onPress={() => handleCreateInvoice("sale")}
                >
                  <Ionicons name="arrow-up-circle" size={20} color="#fff" />
                  <Text className="text-white font-bold">Sales Invoice</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 flex-row items-center justify-center py-3.5 rounded-2xl gap-2"
                  style={{ backgroundColor: colors.warning }}
                  onPress={() => handleCreateInvoice("purchase")}
                >
                  <Ionicons name="arrow-down-circle" size={20} color="#fff" />
                  <Text className="text-white font-bold">Purchase</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View className="px-4 pt-2">
            <Text
              className="text-xs font-medium mb-3 uppercase tracking-wider"
              style={{ color: colors.text.tertiary }}
            >
              {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
            </Text>
            {invoices.map((invoice) => {
              const isSale = invoice.type === "sale";
              const sc = STATUS_COLORS[invoice.status] ?? STATUS_COLORS.draft;
              return (
                <TouchableOpacity
                  key={invoice._id}
                  className="rounded-2xl mb-3 overflow-hidden border"
                  style={{
                    backgroundColor: colors.bg.secondary,
                    borderColor: colors.border,
                  }}
                  onPress={() => router.push(`/invoices/${invoice._id}`)}
                  activeOpacity={0.7}
                >
                  {/* Colored left accent */}
                  <View className="flex-row">
                    <View
                      className="w-1 self-stretch rounded-l-2xl"
                      style={{
                        backgroundColor: isSale
                          ? colors.success
                          : colors.warning,
                      }}
                    />
                    <View className="flex-1 p-4">
                      {/* Row 1: icon + invoice# + status badge */}
                      <View className="flex-row items-center mb-2">
                        <View
                          className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                          style={{
                            backgroundColor: isSale
                              ? colors.success + "18"
                              : colors.warning + "18",
                          }}
                        >
                          <Ionicons
                            name={isSale ? "arrow-up" : "arrow-down"}
                            size={20}
                            color={isSale ? colors.success : colors.warning}
                          />
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-sm font-bold"
                            style={{ color: colors.text.primary }}
                          >
                            {invoice.invoice_number}
                          </Text>
                          <Text
                            className="text-xs mt-0.5"
                            style={{ color: colors.text.secondary }}
                          >
                            {invoice.party?.name || "—"}
                          </Text>
                        </View>
                        <View
                          className="px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: sc.bg }}
                        >
                          <Text
                            className="text-xs font-semibold capitalize"
                            style={{ color: sc.text }}
                          >
                            {invoice.status}
                          </Text>
                        </View>
                      </View>

                      {/* Row 2: date | type chip */}
                      <View className="flex-row items-center mb-3">
                        <Ionicons
                          name="calendar-outline"
                          size={12}
                          color={colors.text.tertiary}
                        />
                        <Text
                          className="text-xs ml-1"
                          style={{ color: colors.text.tertiary }}
                        >
                          {formatDate(invoice.date)}
                          {invoice.due_date &&
                            ` · Due ${formatDate(invoice.due_date)}`}
                        </Text>
                        <View
                          className="ml-2 px-2 py-0.5 rounded-md"
                          style={{
                            backgroundColor: isSale
                              ? colors.success + "15"
                              : colors.warning + "15",
                          }}
                        >
                          <Text
                            className="text-xs font-medium"
                            style={{
                              color: isSale ? colors.success : colors.warning,
                            }}
                          >
                            {isSale ? "Sale" : "Purchase"}
                          </Text>
                        </View>
                      </View>

                      {/* Row 3: amounts */}
                      <View
                        className="flex-row rounded-xl overflow-hidden"
                        style={{ backgroundColor: colors.bg.tertiary }}
                      >
                        <View
                          className="flex-1 py-2.5 items-center border-r"
                          style={{ borderColor: colors.border }}
                        >
                          <Text
                            className="text-xs"
                            style={{ color: colors.text.tertiary }}
                          >
                            Total
                          </Text>
                          <Text
                            className="text-sm font-bold mt-0.5"
                            style={{ color: colors.text.primary }}
                          >
                            ৳{formatAmount(invoice.grand_total)}
                          </Text>
                        </View>
                        <View
                          className="flex-1 py-2.5 items-center border-r"
                          style={{ borderColor: colors.border }}
                        >
                          <Text
                            className="text-xs"
                            style={{ color: colors.text.tertiary }}
                          >
                            Paid
                          </Text>
                          <Text
                            className="text-sm font-bold mt-0.5"
                            style={{ color: colors.success }}
                          >
                            ৳{formatAmount(invoice.amount_paid)}
                          </Text>
                        </View>
                        <View className="flex-1 py-2.5 items-center">
                          <Text
                            className="text-xs"
                            style={{ color: colors.text.tertiary }}
                          >
                            Due
                          </Text>
                          <Text
                            className="text-sm font-bold mt-0.5"
                            style={{
                              color:
                                invoice.balance_due > 0
                                  ? colors.error
                                  : colors.text.secondary,
                            }}
                          >
                            ৳{formatAmount(invoice.balance_due)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Create Invoice Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <TouchableOpacity
          className="flex-1"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          activeOpacity={1}
          onPress={() => setCreateModalVisible(false)}
        />
        <View
          className="rounded-t-3xl px-5 pt-5 pb-10"
          style={{ backgroundColor: colors.bg.primary }}
        >
          <View
            className="w-12 h-1.5 rounded-full self-center mb-5"
            style={{ backgroundColor: colors.border }}
          />
          <Text
            className="text-xl font-bold mb-2"
            style={{ color: colors.text.primary }}
          >
            Create Invoice
          </Text>
          <Text
            className="text-sm mb-6"
            style={{ color: colors.text.secondary }}
          >
            Choose the type of invoice to create
          </Text>

          <TouchableOpacity
            className="flex-row items-center p-5 rounded-2xl mb-3"
            style={{
              backgroundColor: colors.success + "15",
              borderWidth: 1,
              borderColor: colors.success + "40",
            }}
            onPress={() => handleCreateInvoice("sale")}
          >
            <View
              className="w-14 h-14 rounded-2xl items-center justify-center"
              style={{ backgroundColor: colors.success }}
            >
              <Ionicons name="arrow-up-circle" size={30} color="#fff" />
            </View>
            <View className="ml-4 flex-1">
              <Text
                className="text-base font-bold"
                style={{ color: colors.success }}
              >
                Sales Invoice
              </Text>
              <Text
                className="text-sm mt-0.5"
                style={{ color: colors.text.secondary }}
              >
                Invoice for goods/services sold to a customer
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.success} />
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center p-5 rounded-2xl"
            style={{
              backgroundColor: colors.warning + "15",
              borderWidth: 1,
              borderColor: colors.warning + "40",
            }}
            onPress={() => handleCreateInvoice("purchase")}
          >
            <View
              className="w-14 h-14 rounded-2xl items-center justify-center"
              style={{ backgroundColor: colors.warning }}
            >
              <Ionicons name="arrow-down-circle" size={30} color="#fff" />
            </View>
            <View className="ml-4 flex-1">
              <Text
                className="text-base font-bold"
                style={{ color: colors.warning }}
              >
                Purchase Invoice
              </Text>
              <Text
                className="text-sm mt-0.5"
                style={{ color: colors.text.secondary }}
              >
                Invoice for goods/services purchased from a supplier
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.warning} />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}
