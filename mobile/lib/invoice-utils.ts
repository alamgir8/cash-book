/**
 * Invoice calculation utilities
 * Pure functions for invoice totals and line item calculations
 */

import type { InvoiceTotals } from "@/types/invoice";

/** 24-char hex Mongo ObjectId (what the backend can `findById`). */
export function isMongoObjectId(value?: string | null): value is string {
  return typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
}

/**
 * Walk a react-hook-form `FieldErrors` tree (or any nested error object) and
 * return the first message. RHF-agnostic so it stays unit-testable.
 */
export function findFirstErrorMessage(errors: unknown): string | null {
  if (!errors || typeof errors !== "object") return null;
  const record = errors as Record<string, unknown>;
  if (typeof record.message === "string" && record.message) {
    return record.message;
  }
  for (const value of Object.values(record)) {
    if (!value || typeof value !== "object") continue;
    const nested = findFirstErrorMessage(value);
    if (nested) return nested;
  }
  return null;
}

/**
 * Calculate line item total including tax
 */
export function calculateLineItemTotal(
  quantity: string | number,
  unitPrice: string | number,
  taxRate: string | number = 0,
): number {
  const qty = typeof quantity === "string" ? parseFloat(quantity) : quantity;
  const price =
    typeof unitPrice === "string" ? parseFloat(unitPrice) : unitPrice;
  const tax = typeof taxRate === "string" ? parseFloat(taxRate) : taxRate;

  if (isNaN(qty) || isNaN(price)) return 0;

  const subtotal = qty * price;
  const taxAmount = subtotal * ((isNaN(tax) ? 0 : tax) / 100);
  return subtotal + taxAmount;
}

/**
 * Calculate invoice totals from line items and discount
 */
export function calculateInvoiceTotals(
  items: {
    quantity?: string;
    unit_price?: string;
    tax_rate?: string;
    [key: string]: any;
  }[],
  discountType: "percentage" | "fixed" = "percentage",
  discountValue: string = "0",
): InvoiceTotals {
  let subtotal = 0;
  let totalTax = 0;

  items.forEach((item) => {
    const qty = parseFloat(item.quantity || "0") || 0;
    const price = parseFloat(item.unit_price || "0") || 0;
    const taxRate = parseFloat(item.tax_rate || "0") || 0;
    const lineSubtotal = qty * price;
    subtotal += lineSubtotal;
    totalTax += lineSubtotal * (taxRate / 100);
  });

  let discountAmount = 0;
  const discountVal = parseFloat(discountValue || "0") || 0;
  if (discountType === "percentage") {
    discountAmount = subtotal * (discountVal / 100);
  } else {
    discountAmount = discountVal;
  }

  const total = subtotal + totalTax - discountAmount;

  return {
    subtotal,
    totalTax,
    discountAmount,
    total: total < 0 ? 0 : total,
  };
}

/**
 * Format amount for display
 */
export function formatInvoiceAmount(amount: number | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "0.00";
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Transform form data to API params
 */
export function transformInvoiceFormData(formData: {
  party_id?: string;
  date?: string;
  due_date?: string;
  reference?: string;
  notes?: string;
  terms?: string;
  internal_notes?: string;
  discount_type?: "percentage" | "fixed";
  discount_value?: string;
  shipping_charge?: string;
  adjustment?: string;
  adjustment_description?: string;
  payment_mode?: "cash" | "due" | "partial";
  initial_payment_amount?: string;
  initial_payment_account?: string;
  initial_payment_method?: string;
  initial_payment_reference?: string;
  initial_payment_notes?: string;
  items?: {
    description?: string;
    quantity?: string;
    unit_price?: string;
    tax_rate?: string;
    unit?: string;
    discount?: string;
    discount_type?: "fixed" | "percent";
    notes?: string;
    product?: string;
    local_product_id?: string;
    barcode?: string;
  }[];
}) {
  // Filter out invalid items
  const validItems = (formData.items || []).filter(
    (item) =>
      item.description?.trim() && parseFloat(item.unit_price || "0") > 0,
  );

  const items = validItems.map((item) => ({
    description: item.description?.trim() || "",
    quantity: parseFloat(item.quantity || "1") || 1,
    unit_price: parseFloat(item.unit_price || "0") || 0,
    tax_rate: parseFloat(item.tax_rate || "0") || 0,
    unit: item.unit?.trim() || undefined,
    // Only a Mongo ObjectId can be linked server-side; local UUIDs are skipped.
    product: isMongoObjectId(item.product) ? item.product : undefined,
    // Local-only hint so the offline DAL can move stock.
    local_product_id: item.local_product_id || undefined,
    barcode: item.barcode?.trim() || undefined,
  }));

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0,
  );

  // The form shows a discounted total, but the API has no invoice-level
  // discount field: totals are `subtotal - total_discount + tax + shipping +
  // adjustment`. Applying the discount as a negative adjustment keeps the saved
  // invoice equal to what the user saw (line discounts aren't collected yet).
  const discountValue = parseFloat(formData.discount_value || "0") || 0;
  const discountAmount =
    formData.discount_type === "percentage"
      ? (subtotal * discountValue) / 100
      : discountValue;
  const shipping = parseFloat(formData.shipping_charge || "0") || 0;
  const explicitAdjustment = parseFloat(formData.adjustment || "0") || 0;
  const adjustment = explicitAdjustment - discountAmount;

  return {
    party: formData.party_id || "",
    date: formData.date || new Date().toISOString().split("T")[0],
    due_date: formData.due_date?.trim() || undefined,
    reference: formData.reference?.trim() || undefined,
    notes: formData.notes?.trim() || undefined,
    shipping_charge: shipping || undefined,
    adjustment: adjustment || undefined,
    adjustment_description:
      discountAmount > 0
        ? formData.discount_type === "percentage"
          ? `Discount ${discountValue}%`
          : "Discount"
        : formData.adjustment_description?.trim() || undefined,
    items,
    payment_mode: formData.payment_mode || "due",
    initial_payment_amount: formData.initial_payment_amount,
    initial_payment_account: formData.initial_payment_account || undefined,
    initial_payment_method: formData.initial_payment_method || "cash",
    initial_payment_reference: formData.initial_payment_reference || undefined,
    initial_payment_notes: formData.initial_payment_notes || undefined,
  };
}
