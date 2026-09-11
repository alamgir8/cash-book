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
import { useTranslation } from "@/hooks/use-translation";
import type { StockMovement } from "@/types/product";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  PRODUCT_UNIT_VALUES,
  adjustStockSchema,
  productEditSchema,
  type AdjustStockFormData,
  type ProductEditFormData,
} from "@/lib/validations/shop";
import {
  normalizeAmountInput,
  parseAmountInput,
} from "@/lib/amount-input";

type Tab = "details" | "stock";

export default function ProductDetailScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [editing, setEditing] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);

  // ── Edit form (Zod-validated) ──────────────────────────────────────────
  const {
    control,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductEditFormData>({
    resolver: zodResolver(productEditSchema),
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      description: "",
      unit: "pcs",
      purchase_price: "",
      additional_cost: "",
      sale_price: "",
      tax_rate: "0",
      low_stock_threshold: "0",
      track_inventory: true,
      is_active: true,
    },
  });

  const unit = watch("unit");
  const trackInventory = watch("track_inventory");
  const isActive = watch("is_active");

  // ── Adjust stock form (Zod-validated) ─────────────────────────────────
  const {
    control: adjustControl,
    handleSubmit: handleAdjustSubmit,
    reset: resetAdjust,
    setValue: setAdjustValue,
    watch: watchAdjust,
    formState: { errors: adjustErrors },
  } = useForm<AdjustStockFormData>({
    resolver: zodResolver(adjustStockSchema),
    defaultValues: {
      type: "adjustment_in",
      quantity: "",
      unit_cost: "",
      notes: "",
    },
  });

  const adjustType = watchAdjust("type");

  const { data: product, isLoading } = useProduct(productId);
  const { data: movementsData } = useStockMovements(productId, { limit: 50 });

  const updateMutation = useUpdateProduct(productId!, {
    onSuccess: () => setEditing(false),
  });
  const deleteMutation = useDeleteProduct({ onSuccess: () => router.back() });
  const adjustMutation = useAdjustStock(productId!, {
    onSuccess: () => {
      setAdjustModalVisible(false);
      resetAdjust();
    },
  });

  // Populate form from product
  useEffect(() => {
    if (product) {
      resetEdit({
        name: product.name,
        sku: product.sku ?? "",
        barcode: product.barcode ?? "",
        description: product.description ?? "",
        unit: product.unit,
        purchase_price: String(product.purchase_price),
        additional_cost: String(product.additional_cost ?? 0),
        sale_price: String(product.sale_price),
        tax_rate: String(product.tax_rate),
        low_stock_threshold: String(product.low_stock_threshold),
        track_inventory: product.track_inventory,
        is_active: product.is_active,
      });
    }
  }, [product, resetEdit]);

  const onSaveProduct = useCallback(
    (data: ProductEditFormData) => {
      updateMutation.mutate({
        name: data.name.trim(),
        sku: data.sku?.trim() || undefined,
        barcode: data.barcode?.trim() || undefined,
        description: data.description?.trim() || undefined,
        unit: data.unit,
        purchase_price: parseAmountInput(data.purchase_price),
        additional_cost: parseAmountInput(data.additional_cost),
        sale_price: parseAmountInput(data.sale_price),
        tax_rate: parseAmountInput(data.tax_rate),
        low_stock_threshold: parseAmountInput(data.low_stock_threshold),
        track_inventory: data.track_inventory,
        is_active: data.is_active,
      });
    },
    [updateMutation],
  );

  const handleDelete = useCallback(() => {
    Alert.alert(
      t("deleteProductTitle"),
      t("deleteProductMessage", { name: product?.name ?? "" }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: () => deleteMutation.mutate(productId!),
        },
      ],
    );
  }, [product, productId, deleteMutation]);

  const onAdjustStock = useCallback(
    (data: AdjustStockFormData) => {
      adjustMutation.mutate({
        type: data.type,
        quantity: parseAmountInput(data.quantity),
        unit_cost: data.unit_cost ? parseAmountInput(data.unit_cost) : undefined,
        notes: data.notes?.trim() || undefined,
      });
    },
    [adjustMutation],
  );

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
      return { text: t("noTracking"), color: colors.text.tertiary };
    if (product.current_stock <= 0)
      return { text: t("outOfStock"), color: colors.error };
    if (product.is_low_stock)
      return { text: t("lowStock"), color: colors.warning };
    return { text: t("inStock"), color: colors.success };
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
              <TouchableOpacity
                onPress={handleEditSubmit(onSaveProduct)}
                style={{ padding: 6 }}
              >
                <Text
                  style={{
                    color: colors.info,
                    fontWeight: "700",
                    fontSize: 16,
                  }}
                >
                  {t("save")}
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
              {t("currentStock")}
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
              {t("salePrice")}
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
                {tab === "stock" ? t("stockHistory") : t("details")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {editing ? (
          // ── Edit form ─────────────────────────────────────────────────────
          <>
            <Field
              label={`${t("productName")} *`}
              colors={colors}
              error={errors.name?.message}
            >
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={inputStyle(colors, !!errors.name)}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
            </Field>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Field
                label={t("sku")}
                colors={colors}
                style={{ flex: 1 }}
                error={errors.sku?.message}
              >
                <Controller
                  control={control}
                  name="sku"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={inputStyle(colors, !!errors.sku)}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      autoCapitalize="characters"
                    />
                  )}
                />
              </Field>
              <Field
                label={t("barcode")}
                colors={colors}
                style={{ flex: 1 }}
                error={errors.barcode?.message}
              >
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Controller
                    control={control}
                    name="barcode"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        style={[inputStyle(colors, !!errors.barcode), { flex: 1 }]}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                      />
                    )}
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

            <Field label={t("unit")} colors={colors} error={errors.unit?.message}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {PRODUCT_UNIT_VALUES.map((u) => (
                  <TouchableOpacity
                    key={u}
                    onPress={() =>
                      setValue("unit", u, { shouldValidate: true })
                    }
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
              <Field
                label={t("purchasePrice")}
                colors={colors}
                style={{ flex: 1 }}
                error={errors.purchase_price?.message}
              >
                <Controller
                  control={control}
                  name="purchase_price"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={inputStyle(colors, !!errors.purchase_price)}
                      value={value}
                      onChangeText={(t) => onChange(normalizeAmountInput(t))}
                      onBlur={onBlur}
                      keyboardType="decimal-pad"
                    />
                  )}
                />
              </Field>
              <Field
                label={t("salePrice")}
                colors={colors}
                style={{ flex: 1 }}
                error={errors.sale_price?.message}
              >
                <Controller
                  control={control}
                  name="sale_price"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={inputStyle(colors, !!errors.sale_price)}
                      value={value}
                      onChangeText={(t) => onChange(normalizeAmountInput(t))}
                      onBlur={onBlur}
                      keyboardType="decimal-pad"
                    />
                  )}
                />
              </Field>
            </View>

            <Field
              label={t("additionalCost")}
              colors={colors}
              error={errors.additional_cost?.message}
            >
              <Controller
                control={control}
                name="additional_cost"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={inputStyle(colors, !!errors.additional_cost)}
                    value={value}
                    onChangeText={(t) => onChange(normalizeAmountInput(t))}
                    onBlur={onBlur}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.text.tertiary}
                  />
                )}
              />
            </Field>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Field
                label={t("taxRate")}
                colors={colors}
                style={{ flex: 1 }}
                error={errors.tax_rate?.message}
              >
                <Controller
                  control={control}
                  name="tax_rate"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={inputStyle(colors, !!errors.tax_rate)}
                      value={value}
                      onChangeText={(t) => onChange(normalizeAmountInput(t))}
                      onBlur={onBlur}
                      keyboardType="decimal-pad"
                    />
                  )}
                />
              </Field>
              <Field
                label={t("lowStockAlert")}
                colors={colors}
                style={{ flex: 1 }}
                error={errors.low_stock_threshold?.message}
              >
                <Controller
                  control={control}
                  name="low_stock_threshold"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={inputStyle(colors, !!errors.low_stock_threshold)}
                      value={value}
                      onChangeText={(t) => onChange(normalizeAmountInput(t))}
                      onBlur={onBlur}
                      keyboardType="decimal-pad"
                    />
                  )}
                />
              </Field>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <Controller
                control={control}
                name="track_inventory"
                render={({ field: { onChange, value } }) => (
                  <ToggleRow
                    label={t("trackInventory")}
                    value={value}
                    onChange={onChange}
                    colors={colors}
                  />
                )}
              />
              <Controller
                control={control}
                name="is_active"
                render={({ field: { onChange, value } }) => (
                  <ToggleRow
                    label={t("active")}
                    value={value}
                    onChange={onChange}
                    colors={colors}
                  />
                )}
              />
            </View>
          </>
        ) : activeTab === "details" ? (
          // ── Details view ──────────────────────────────────────────────────
          <View style={{ gap: 12 }}>
            <InfoRow label="Name" value={product.name} colors={colors} />
            <InfoRow label={t("sku")} value={product.sku || "—"} colors={colors} />
            <InfoRow
              label={t("barcode")}
              value={product.barcode || "—"}
              colors={colors}
            />
            <InfoRow label={t("unit")} value={product.unit} colors={colors} />
            <InfoRow
              label={t("purchasePrice")}
              value={product.purchase_price.toLocaleString()}
              colors={colors}
            />
            <InfoRow
              label="Additional Cost"
              value={(product.additional_cost ?? 0).toLocaleString()}
              colors={colors}
            />
            <InfoRow
              label={t("costPrice")}
              value={(product.cost_price ?? product.purchase_price).toLocaleString()}
              colors={colors}
            />
            <InfoRow
              label={t("salePrice")}
              value={product.sale_price.toLocaleString()}
              colors={colors}
            />
            <InfoRow
              label="Tax Rate"
              value={`${product.tax_rate}%`}
              colors={colors}
            />
            <InfoRow
              label={t("profitMargin")}
              value={`${product.profit_margin}%`}
              colors={colors}
            />
            <InfoRow
              label={t("lowStockAlert")}
              value={
                product.low_stock_threshold > 0
                  ? `${product.low_stock_threshold} ${product.unit}`
                  : "Disabled"
              }
              colors={colors}
            />
            <InfoRow
              label={t("trackInventory")}
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
                label={t("description")}
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
              {t("noStockMovements")}
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
          setValue("barcode", code, { shouldValidate: true });
          setScannerVisible(false);
        }}
        title={t("scanBarcode")}
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
              {t("adjustStock")}
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
            {t("currentStock")}:{" "}
            <Text style={{ fontWeight: "700", color: colors.text.primary }}>
              {product.current_stock} {product.unit}
            </Text>
          </Text>

          {/* Type */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            {(["adjustment_in", "adjustment_out"] as const).map((adjustmentType) => (
              <TouchableOpacity
                key={adjustmentType}
                onPress={() => setAdjustValue("type", adjustmentType)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: "center",
                  backgroundColor:
                    adjustType === adjustmentType
                      ? adjustmentType === "adjustment_in"
                        ? colors.success
                        : colors.error
                      : colors.bg.secondary,
                  borderWidth: 1,
                  borderColor:
                    adjustType === adjustmentType
                      ? adjustmentType === "adjustment_in"
                        ? colors.success
                        : colors.error
                      : colors.border,
                }}
              >
                <Ionicons
                  name={
                    adjustmentType === "adjustment_in"
                      ? "add-circle-outline"
                      : "remove-circle-outline"
                  }
                  size={20}
                  color={adjustType === adjustmentType ? "#fff" : colors.text.secondary}
                />
                <Text
                  style={{
                    marginTop: 4,
                    fontWeight: "600",
                    color: adjustType === adjustmentType ? "#fff" : colors.text.secondary,
                    fontSize: 13,
                  }}
                >
                  {adjustmentType === "adjustment_in" ? t("addStock") : t("removeStock")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field
            label={t("quantity")}
            colors={colors}
            error={adjustErrors.quantity?.message}
          >
            <Controller
              control={adjustControl}
              name="quantity"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={inputStyle(colors, !!adjustErrors.quantity)}
                  value={value}
                  onChangeText={(t) => onChange(normalizeAmountInput(t))}
                  onBlur={onBlur}
                  placeholder={t("quantityPlaceholder")}
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              )}
            />
          </Field>

          <Field
            label={t("unitCostOptional")}
            colors={colors}
            error={adjustErrors.unit_cost?.message}
          >
            <Controller
              control={adjustControl}
              name="unit_cost"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={inputStyle(colors, !!adjustErrors.unit_cost)}
                  value={value}
                  onChangeText={(t) => onChange(normalizeAmountInput(t))}
                  onBlur={onBlur}
                  placeholder={t("unitCostPlaceholder")}
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="decimal-pad"
                />
              )}
            />
          </Field>

          <Field
            label="Notes (optional)"
            colors={colors}
            error={adjustErrors.notes?.message}
          >
            <Controller
              control={adjustControl}
              name="notes"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={inputStyle(colors, !!adjustErrors.notes)}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder={t("adjustmentNotesPlaceholder")}
                  placeholderTextColor={colors.text.tertiary}
                />
              )}
            />
          </Field>

          <TouchableOpacity
            onPress={handleAdjustSubmit(onAdjustStock)}
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
                {t("confirmAdjustment")}
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
  error,
}: {
  label: string;
  children: React.ReactNode;
  colors: any;
  style?: object;
  error?: string;
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
      {error ? (
        <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>
          {error}
        </Text>
      ) : null}
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

const inputStyle = (colors: any, hasError = false) => ({
  backgroundColor: colors.bg.secondary,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: hasError ? colors.error : colors.border,
  paddingHorizontal: 12,
  paddingVertical: 11,
  fontSize: 15,
  color: colors.text.primary,
});
