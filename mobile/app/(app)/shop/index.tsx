import React, { useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import { useActiveOrgId } from "@/hooks/use-organization";
import { useProductStats } from "@/hooks/use-products";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invoicesApi } from "@/services/invoices";
import { ScreenHeader } from "@/components/screen-header";
import { refreshAppData } from "@/lib/refresh-app-data";

function StatCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  onPress,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={{
        flex: 1,
        minWidth: "47%",
        backgroundColor: colors.bg.secondary,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 10,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: iconBg,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "800",
          color: colors.text.primary,
        }}
      >
        {value}
      </Text>
      <Text
        style={{ fontSize: 12, color: colors.text.secondary, marginTop: 2 }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function ShopDashboard() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizationId = useActiveOrgId();

  const { data: stats, isLoading: statsLoading } = useProductStats(
    organizationId || undefined,
  );

  // Today's sales & purchases summary
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

  const { data: saleSummary, isLoading: saleLoading } = useQuery({
    queryKey: ["invoices", "summary", organizationId, "today-sale"],
    queryFn: () =>
      invoicesApi.getSummary({
        organization: organizationId || undefined,
        type: "sale",
        startDate: startOfDay,
        endDate: endOfDay,
      }),
  });

  const { data: purchaseSummary, isLoading: purchaseLoading } = useQuery({
    queryKey: ["invoices", "summary", organizationId, "today-purchase"],
    queryFn: () =>
      invoicesApi.getSummary({
        organization: organizationId || undefined,
        type: "purchase",
        startDate: startOfDay,
        endDate: endOfDay,
      }),
  });

  const isRefreshing = statsLoading || saleLoading || purchaseLoading;

  const onRefresh = useCallback(() => {
    void refreshAppData(queryClient);
  }, [queryClient]);

  const fmt = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader title="Shop" showBack={false} />

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* Quick Actions */}
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: colors.text.tertiary,
            marginBottom: 10,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          Quick Actions
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => router.push("/(app)/invoices/new?type=sale")}
            style={{
              flex: 1,
              backgroundColor: colors.success,
              borderRadius: 12,
              padding: 14,
              alignItems: "center",
              gap: 6,
            }}
          >
            <Ionicons name="arrow-up-circle" size={28} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
              New Sale
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(app)/invoices/new?type=purchase")}
            style={{
              flex: 1,
              backgroundColor: colors.warning,
              borderRadius: 12,
              padding: 14,
              alignItems: "center",
              gap: 6,
            }}
          >
            <Ionicons name="arrow-down-circle" size={28} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
              New Purchase
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(app)/shop/products/new" as any)}
            style={{
              flex: 1,
              backgroundColor: colors.info,
              borderRadius: 12,
              padding: 14,
              alignItems: "center",
              gap: 6,
            }}
          >
            <Ionicons name="add-circle" size={28} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
              Add Product
            </Text>
          </TouchableOpacity>
        </View>

        {/* Today's Summary */}
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: colors.text.tertiary,
            marginBottom: 10,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          Today
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 20,
          }}
        >
          {saleLoading ? (
            <ActivityIndicator color={colors.info} />
          ) : (
            <StatCard
              label="Today's Sales"
              value={fmt(saleSummary?.sales?.total ?? 0)}
              icon="trending-up"
              iconBg={colors.success + "20"}
              iconColor={colors.success}
              onPress={() => router.push("/(app)/shop/products" as any)}
            />
          )}
          {purchaseLoading ? (
            <ActivityIndicator color={colors.info} />
          ) : (
            <StatCard
              label="Today's Purchases"
              value={fmt(purchaseSummary?.purchases?.total ?? 0)}
              icon="trending-down"
              iconBg={colors.warning + "20"}
              iconColor={colors.warning}
              onPress={() =>
                router.push("/(app)/invoices?type=purchase" as any)
              }
            />
          )}
        </View>

        {/* Inventory */}
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: colors.text.tertiary,
            marginBottom: 10,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          Inventory
        </Text>
        {statsLoading ? (
          <ActivityIndicator color={colors.info} style={{ marginTop: 20 }} />
        ) : (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <StatCard
              label="Total Products"
              value={stats?.total_products ?? 0}
              icon="cube"
              iconBg={colors.info + "20"}
              iconColor={colors.info}
              onPress={() => router.push("/(app)/shop/products")}
            />
            <StatCard
              label="Low Stock"
              value={stats?.low_stock_count ?? 0}
              icon="warning"
              iconBg={colors.error + "20"}
              iconColor={colors.error}
              onPress={() =>
                router.push("/(app)/shop/products?low_stock=true" as any)
              }
            />
            <StatCard
              label="Stock Value (Cost)"
              value={fmt(stats?.stock_purchase_value ?? 0)}
              icon="wallet"
              iconBg={colors.warning + "20"}
              iconColor={colors.warning}
            />
            <StatCard
              label="Potential Profit"
              value={fmt(stats?.potential_profit ?? 0)}
              icon="cash"
              iconBg={colors.success + "20"}
              iconColor={colors.success}
            />
          </View>
        )}

        {/* Shortcuts */}
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: colors.text.tertiary,
            marginBottom: 10,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          Shortcuts
        </Text>
        {[
          {
            label: "All Products",
            icon: "cube-outline" as const,
            route: "/(app)/shop/products",
          },
          {
            label: "Sales Invoices",
            icon: "receipt-outline" as const,
            route: "/(app)/invoices?type=sale",
          },
          {
            label: "Purchase Invoices",
            icon: "document-text-outline" as const,
            route: "/(app)/invoices?type=purchase",
          },
          {
            label: "Parties / Suppliers",
            icon: "people-outline" as const,
            route: "/(app)/parties",
          },
        ].map((item) => (
          <TouchableOpacity
            key={item.label}
            onPress={() => router.push(item.route as any)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.bg.secondary,
              borderRadius: 12,
              padding: 14,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons
              name={item.icon}
              size={22}
              color={colors.info}
              style={{ marginRight: 12 }}
            />
            <Text
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: "500",
                color: colors.text.primary,
              }}
            >
              {item.label}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
