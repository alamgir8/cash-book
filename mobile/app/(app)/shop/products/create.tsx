import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Switch,
  ScrollView,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import { useActiveOrgId } from "@/hooks/use-organization";
import { useCreateProduct } from "@/hooks/use-products";
import { BarcodeScannerModal } from "@/components/invoices/barcode-scanner-modal";
import { ScreenHeader } from "@/components/screen-header";
import type { ProductUnit } from "@/types/product";
import { amountInputProps } from "@/lib/amount-input";
import { useKeyboardFooterLift } from "@/hooks/use-keyboard-footer-lift";

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

export default function CreateProductScreen() {
  const { colors } = useTheme();
  const { footerContainerStyle, scrollProps } = useKeyboardFooterLift();
  const router = useRouter();
  const organizationId = useActiveOrgId();

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState<ProductUnit>("pcs");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [openingStock, setOpeningStock] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("0");
  const [trackInventory, setTrackInventory] = useState(true);
  const [scannerVisible, setScannerVisible] = useState(false);

  const mutation = useCreateProduct({
    onSuccess: () => router.back(),
  });

  const handleScan = useCallback((scannedBarcode: string) => {
    setBarcode(scannedBarcode);
    setScannerVisible(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!name.trim()) {
      Alert.alert("Validation", "Product name is required.");
      return;
    }
    mutation.mutate({
      organization: organizationId || undefined,
      name: name.trim(),
      sku: sku.trim() || undefined,
      barcode: barcode.trim() || undefined,
      description: description.trim() || undefined,
      unit,
      purchase_price: parseFloat(purchasePrice) || 0,
      sale_price: parseFloat(salePrice) || 0,
      tax_rate: parseFloat(taxRate) || 0,
      current_stock: parseFloat(openingStock) || 0,
      low_stock_threshold: parseFloat(lowStockThreshold) || 0,
      track_inventory: trackInventory,
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
    openingStock,
    lowStockThreshold,
    trackInventory,
    organizationId,
    mutation,
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader title="Add Product" showBack />

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        {...scrollProps}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      >
        {/* Basic Info */}
        <SectionTitle title="Basic Information" colors={colors} />

        <Field label="Product Name *" colors={colors}>
          <TextInput
            style={inputStyle(colors)}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Basmati Rice 5kg"
            placeholderTextColor={colors.text.tertiary}
          />
        </Field>

        <Field label="SKU (auto-generated if blank)" colors={colors}>
          <TextInput
            style={inputStyle(colors)}
            value={sku}
            onChangeText={setSku}
            placeholder="e.g. RICE001"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="characters"
          />
        </Field>

        <Field label="Barcode" colors={colors}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={[inputStyle(colors), { flex: 1 }]}
              value={barcode}
              onChangeText={setBarcode}
              placeholder="Scan or enter manually"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="default"
            />
            <TouchableOpacity
              onPress={() => setScannerVisible(true)}
              style={{
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: colors.info + "18",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.info + "40",
              }}
            >
              <Ionicons name="barcode-outline" size={24} color={colors.info} />
            </TouchableOpacity>
          </View>
        </Field>

        <Field label="Description" colors={colors}>
          <TextInput
            style={[
              inputStyle(colors),
              { height: 72, textAlignVertical: "top" },
            ]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional notes about this product"
            placeholderTextColor={colors.text.tertiary}
            multiline
          />
        </Field>

        {/* Unit */}
        <SectionTitle title="Unit" colors={colors} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        >
          {UNITS.map((u) => (
            <TouchableOpacity
              key={u}
              onPress={() => setUnit(u)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: unit === u ? colors.info : colors.bg.secondary,
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

        {/* Pricing */}
        <SectionTitle title="Pricing" colors={colors} />

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Field label="Purchase Price" colors={colors} style={{ flex: 1 }}>
            <TextInput
              style={inputStyle(colors)}
              value={purchasePrice}
              onChangeText={setPurchasePrice}
              placeholder="0.00"
              placeholderTextColor={colors.text.tertiary}
              {...amountInputProps}
            />
          </Field>
          <Field label="Sale Price" colors={colors} style={{ flex: 1 }}>
            <TextInput
              style={inputStyle(colors)}
              value={salePrice}
              onChangeText={setSalePrice}
              placeholder="0.00"
              placeholderTextColor={colors.text.tertiary}
              {...amountInputProps}
            />
          </Field>
        </View>

        <Field label="Tax Rate (%)" colors={colors}>
          <TextInput
            style={inputStyle(colors)}
            value={taxRate}
            onChangeText={setTaxRate}
            placeholder="0"
            placeholderTextColor={colors.text.tertiary}
            {...amountInputProps}
          />
        </Field>

        {/* Inventory */}
        <SectionTitle title="Inventory" colors={colors} />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.bg.secondary,
            borderRadius: 10,
            padding: 14,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.text.primary,
              }}
            >
              Track Inventory
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.text.tertiary,
                marginTop: 2,
              }}
            >
              Automatically update stock on invoices
            </Text>
          </View>
          <Switch
            value={trackInventory}
            onValueChange={setTrackInventory}
            trackColor={{ true: colors.info, false: colors.border }}
            thumbColor={trackInventory ? "#fff" : "#aaa"}
          />
        </View>

        {trackInventory && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Field label="Opening Stock" colors={colors} style={{ flex: 1 }}>
              <TextInput
                style={inputStyle(colors)}
                value={openingStock}
                onChangeText={setOpeningStock}
                placeholder="0"
                placeholderTextColor={colors.text.tertiary}
                {...amountInputProps}
              />
            </Field>
            <Field label="Low Stock Alert" colors={colors} style={{ flex: 1 }}>
              <TextInput
                style={inputStyle(colors)}
                value={lowStockThreshold}
                onChangeText={setLowStockThreshold}
                placeholder="0"
                placeholderTextColor={colors.text.tertiary}
                {...amountInputProps}
              />
            </Field>
          </View>
        )}

      </KeyboardAwareScrollView>

      <View
        style={{
          ...footerContainerStyle,
          borderTopColor: colors.border,
          backgroundColor: colors.bg.primary,
        }}
      >
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={mutation.isPending}
          className="rounded-2xl py-4 items-center shadow-lg"
          style={{
            backgroundColor: colors.info,
            opacity: mutation.isPending ? 0.7 : 1,
          }}
        >
          {mutation.isPending ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator color="#fff" />
              <Text className="text-white font-bold text-base">Saving…</Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <Text className="text-white font-bold text-base">
                Save Product
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScan}
        title="Scan Product Barcode"
      />
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function SectionTitle({ title, colors }: { title: string; colors: any }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: "700",
        color: colors.text.tertiary,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        marginTop: 20,
        marginBottom: 10,
      }}
    >
      {title}
    </Text>
  );
}

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
        className="text-sm font-semibold mb-2"
        style={{ color: colors.text.primary }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

const inputStyle = (colors: any) => ({
  backgroundColor: colors.bg.tertiary,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: colors.border,
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 16,
  color: colors.text.primary,
  minHeight: 48,
});
