import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/use-theme";
import { useActiveOrgId } from "@/hooks/use-organization";
import { useCreateInvoice } from "@/hooks/use-invoices";
import { ScreenHeader } from "@/components/screen-header";
import { SearchableSelect, type SelectOption } from "@/components/searchable-select";
import { BarcodeScannerModal } from "@/components/invoices/barcode-scanner-modal";
import { ProductSearchModal } from "@/components/invoices/product-search-modal";
import { QuickCreateProductModal } from "@/components/invoices/quick-create-product-modal";
import { dalFindProductByBarcode } from "@/data/products";
import { dalFetchAccounts } from "@/data/accounts";
import { dalFetchParties } from "@/data/parties";
import {
  collectIssueMessages,
  createPosCartSchema,
  createPosSaleSchema,
} from "@/lib/validations/shop";
import { isMongoObjectId } from "@/lib/invoice-utils";
import { normalizeAmountInput, parseAmountInput, amountInputProps } from "@/lib/amount-input";
import { toast } from "@/lib/toast";
import { useKeyboardFooterLift } from "@/hooks/use-keyboard-footer-lift";
import { useTranslation } from "@/hooks/use-translation";
import {
  SmartAddBar,
  type SmartAddItem,
} from "@/components/shop/smart-add-bar";
import type { Product } from "@/types/product";

type CartLine = {
  key: string;
  local_product_id?: string;
  product?: string;
  name: string;
  unit: string;
  barcode?: string;
  qty: number;
  unit_price: number;
  tax_rate: number;
  stock?: number;
};

type LastSale = {
  id: string;
  invoice_number: string;
  total: number;
  paid: number;
};

const PAYMENT_MODES = [
  { value: "cash", labelKey: "cash", icon: "cash-outline" },
  { value: "partial", labelKey: "part", icon: "pie-chart-outline" },
  { value: "due", labelKey: "credit", icon: "time-outline" },
] as const;

const lineKey = (product: Product): string =>
  product._id || product.barcode || product.name;

