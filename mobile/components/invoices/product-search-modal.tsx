import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import { useProducts } from "@/hooks/use-products";
import { useActiveOrgId } from "@/hooks/use-organization";
import type { Product } from "@/types/product";

interface ProductSearchModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called when user selects a product */
  onSelect: (product: Product) => void;
  invoiceType?: "sale" | "purchase";
}

export function ProductSearchModal({
  visible,
  onClose,
  onSelect,
  invoiceType,
}: ProductSearchModalProps) {
  const { colors } = useTheme();
  const organizationId = useActiveOrgId();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useProducts({
    organization: organizationId || undefined,
    search: search.trim() || undefined,
    is_active: true,
    limit: 100,
  });

  const products = useMemo(() => data?.products ?? [], [data]);

  const handleSelect = useCallback(
    (product: Product) => {
      onSelect(product);
      setSearch("");
      onClose();
    },
    [onSelect, onClose],
  );

  const formatStock = (p: Product) => {
    if (!p.track_inventory) return "No tracking";
    const stock = p.current_stock;
    if (stock <= 0) return "Out of stock";
    if (p.is_low_stock) return `Low: ${stock} ${p.unit}`;
    return `${stock} ${p.unit}`;
  };

  const stockColor = (p: Product) => {
    if (!p.track_inventory) return colors.text.tertiary;
    if (p.current_stock <= 0) return colors.error;
    if (p.is_low_stock) return colors.warning;
    return colors.success;
  };

  const price = (p: Product) =>
    invoiceType === "purchase" ? p.purchase_price : p.sale_price;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 16,
            borderBottomWidth: 1,
            borderColor: colors.border,
            paddingTop: 24,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 18,
              fontWeight: "700",
              color: colors.text.primary,
            }}
          >
            Select Product
          </Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Ionicons name="close" size={26} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            margin: 12,
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
            placeholder="Search by name, SKU, or barcode…"
            placeholderTextColor={colors.text.tertiary}
            value={search}
            onChangeText={setSearch}
            autoFocus
            returnKeyType="search"
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
            contentContainerStyle={{ padding: 12, paddingTop: 4 }}
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  marginVertical: 4,
                }}
              />
            )}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingTop: 48 }}>
                <Ionicons
                  name="cube-outline"
                  size={48}
                  color={colors.text.tertiary}
                />
                <Text
                  style={{
                    color: colors.text.secondary,
                    marginTop: 12,
                    fontSize: 15,
                  }}
                >
                  {search ? "No products found" : "No products yet"}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelect(item)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                }}
                activeOpacity={0.7}
              >
                {/* Icon */}
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: colors.info + "18",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="cube-outline" size={22} color={colors.info} />
                </View>

                {/* Info */}
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
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 2,
                      gap: 8,
                    }}
                  >
                    {item.sku && (
                      <Text
                        style={{ fontSize: 12, color: colors.text.tertiary }}
                      >
                        {item.sku}
                      </Text>
                    )}
                    <Text style={{ fontSize: 12, color: stockColor(item) }}>
                      {formatStock(item)}
                    </Text>
                  </View>
                </View>

                {/* Price */}
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: colors.text.primary,
                    }}
                  >
                    {price(item).toLocaleString()}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.text.tertiary }}>
                    per {item.unit}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );
}
