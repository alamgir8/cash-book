/**
 * Invoice-related type definitions
 * Consolidated from services/invoices.ts
 */

export type InvoiceType = "sale" | "purchase";

export type InvoiceStatus =
  | "draft"
  | "pending"
  | "partial"
  | "paid"
  | "overdue"
  | "cancelled";

export type PaymentMethod =
  | "cash"
  | "bank"
  | "mobile_wallet"
  | "cheque"
  | "other";

export interface InvoiceLineItem {
  _id?: string;
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  discount?: number;
  discount_type?: "fixed" | "percent";
  tax_rate: number;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  total?: number;
  notes?: string;
}

export interface InvoicePayment {
  _id?: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  account?: string;
  transaction?: string;
  reference?: string;
  notes?: string;
  recorded_by?: string;
}

export interface InvoiceParty {
  _id: string;
  name: string;
  code: string;
  type: string;
  phone?: string;
  email?: string;
}

export interface Invoice {
  _id: string;
  organization?: string;
  admin: string;
  invoice_number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  party?: InvoiceParty;
  party_name?: string;
  party_phone?: string;
  party_address?: string;
  date: string;
  due_date?: string;
  items: InvoiceLineItem[];
  subtotal: number;
  total_discount: number;
  total_tax: number;
  shipping_charge?: number;
  adjustment?: number;
  adjustment_description?: string;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  notes?: string;
  terms?: string;
  internal_notes?: string;
  payments?: InvoicePayment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceParams {
  organization?: string;
  type: InvoiceType;
  party?: string;
  party_name?: string;
  party_phone?: string;
  party_address?: string;
  date?: string;
  due_date?: string;
  items: {
    description: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    discount?: number;
    discount_type?: "fixed" | "percent";
    tax_rate?: number;
    notes?: string;
  }[];
  shipping_charge?: number;
  adjustment?: number;
  adjustment_description?: string;
  notes?: string;
  terms?: string;
  internal_notes?: string;
}

export interface UpdateInvoiceParams {
  party?: string;
  party_name?: string;
  party_phone?: string;
  party_address?: string;
  date?: string;
  due_date?: string;
  items?: {
    description: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    discount?: number;
    discount_type?: "fixed" | "percent";
    tax_rate?: number;
    notes?: string;
  }[];
  shipping_charge?: number;
  adjustment?: number;
  adjustment_description?: string;
  notes?: string;
  terms?: string;
  internal_notes?: string;
}

export interface RecordPaymentParams {
  invoiceId: string;
  amount: number;
  method?: PaymentMethod;
  account?: string;
  reference?: string;
  notes?: string;
  date?: string;
}

export interface ListInvoicesParams {
  organization?: string;
  type?: InvoiceType;
  status?: InvoiceStatus;
  party?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

export interface ListInvoicesResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Status configuration types
 */
export interface StatusColorConfig {
  bg: string;
  text: string;
}

export const STATUS_COLORS: Record<InvoiceStatus, StatusColorConfig> = {
  draft: { bg: "bg-gray-100", text: "text-gray-600" },
  pending: { bg: "bg-yellow-100", text: "text-yellow-700" },
  partial: { bg: "bg-blue-100", text: "text-blue-700" },
  paid: { bg: "bg-green-100", text: "text-green-700" },
  cancelled: { bg: "bg-red-100", text: "text-red-700" },
  overdue: { bg: "bg-orange-100", text: "text-orange-700" },
};

export const STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["pending", "cancelled"],
  pending: ["partial", "paid", "cancelled"],
  partial: ["paid", "cancelled"],
  paid: [],
  overdue: ["partial", "paid", "cancelled"],
  cancelled: [],
};

/**
 * Utility types for invoice calculations
 */
export interface InvoiceTotals {
  subtotal: number;
  totalTax: number;
  discountAmount: number;
  total: number;
}