export default function PosScreen() {
  const { colors } = useTheme();
  const { t, language } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizationId = useActiveOrgId();
  const { footerContainerStyle, scrollProps } = useKeyboardFooterLift();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "partial" | "due">(
    "cash",
  );
  const [accountId, setAccountId] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastSale, setLastSale] = useState<LastSale | null>(null);

  const [scannerVisible, setScannerVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [quickCreate, setQuickCreate] = useState<{ barcode: string; name?: string } | null>(
    null,
  );
  const [lookingUp, setLookingUp] = useState(false);

  const mutation = useCreateInvoice({
    onSuccess: (invoice: any) => {
      setLastSale({
        id: invoice?._id ?? "",
        invoice_number: invoice?.invoice_number ?? "",
        total: Number(invoice?.grand_total ?? 0),
        paid: Number(invoice?.amount_paid ?? 0),
      });
      setCart([]);
      setAmountReceived("");
      setNote("");
      setErrors({});
      // Stock, account balances and the invoice list all changed locally.
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const { data: accountsData } = useQuery({
    queryKey: ["accounts", organizationId ?? "personal"],
    queryFn: () => dalFetchAccounts(organizationId),
  });
  const accountOptions: SelectOption[] = useMemo(
    () =>
      (accountsData ?? []).map((a: any) => ({
        value: a._id,
        label: a.name,
        subtitle:
          a.balance !== undefined ? `Balance: ${Number(a.balance).toFixed(2)}` : undefined,
      })),
    [accountsData],
  );

  const { data: customersData } = useQuery({
    queryKey: ["parties", organizationId, "customer"],
    queryFn: () =>
      dalFetchParties({
        organization: organizationId || undefined,
        type: "customer",
        limit: 50,
      }),
  });
  const customerOptions: SelectOption[] = useMemo(
    () =>
      (customersData?.parties ?? []).map((p: any) => ({
        value: p._id,
        label: p.name,
        subtitle: p.phone ?? p.code,
      })),
    [customersData],
  );

  // ── Cart ────────────────────────────────────────────────────────────────
  const addProduct = useCallback((product: Product, qty = 1) => {
    setLastSale(null);
    setCart((prev) => {
      const key = lineKey(product);
      const index = prev.findIndex((l) => l.key === key);
      if (index >= 0) {
        const next = [...prev];
        next[index] = { ...next[index], qty: next[index].qty + qty };
        return next;
      }
      return [
        ...prev,
        {
          key,
          local_product_id: product._id,
          product: isMongoObjectId(product.server_id)
            ? product.server_id
            : isMongoObjectId(product._id)
              ? product._id
              : undefined,
          name: product.name,
          unit: product.unit ?? "pcs",
          barcode: product.barcode,
          qty,
          unit_price: Number(product.sale_price ?? 0),
          tax_rate: Number(product.tax_rate ?? 0),
          stock: product.track_inventory ? Number(product.current_stock) : undefined,
        },
      ];
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, qty: Math.max(1, qty) } : l)),
    );
  }, []);

  /**
   * Add natural-language items to the cart. A phrase that matches an existing
   * product reuses it (stock/price from the catalog); an unknown one becomes a
   * free-text line that still records the spoken price.
   */
  const addParsedItems = useCallback(
    (items: SmartAddItem[]) => {
      setLastSale(null);
      setCart((prev) => {
        const next = [...prev];
        for (const item of items) {
          const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
          const product = item.matched;
          const key = product
            ? lineKey(product)
            : `free:${item.name.toLowerCase()}`;
          const price =
            item.price ?? (product ? Number(product.sale_price) : 0);

          const existingIndex = next.findIndex((l) => l.key === key);
          if (existingIndex >= 0) {
            next[existingIndex] = {
              ...next[existingIndex],
              qty: next[existingIndex].qty + qty,
            };
            continue;
          }
          next.push({
            key,
            local_product_id: product?._id,
            product: product
              ? isMongoObjectId(product.server_id)
                ? product.server_id
                : isMongoObjectId(product._id)
                  ? product._id
                  : undefined
              : undefined,
            name: product?.name ?? item.name,
            unit: item.unit ?? product?.unit ?? "pcs",
            barcode: product?.barcode,
            qty,
            unit_price: price,
            tax_rate: Number(product?.tax_rate ?? 0),
            stock:
              product?.track_inventory
                ? Number(product.current_stock)
                : undefined,
          });
        }
        return next;
      });
    },
    [],
  );

  const setPrice = useCallback((key: string, text: string) => {
    const price = parseAmountInput(text);
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, unit_price: price } : l)),
    );
  }, []);

  const removeLine = useCallback((key: string) => {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const l of cart) {
      const line = l.qty * l.unit_price;
      subtotal += line;
      tax += line * (l.tax_rate / 100);
    }
    return { subtotal, tax, total: subtotal + tax };
  }, [cart]);

  // ── Scan ────────────────────────────────────────────────────────────────
  const handleScan = useCallback(
    async (barcode: string) => {
      setScannerVisible(false);
      const code = barcode.trim();
      setLookingUp(true);
      try {
        const product = await dalFindProductByBarcode(
          code,
          organizationId ?? undefined,
        );
        if (product) {
          // Same barcode rescanned on a POS should just bump the quantity.
          addProduct(product, 1);
          toast.success(`${product.name} +1`);
        } else {
          setQuickCreate({ barcode: code });
        }
      } catch {
        setQuickCreate({ barcode: code });
      } finally {
        setLookingUp(false);
      }
    },
    [addProduct, organizationId],
  );

  // ── Charge ──────────────────────────────────────────────────────────────
  // Schema factories keyed on the language so messages follow the locale.
  const cartSchema = useMemo(() => createPosCartSchema(t), [language]);
  const saleSchema = useMemo(() => createPosSaleSchema(t), [language]);

  const cartInput = useMemo(
    () =>
      cart.map((l) => ({
        description: l.name,
        quantity: String(l.qty),
        unit_price: String(l.unit_price),
        tax_rate: String(l.tax_rate),
      })),
    [cart],
  );

  const handleCharge = useCallback(() => {
    const cartResult = cartSchema.safeParse({ items: cartInput });
    const saleResult = saleSchema.safeParse({
      customer_id: customerId || undefined,
      payment_mode: paymentMode,
      account_id: accountId || undefined,
      amount_received: amountReceived,
      note,
    });

    const merged: Record<string, string> = {
      ...(cartResult.success ? {} : collectIssueMessages(cartResult.error)),
      ...(saleResult.success ? {} : collectIssueMessages(saleResult.error)),
    };
    if (Object.keys(merged).length > 0) {
      setErrors(merged);
      const first = Object.values(merged)[0];
      toast.error(first);
      return;
    }
    setErrors({});

    mutation.mutate(
      {
        organization: organizationId || undefined,
        type: "sale",
        party: customerId || undefined,
        date: new Date().toISOString(),
        notes: note.trim() || undefined,
        items: cart.map((l) => ({
          description: l.name,
          quantity: l.qty,
          unit: l.unit,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
          product: l.product,
          local_product_id: l.local_product_id,
          barcode: l.barcode,
        })),
        payment_mode: paymentMode,
        initial_payment_amount:
          paymentMode === "partial" ? parseAmountInput(amountReceived) : undefined,
        initial_payment_account: accountId || undefined,
        initial_payment_method: "cash",
      },
      {
        onError: () => {
          // Stock/cash failures surface through the hook's toast; keep the cart.
        },
      },
    );
  }, [
    cartInput,
    cart,
    customerId,
    paymentMode,
    accountId,
    amountReceived,
    note,
    organizationId,
    mutation,
  ]);

  const money = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const paidNow =
    paymentMode === "cash"
      ? totals.total
      : paymentMode === "partial"
        ? parseAmountInput(amountReceived)
        : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader title={t("newSale")} showBack />

      {/* Scan / search bar */}
      <View style={{ flexDirection: "row", gap: 10, padding: 12 }}>
        <TouchableOpacity
          onPress={() => setScannerVisible(true)}
          disabled={lookingUp}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: colors.info,
          }}
        >
          {lookingUp ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="barcode-outline" size={22} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {t("scan")}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSearchVisible(true)}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: colors.bg.secondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="search" size={20} color={colors.info} />
          <Text style={{ color: colors.text.primary, fontWeight: "700" }}>
            {t("find")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Say or type an item — fastest path for a busy counter.
          Kept outside the scroll view so the keyboard never opens a gap above it. */}
      <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
        <SmartAddBar
          mode="sale"
          organizationId={organizationId}
          onSubmit={addParsedItems}
          onPickExisting={(product) => addProduct(product, 1)}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        {...scrollProps}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
      >
        {lastSale ? (
          <TouchableOpacity
            onPress={() =>
              lastSale.id && router.push(`/invoices/${lastSale.id}` as any)
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              padding: 12,
              borderRadius: 12,
              marginBottom: 12,
              backgroundColor: colors.success + "18",
              borderWidth: 1,
              borderColor: colors.success + "40",
            }}
          >
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontWeight: "700", color: colors.text.primary }}
              >
                {t("saleCompleted")} · {money(lastSale.total)}
              </Text>
              <Text style={{ fontSize: 12, color: colors.text.secondary }}>
                {lastSale.invoice_number}
                {lastSale.paid < lastSale.total
                  ? ` · ${t("credit")}`
                  : ""}{" "}
                · {t("tapForReceipt")}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        ) : null}

        {/* Cart */}
        {cart.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Ionicons name="cart-outline" size={54} color={colors.text.tertiary} />
            <Text
              style={{
                color: colors.text.secondary,
                marginTop: 12,
                fontWeight: "600",
              }}
            >
              {t("cartEmpty")}
            </Text>
            <Text style={{ color: colors.text.tertiary, marginTop: 4 }}>
              {t("cartEmptyHint")}
            </Text>
          </View>
        ) : (
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            {cart.map((l, index) => {
              const lineError = errors[`items.${index}.unit_price`];
              const shortStock =
                l.stock !== undefined && l.qty > l.stock;
              return (
                <View
                  key={l.key}
                  style={{
                    padding: 12,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderColor: colors.border,
                    backgroundColor: colors.bg.secondary,
                  }}
                >
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontWeight: "600", color: colors.text.primary }}
                        numberOfLines={1}
                      >
                        {l.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.text.tertiary }}>
                        {l.unit}
                        {l.stock !== undefined
                          ? ` · ${t("currentStock")} ${l.stock}`
                          : ""}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeLine(l.key)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    {/* Qty stepper */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.bg.primary,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => setQty(l.key, l.qty - 1)}
                        style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                      >
                        <Ionicons name="remove" size={18} color={colors.text.primary} />
                      </TouchableOpacity>
                      <Text
                        style={{
                          minWidth: 28,
                          textAlign: "center",
                          fontWeight: "700",
                          color: colors.text.primary,
                        }}
                      >
                        {l.qty}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setQty(l.key, l.qty + 1)}
                        style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                      >
                        <Ionicons name="add" size={18} color={colors.text.primary} />
                      </TouchableOpacity>
                    </View>

                    {/* Unit price */}
                    <TextInput
                      value={String(l.unit_price)}
                      onChangeText={(t) => setPrice(l.key, t)}
                      {...amountInputProps}
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: lineError ? colors.error : colors.border,
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        color: colors.text.primary,
                        backgroundColor: colors.bg.primary,
                      }}
                    />

                    <Text
                      style={{
                        minWidth: 76,
                        textAlign: "right",
                        fontWeight: "700",
                        color: colors.text.primary,
                      }}
                    >
                      {money(l.qty * l.unit_price)}
                    </Text>
                  </View>

                  {shortStock ? (
                    <Text
                      style={{ fontSize: 11, color: colors.warning, marginTop: 6 }}
                    >
                      {t("restockRequired", { n: String(l.stock) })}
                    </Text>
                  ) : null}
                  {lineError ? (
                    <Text
                      style={{ fontSize: 11, color: colors.error, marginTop: 6 }}
                    >
                      {lineError}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {errors.items ? (
          <Text style={{ color: colors.error, fontSize: 12, marginTop: 8 }}>
            {errors.items}
          </Text>
        ) : null}

        {/* Payment */}
        {cart.length > 0 ? (
          <View style={{ marginTop: 16, gap: 12 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: colors.text.tertiary,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {t("paymentMode")}
            </Text>

            <View style={{ flexDirection: "row", gap: 8 }}>
              {PAYMENT_MODES.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  onPress={() => {
                    setPaymentMode(m.value);
                    setErrors({});
                  }}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    gap: 4,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    backgroundColor:
                      paymentMode === m.value ? colors.info + "18" : colors.bg.secondary,
                    borderColor:
                      paymentMode === m.value ? colors.info : colors.border,
                  }}
                >
                  <Ionicons
                    name={m.icon as any}
                    size={20}
                    color={paymentMode === m.value ? colors.info : colors.text.secondary}
                  />
                  <Text
                    style={{
                      fontWeight: "700",
                      fontSize: 13,
                      color:
                        paymentMode === m.value ? colors.info : colors.text.secondary,
                    }}
                  >
                    {t(m.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View>
              <SearchableSelect
                label={paymentMode === "due" ? `${t("customer")} *` : t("customer")}
                placeholder={t("walkInCustomer")}
                value={customerId}
                options={customerOptions}
                onSelect={setCustomerId}
                fetchOptions={async (q) => {
                  const res = await dalFetchParties({
                    organization: organizationId || undefined,
                    type: "customer",
                    search: q,
                    limit: 50,
                  });
                  return res.parties.map((p: any) => ({
                    value: p._id,
                    label: p.name,
                    subtitle: p.phone ?? p.code,
                  }));
                }}
              />
              {errors.customer_id ? (
                <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>
                  {errors.customer_id}
                </Text>
              ) : null}
            </View>

            {paymentMode !== "due" ? (
              <View>
                <SearchableSelect
                  label={`${t("depositToAccount")} *`}
                  placeholder={t("selectAccountPlaceholder")}
                  value={accountId}
                  options={accountOptions}
                  onSelect={setAccountId}
                />
                {errors.account_id ? (
                  <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>
                    {errors.account_id}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: colors.warning }}>
                {t("creditSaleNote")}
              </Text>
            )}

            {paymentMode === "partial" ? (
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: colors.text.primary,
                    marginBottom: 6,
                  }}
                >
                  {t("amountReceived")}
                </Text>
                <TextInput
                  value={amountReceived}
                  onChangeText={(t) => setAmountReceived(normalizeAmountInput(t))}
                  {...amountInputProps}
                  placeholder={`0.00 of ${money(totals.total)}`}
                  placeholderTextColor={colors.text.tertiary}
                  style={{
                    borderWidth: 1,
                    borderColor: errors.amount_received ? colors.error : colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: colors.text.primary,
                    backgroundColor: colors.bg.secondary,
                  }}
                />
                {errors.amount_received ? (
                  <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>
                    {errors.amount_received}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t("notesOptional")}              placeholderTextColor={colors.text.tertiary}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: colors.text.primary,
                backgroundColor: colors.bg.secondary,
              }}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Totals + charge */}
      {cart.length > 0 ? (
        <View
          style={{
            ...footerContainerStyle,
            borderTopColor: colors.border,
            backgroundColor: colors.bg.primary,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <Text style={{ color: colors.text.secondary, fontSize: 13 }}>
              {t("subTotal")}
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: 13 }}>
              {money(totals.subtotal)}
            </Text>
          </View>
          {totals.tax > 0 ? (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Text style={{ color: colors.text.secondary, fontSize: 13 }}>
                {t("taxRate")}
              </Text>
              <Text style={{ color: colors.text.secondary, fontSize: 13 }}>
                {money(totals.tax)}
              </Text>
            </View>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <Text
              style={{ color: colors.text.primary, fontWeight: "700", fontSize: 16 }}
            >
              {t("grandTotal")}
            </Text>
            <Text
              style={{ color: colors.text.primary, fontWeight: "800", fontSize: 18 }}
            >
              {money(totals.total)}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleCharge}
            disabled={mutation.isPending}
            style={{
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: "center",
              backgroundColor: colors.success,
              opacity: mutation.isPending ? 0.7 : 1,
            }}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
                {paymentMode === "due"
                  ? `${t("completeSale")} · ${money(totals.total)} · ${t("credit")}`
                  : `${t("charge")} ${money(paidNow)}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScan}
        title={t("scanItem")}
      />
      <ProductSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelect={(product) => {
          addProduct(product, 1);
          setSearchVisible(false);
        }}
        invoiceType="sale"
      />
      <QuickCreateProductModal
        visible={!!quickCreate}
        barcode={quickCreate?.barcode ?? ""}
        initialName={quickCreate?.name}
        invoiceType="sale"
        organizationId={organizationId}
        onClose={() => setQuickCreate(null)}
        onCreated={(product) => {
          addProduct(product, 1);
          setQuickCreate(null);
        }}
      />
    </View>
  );
}
