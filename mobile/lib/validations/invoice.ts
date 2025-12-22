import { z } from "zod";

/**
 * Line item validation schema
 * Used for invoice items in create/edit forms
 */
export const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.string().min(1, "Quantity is required"),
  unit_price: z.string().min(1, "Price is required"),
  tax_rate: z.string().optional(),
  unit: z.string().optional(),
  discount: z.string().optional(),
  discount_type: z.enum(["fixed", "percent"]).optional(),
  notes: z.string().optional(),
});

/**
 * Invoice creation/edit validation schema
 * Validates complete invoice form data
 */
export const invoiceSchema = z.object({
  party_id: z.string().min(1, "Please select a party"),
  date: z.string().min(1, "Invoice date is required"),
  due_date: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  internal_notes: z.string().optional(),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: z.string().optional(),
  shipping_charge: z.string().optional(),
  adjustment: z.string().optional(),
  adjustment_description: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "At least one item is required"),
});

/**
 * Payment recording validation schema
 * Used when recording payments against invoices
 */
export const paymentSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  method: z.enum(["cash", "bank", "mobile_wallet", "cheque", "other"]),
  account: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().optional(),
});

/**
 * Invoice filter validation schema
 * Used for filtering invoice lists
 */
export const invoiceFilterSchema = z.object({
  type: z.enum(["sale", "purchase"]).optional(),
  status: z
    .enum(["draft", "pending", "partial", "paid", "overdue", "cancelled"])
    .optional(),
  party: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  search: z.string().optional(),
});

// Type exports for form data
export type LineItemFormData = z.infer<typeof lineItemSchema>;
export type InvoiceFormData = z.infer<typeof invoiceSchema>;
export type PaymentFormData = z.infer<typeof paymentSchema>;
export type InvoiceFilterFormData = z.infer<typeof invoiceFilterSchema>;
