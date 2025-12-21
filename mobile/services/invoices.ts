import { api } from "../lib/api";

export type InvoiceType = "sales" | "purchase";
export type InvoiceStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "refunded";
export type PaymentMethod =
  | "cash"
  | "bank"
  | "card"
  | "upi"
  | "cheque"
  | "other";

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount?: number;
  discount_amount?: number;
  amount: number;
}

export interface InvoicePayment {
  _id?: string;
  date: string;
  amount: number;
  payment_method: string;
  account?: string;
  transaction?: string;
  reference?: string;
  notes?: string;
  recorded_by?: string;
}

export interface Invoice {
  _id: string;
  organization?: string;
  admin: string;
  invoice_number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  party?: {
    _id: string;
    name: string;
    code: string;
    type: string;
    phone?: string;
    email?: string;
  };
  invoice_date: string;
  due_date?: string;
  reference?: string;
  items: InvoiceLineItem[];
  subtotal: number;
  tax_amount: number;
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  notes?: string;
  terms?: string;
  payments?: InvoicePayment[];
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceParams {
  organization?: string;
  type: InvoiceType;
  party: string;
  invoice_date?: string;
  due_date?: string;
  reference?: string;
  items: {
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate?: number;
  }[];
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  notes?: string;
  terms?: string;
}

export interface UpdateInvoiceParams {
  party?: string;
  invoice_date?: string;
  due_date?: string;
  reference?: string;
  items?: {
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate?: number;
  }[];
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  notes?: string;
  terms?: string;
}

export interface RecordPaymentParams {
  invoiceId: string;
  amount: number;
  payment_method?: string;
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
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface InvoicesListResponse {
  invoices: Invoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface InvoiceSummary {
  sales: {
    total: number;
    paid: number;
    due: number;
    count: number;
    by_status: Record<
      InvoiceStatus,
      { count: number; total: number; paid: number; due: number }
    >;
  };
  purchases: {
    total: number;
    paid: number;
    due: number;
    count: number;
    by_status: Record<
      InvoiceStatus,
      { count: number; total: number; paid: number; due: number }
    >;
  };
}

export interface InvoiceOptions {
  invoice_types: InvoiceType[];
  invoice_statuses: InvoiceStatus[];
}

export const invoicesApi = {
  // Get options
  getOptions: async () => {
    const response = await api.get<InvoiceOptions>("/invoices/options");
    return response.data;
  },

  // Get invoice summary/stats
  getSummary: async (params?: {
    organization?: string;
    type?: InvoiceType;
    startDate?: string;
    endDate?: string;
  }) => {
    const response = await api.get<{ summary: InvoiceSummary }>(
      "/invoices/summary",
      { params }
    );
    return response.data.summary;
  },

  // Create a new invoice
  create: async (params: CreateInvoiceParams) => {
    const response = await api.post<{ invoice: Invoice }>("/invoices", params);
    return response.data.invoice;
  },

  // List invoices
  list: async (params?: ListInvoicesParams) => {
    const response = await api.get<InvoicesListResponse>("/invoices", {
      params,
    });
    return response.data;
  },

  // Get invoice details
  get: async (invoiceId: string) => {
    const response = await api.get<{ invoice: Invoice }>(
      `/invoices/${invoiceId}`
    );
    return response.data.invoice;
  },

  // Update invoice
  update: async (invoiceId: string, params: UpdateInvoiceParams) => {
    const response = await api.patch<{ invoice: Invoice }>(
      `/invoices/${invoiceId}`,
      params
    );
    return response.data.invoice;
  },

  // Update invoice status
  updateStatus: async (invoiceId: string, status: InvoiceStatus) => {
    const response = await api.patch<{ invoice: Invoice }>(
      `/invoices/${invoiceId}/status`,
      { status }
    );
    return response.data.invoice;
  },

  // Record a payment on an invoice
  recordPayment: async (params: RecordPaymentParams) => {
    const { invoiceId, ...paymentData } = params;
    const response = await api.post<{ invoice: Invoice }>(
      `/invoices/${invoiceId}/payments`,
      paymentData
    );
    return response.data.invoice;
  },

  // Delete an invoice (only drafts)
  delete: async (invoiceId: string) => {
    await api.delete(`/invoices/${invoiceId}`);
  },

  // Cancel an invoice
  cancel: async (invoiceId: string, reason?: string) => {
    const response = await api.post<{ invoice: Invoice }>(
      `/invoices/${invoiceId}/cancel`,
      { reason }
    );
    return response.data.invoice;
  },
};
