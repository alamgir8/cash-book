/**
 * Invoice calculation utilities
 * Pure functions for invoice totals and line item calculations
 */

import type { InvoiceTotals } from "@/types/invoice";

/**
 * Calculate line item total including tax
 */
export function calculateLineItemTotal(
  quantity: string | number,
  unitPrice: string | number,
  taxRate: string | number = 0
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
  discountValue: string = "0"
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
  items?: {
    description?: string;
    quantity?: string;
    unit_price?: string;
    tax_rate?: string;
    unit?: string;
    discount?: string;
    discount_type?: "fixed" | "percent";
    notes?: string;
  }[];
}) {
  // Filter out invalid items
  const validItems = (formData.items || []).filter(
    (item) => item.description?.trim() && parseFloat(item.unit_price || "0") > 0
  );

  const items = validItems.map((item) => ({
    description: item.description?.trim() || "",
    quantity: parseFloat(item.quantity || "1") || 1,
    unit_price: parseFloat(item.unit_price || "0") || 0,
    tax_rate: parseFloat(item.tax_rate || "0") || 0,
  }));

  return {
    party: formData.party_id || "",
    date: formData.date || new Date().toISOString().split("T")[0],
    due_date: formData.due_date?.trim() || undefined,
    reference: formData.reference?.trim() || undefined,
    notes: formData.notes?.trim() || undefined,
    items,
  };
}
