import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import { useActiveOrgId } from "@/hooks/use-organization";
import { useProducts, useDeleteProduct } from "@/hooks/use-products";
import { ScreenHeader } from "@/components/screen-header";
import type { Product } from "@/types/product";

export default function ProductsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { low_stock } = useLocalSearchParams<{ low_stock?: string }>();
  const organizationId = useActiveOrgId();

  const [search, setSearch] = useState("");
  const [showLowStock, setShowLowStock] = useState(low_stock === "true");

  const { data, isLoading, refetch, isRefetching } = useProducts({
    organization: organizationId || undefined,
    search: search.trim() || undefined,
    low_stock: showLowStock || undefined,
    limit: 100,
  });

  const deleteMutation = useDeleteProduct();

  const products = data?.products ?? [];

  const handleDelete = useCallback(
    (product: Product) => {
      Alert.alert(
        "Delete Product",
        `Delete "${product.name}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteMutation.mutate(product._id),
          },
        ],
      );
    },
    [deleteMutation],
  );

  const stockBadge = (p: Product) => {
    if (!p.track_inventory)
      return { text: "No tracking", color: colors.text.tertiary };
    if (p.current_stock <= 0)
      return { text: "Out of stock", color: colors.error };
    if (p.is_low_stock)
      return { text: `Low: ${p.current_stock}`, color: colors.warning };
    return { text: `${p.current_stock} ${p.unit}`, color: colors.success };
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title="Products"
        showBack
        rightAction={
          <TouchableOpacity
            onPress={() => router.push("/(app)/shop/products/new" as any)}
            style={{ padding: 6 }}
          >
            <Ionicons name="add-circle" size={28} color={colors.info} />
          </TouchableOpacity>
        }
      />

      {/* Search */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          margin: 12,
          marginBottom: 6,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 10,
          backgroundColor: colors.bg.secondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name="search" size={18} color={colors.text.tertiary} />
        <TextInput
          style={{
            flex: 1,
            marginLeft: 8,
            fontSize: 15,
            color: colors.text.primary,
          }}
          placeholder="Search name, SKU, barcode…"
          placeholderTextColor={colors.text.tertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter bar */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 12,
          marginBottom: 8,
          gap: 8,
        }}
      >
        <TouchableOpacity
          onPress={() => setShowLowStock(false)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 20,
            backgroundColor: !showLowStock ? colors.info : colors.bg.secondary,
            borderWidth: 1,
            borderColor: !showLowStock ? colors.info : colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: !showLowStock ? "#fff" : colors.text.secondary,
            }}
          >
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowLowStock(true)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 20,
            backgroundColor: showLowStock ? colors.error : colors.bg.secondary,
            borderWidth: 1,
            borderColor: showLowStock ? colors.error : colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: showLowStock ? "#fff" : colors.text.secondary,
            }}
          >
            ⚠ Low Stock
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={colors.info} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: 1,
                backgroundColor: colors.border,
                marginVertical: 2,
              }}
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 64 }}>
              <Ionicons
                name="cube-outline"
                size={56}
                color={colors.text.tertiary}
              />
              <Text
                style={{
                  color: colors.text.secondary,
                  marginTop: 14,
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                No Products Found
              </Text>
              <Text
                style={{
                  color: colors.text.tertiary,
                  marginTop: 6,
                  textAlign: "center",
                }}
              >
                {showLowStock
                  ? "No products are low on stock."
                  : "Tap + to add your first product."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const badge = stockBadge(item);
            return (
              <TouchableOpacity
                onPress={() =>
                  router.push(`/(app)/shop/products/${item._id}` as any)
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 14,
                  paddingHorizontal: 4,
                }}
                activeOpacity={0.75}
              >
                {/* Icon */}
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    backgroundColor: item.is_low_stock
                      ? colors.error + "18"
                      : colors.info + "18",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Ionicons
                    name="cube-outline"
                    size={24}
                    color={item.is_low_stock ? colors.error : colors.info}
                  />
                </View>

                {/* Details */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: colors.text.primary,
                    }}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 3 }}>
                    {item.sku ? (
                      <Text
                        style={{ fontSize: 12, color: colors.text.tertiary }}
                      >
                        {item.sku}
                      </Text>
                    ) : null}
                    <Text
                      style={{
                        fontSize: 12,
                        color: badge.color,
                        fontWeight: "600",
                      }}
                    >
                      {badge.text}
                    </Text>
                  </View>
                </View>

                {/* Price + actions */}
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: colors.text.primary,
                    }}
                  >
                    {item.sale_price.toLocaleString()}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={colors.error}
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
