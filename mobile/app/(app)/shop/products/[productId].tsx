import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import {
  useProduct,
  useUpdateProduct,
  useDeleteProduct,
  useStockMovements,
  useAdjustStock,
} from "@/hooks/use-products";
import { BarcodeScannerModal } from "@/components/invoices/barcode-scanner-modal";
import { ScreenHeader } from "@/components/screen-header";
import type { ProductUnit, StockMovement } from "@/types/product";

const UNITS: ProductUnit[] = [
  "pcs",
  "kg",
  "g",
  "liter",
  "ml",
  "meter",
  "box",
  "pack",
  "dozen",
  "pair",
  "set",
  "bag",
  "bottle",
  "can",
  "carton",
];

type Tab = "details" | "stock";

export default function ProductDetailScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { colors } = useTheme();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [editing, setEditing] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState<ProductUnit>("pcs");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");
  const [trackInventory, setTrackInventory] = useState(true);
  const [isActive, setIsActive] = useState(true);

  // Adjust stock form
  const [adjustType, setAdjustType] = useState<
    "adjustment_in" | "adjustment_out"
  >("adjustment_in");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");

  const { data: product, isLoading } = useProduct(productId);
  const { data: movementsData } = useStockMovements(productId, { limit: 50 });

  const updateMutation = useUpdateProduct(productId!, {
    onSuccess: () => setEditing(false),
  });
  const deleteMutation = useDeleteProduct({ onSuccess: () => router.back() });
  const adjustMutation = useAdjustStock(productId!, {
    onSuccess: () => {
      setAdjustModalVisible(false);
      setAdjustQty("");
      setAdjustNotes("");
    },
  });

  // Populate form from product
  useEffect(() => {
    if (product) {
      setName(product.name);
      setSku(product.sku ?? "");
      setBarcode(product.barcode ?? "");
      setDescription(product.description ?? "");
      setUnit(product.unit);
      setPurchasePrice(String(product.purchase_price));
      setSalePrice(String(product.sale_price));
      setTaxRate(String(product.tax_rate));
      setLowStockThreshold(String(product.low_stock_threshold));
      setTrackInventory(product.track_inventory);
      setIsActive(product.is_active);
    }
  }, [product]);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      Alert.alert("Validation", "Product name is required.");
      return;
    }
    updateMutation.mutate({
      name: name.trim(),
      sku: sku.trim() || undefined,
      barcode: barcode.trim() || undefined,
      description: description.trim() || undefined,
      unit,
      purchase_price: parseFloat(purchasePrice) || 0,
      sale_price: parseFloat(salePrice) || 0,
      tax_rate: parseFloat(taxRate) || 0,
      low_stock_threshold: parseFloat(lowStockThreshold) || 0,
      track_inventory: trackInventory,
      is_active: isActive,
    });
  }, [
    name,
    sku,
    barcode,
    description,
    unit,
    purchasePrice,
    salePrice,
    taxRate,
    lowStockThreshold,
    trackInventory,
    isActive,
    updateMutation,
  ]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      "Delete Product",
      `Delete "${product?.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(productId!),
        },
      ],
    );
  }, [product, productId, deleteMutation]);

  const handleAdjust = useCallback(() => {
    const qty = parseFloat(adjustQty);
    if (!qty || qty <= 0) {
      Alert.alert("Validation", "Enter a valid quantity.");
      return;
    }
    adjustMutation.mutate({
      type: adjustType,
      quantity: qty,
      notes: adjustNotes.trim() || undefined,
    });
  }, [adjustQty, adjustType, adjustNotes, adjustMutation]);

  if (isLoading || !product) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.info} />
      </View>
    );
  }

  const movements: StockMovement[] = movementsData?.movements ?? [];

  const badge = () => {
    if (!product.track_inventory)
      return { text: "No tracking", color: colors.text.tertiary };
    if (product.current_stock <= 0)
      return { text: "Out of stock", color: colors.error };
    if (product.is_low_stock)
      return { text: `Low Stock`, color: colors.warning };
    return { text: "In Stock", color: colors.success };
  };

  const b = badge();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg.primary }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader
        title={editing ? "Edit Product" : product.name}
        showBack
        rightAction={
          editing ? (
            updateMutation.isPending ? (
              <ActivityIndicator color={colors.info} />
            ) : (
              <TouchableOpacity onPress={handleSave} style={{ padding: 6 }}>
                <Text
                  style={{
                    color: colors.info,
                    fontWeight: "700",
                    fontSize: 16,
                  }}
                >
                  Save
                </Text>
              </TouchableOpacity>
            )
          ) : (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <TouchableOpacity
                onPress={() => setEditing(true)}
                style={{ padding: 6 }}
              >
                <Ionicons name="pencil" size={22} color={colors.info} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={22} color={colors.error} />
              </TouchableOpacity>
            </View>
          )
        }
      />

      {/* Stock summary banner */}
      {!editing && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 16,
            backgroundColor: colors.bg.secondary,
            borderBottomWidth: 1,
            borderColor: colors.border,
            gap: 16,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: colors.text.tertiary }}>
              Current Stock
            </Text>
            <Text
              style={{
                fontSize: 26,
                fontWeight: "800",
                color: colors.text.primary,
              }}
            >
              {product.current_stock}{" "}
              <Text style={{ fontSize: 16, fontWeight: "500" }}>
                {product.unit}
              </Text>
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: b.color,
                marginTop: 2,
              }}
            >
              {b.text}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: colors.text.tertiary }}>
              Sale Price
            </Text>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "700",
                color: colors.text.primary,
              }}
            >
              {product.sale_price.toLocaleString()}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.text.tertiary,
                marginTop: 2,
              }}
            >
              Cost: {product.purchase_price.toLocaleString()}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setAdjustModalVisible(true)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: colors.info,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
              Adjust
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tabs */}
      {!editing && (
        <View
          style={{
            flexDirection: "row",
            borderBottomWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.bg.secondary,
          }}
        >
          {(["details", "stock"] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: "center",
                borderBottomWidth: 2,
                borderColor: activeTab === tab ? colors.info : "transparent",
              }}
            >
              <Text
                style={{
                  fontWeight: "600",
                  fontSize: 14,
                  color:
                    activeTab === tab ? colors.info : colors.text.secondary,
                  textTransform: "capitalize",
                }}
              >
                {tab === "stock" ? "Stock History" : "Details"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {editing ? (
          // ── Edit form ─────────────────────────────────────────────────────
          <>
            <Field label="Product Name *" colors={colors}>
              <TextInput
                style={inputStyle(colors)}
                value={name}
                onChangeText={setName}
              />
            </Field>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Field label="SKU" colors={colors} style={{ flex: 1 }}>
                <TextInput
                  style={inputStyle(colors)}
                  value={sku}
                  onChangeText={setSku}
                  autoCapitalize="characters"
                />
              </Field>
              <Field label="Barcode" colors={colors} style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TextInput
                    style={[inputStyle(colors), { flex: 1 }]}
                    value={barcode}
                    onChangeText={setBarcode}
                  />
                  <TouchableOpacity
                    onPress={() => setScannerVisible(true)}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: colors.info + "18",
                      borderWidth: 1,
                      borderColor: colors.info + "40",
                    }}
                  >
                    <Ionicons
                      name="barcode-outline"
                      size={20}
                      color={colors.info}
                    />
                  </TouchableOpacity>
                </View>
              </Field>
            </View>

            <Field label="Unit" colors={colors}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {UNITS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    onPress={() => setUnit(u)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 20,
                      backgroundColor:
                        unit === u ? colors.info : colors.bg.secondary,
                      borderWidth: 1,
                      borderColor: unit === u ? colors.info : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: unit === u ? "#fff" : colors.text.secondary,
                        fontWeight: "600",
                      }}
                    >
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Field>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Field label="Purchase Price" colors={colors} style={{ flex: 1 }}>
                <TextInput
                  style={inputStyle(colors)}
                  value={purchasePrice}
                  onChangeText={setPurchasePrice}
                  keyboardType="decimal-pad"
                />
              </Field>
              <Field label="Sale Price" colors={colors} style={{ flex: 1 }}>
                <TextInput
                  style={inputStyle(colors)}
                  value={salePrice}
                  onChangeText={setSalePrice}
                  keyboardType="decimal-pad"
                />
              </Field>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Field label="Tax Rate (%)" colors={colors} style={{ flex: 1 }}>
                <TextInput
                  style={inputStyle(colors)}
                  value={taxRate}
                  onChangeText={setTaxRate}
                  keyboardType="decimal-pad"
                />
              </Field>
              <Field
                label="Low Stock Alert"
                colors={colors}
                style={{ flex: 1 }}
              >
                <TextInput
                  style={inputStyle(colors)}
                  value={lowStockThreshold}
                  onChangeText={setLowStockThreshold}
                  keyboardType="decimal-pad"
                />
              </Field>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <ToggleRow
                label="Track Inventory"
                value={trackInventory}
                onChange={setTrackInventory}
                colors={colors}
              />
              <ToggleRow
                label="Active"
                value={isActive}
                onChange={setIsActive}
                colors={colors}
              />
            </View>
          </>
        ) : activeTab === "details" ? (
          // ── Details view ──────────────────────────────────────────────────
          <View style={{ gap: 12 }}>
            <InfoRow label="Name" value={product.name} colors={colors} />
            <InfoRow label="SKU" value={product.sku || "—"} colors={colors} />
            <InfoRow
              label="Barcode"
              value={product.barcode || "—"}
              colors={colors}
            />
            <InfoRow label="Unit" value={product.unit} colors={colors} />
            <InfoRow
              label="Purchase Price"
              value={product.purchase_price.toLocaleString()}
              colors={colors}
            />
            <InfoRow
              label="Sale Price"
              value={product.sale_price.toLocaleString()}
              colors={colors}
            />
            <InfoRow
              label="Tax Rate"
              value={`${product.tax_rate}%`}
              colors={colors}
            />
            <InfoRow
              label="Profit Margin"
              value={`${product.profit_margin}%`}
              colors={colors}
            />
            <InfoRow
              label="Low Stock Alert"
              value={
                product.low_stock_threshold > 0
                  ? `${product.low_stock_threshold} ${product.unit}`
                  : "Disabled"
              }
              colors={colors}
            />
            <InfoRow
              label="Track Inventory"
              value={product.track_inventory ? "Yes" : "No"}
              colors={colors}
            />
            <InfoRow
              label="Total Sold"
              value={`${product.total_sold} ${product.unit}`}
              colors={colors}
            />
            <InfoRow
              label="Total Purchased"
              value={`${product.total_purchased} ${product.unit}`}
              colors={colors}
            />
            {product.description ? (
              <InfoRow
                label="Description"
                value={product.description}
                colors={colors}
              />
            ) : null}
          </View>
        ) : // ── Stock history ──────────────────────────────────────────────────
        movements.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 48 }}>
            <Ionicons
              name="bar-chart-outline"
              size={48}
              color={colors.text.tertiary}
            />
            <Text style={{ color: colors.text.secondary, marginTop: 12 }}>
              No stock movements yet
            </Text>
          </View>
        ) : (
          <View style={{ gap: 2 }}>
            {movements.map((m) => {
              const isIn = m.quantity > 0;
              return (
                <View
                  key={m._id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: isIn
                        ? colors.success + "20"
                        : colors.error + "20",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Ionicons
                      name={isIn ? "arrow-up" : "arrow-down"}
                      size={18}
                      color={isIn ? colors.success : colors.error}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: colors.text.primary,
                        textTransform: "capitalize",
                      }}
                    >
                      {m.type.replace(/_/g, " ")}
                    </Text>
                    {m.notes ? (
                      <Text
                        style={{
                          fontSize: 12,
                          color: colors.text.tertiary,
                          marginTop: 1,
                        }}
                        numberOfLines={1}
                      >
                        {m.notes}
                      </Text>
                    ) : null}
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.text.tertiary,
                        marginTop: 1,
                      }}
                    >
                      {new Date(m.date).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        fontWeight: "700",
                        fontSize: 15,
                        color: isIn ? colors.success : colors.error,
                      }}
                    >
                      {isIn ? "+" : ""}
                      {m.quantity} {product.unit}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.text.tertiary }}>
                      After: {m.stock_after}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Barcode scanner */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={(code) => {
          setBarcode(code);
          setScannerVisible(false);
        }}
        title="Scan Barcode"
      />

      {/* Adjust stock modal */}
      <Modal
        visible={adjustModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAdjustModalVisible(false)}
      >
        <View
          style={{ flex: 1, backgroundColor: colors.bg.primary, padding: 20 }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 20,
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
              Adjust Stock
            </Text>
            <TouchableOpacity onPress={() => setAdjustModalVisible(false)}>
              <Ionicons name="close" size={26} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <Text
            style={{
              fontSize: 14,
              color: colors.text.secondary,
              marginBottom: 14,
            }}
          >
            Current stock:{" "}
            <Text style={{ fontWeight: "700", color: colors.text.primary }}>
              {product.current_stock} {product.unit}
            </Text>
          </Text>

          {/* Type */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            {(["adjustment_in", "adjustment_out"] as const).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setAdjustType(t)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: "center",
                  backgroundColor:
                    adjustType === t
                      ? t === "adjustment_in"
                        ? colors.success
                        : colors.error
                      : colors.bg.secondary,
                  borderWidth: 1,
                  borderColor:
                    adjustType === t
                      ? t === "adjustment_in"
                        ? colors.success
                        : colors.error
                      : colors.border,
                }}
              >
                <Ionicons
                  name={
                    t === "adjustment_in"
                      ? "add-circle-outline"
                      : "remove-circle-outline"
                  }
                  size={20}
                  color={adjustType === t ? "#fff" : colors.text.secondary}
                />
                <Text
                  style={{
                    marginTop: 4,
                    fontWeight: "600",
                    color: adjustType === t ? "#fff" : colors.text.secondary,
                    fontSize: 13,
                  }}
                >
                  {t === "adjustment_in" ? "Add Stock" : "Remove Stock"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field label="Quantity" colors={colors}>
            <TextInput
              style={inputStyle(colors)}
              value={adjustQty}
              onChangeText={setAdjustQty}
              placeholder="Enter quantity"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="decimal-pad"
              autoFocus
            />
          </Field>

          <Field label="Notes (optional)" colors={colors}>
            <TextInput
              style={inputStyle(colors)}
              value={adjustNotes}
              onChangeText={setAdjustNotes}
              placeholder="Reason for adjustment"
              placeholderTextColor={colors.text.tertiary}
            />
          </Field>

          <TouchableOpacity
            onPress={handleAdjust}
            disabled={adjustMutation.isPending}
            style={{
              backgroundColor: adjustMutation.isPending
                ? colors.bg.tertiary
                : colors.info,
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: "center",
              marginTop: 10,
            }}
          >
            {adjustMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                Confirm Adjustment
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── Reusable helpers ───────────────────────────────────────────────────────

function Field({
  label,
  children,
  colors,
  style,
}: {
  label: string;
  children: React.ReactNode;
  colors: any;
  style?: object;
}) {
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: colors.text.secondary,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function InfoRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 14, color: colors.text.secondary }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: colors.text.primary,
          flex: 1,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  colors: any;
}) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.bg.secondary,
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{ fontSize: 13, fontWeight: "600", color: colors.text.primary }}
      >
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.info, false: colors.border }}
        thumbColor={value ? "#fff" : "#aaa"}
      />
    </View>
  );
}

const inputStyle = (colors: any) => ({
  backgroundColor: colors.bg.secondary,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: colors.border,
  paddingHorizontal: 12,
  paddingVertical: 11,
  fontSize: 15,
  color: colors.text.primary,
});
