import type {
  LocalAccount,
  LocalInvoice,
  LocalInvoiceItem,
  LocalInvoicePayment,
  LocalParty,
  LocalProduct,
  LocalStockMovement,
} from "@/db/types";
import type { Account, AccountOverview } from "@/services/accounts";
import type { Party, PartyType } from "@/services/parties";
import type { Invoice, InvoicePayment } from "@/services/invoices";
import type { Product, StockMovement } from "@/types/product";

export function localAccountToApi(row: LocalAccount): Account {
  return {
    _id: row.server_id || row.id,
    name: row.name,
    description: row.description ?? "",
    balance: Number(row.current_balance),
    kind: row.kind,
    currency_code: row.currency_code ?? undefined,
    currency_symbol: row.currency_symbol ?? undefined,
    opening_balance: Number(row.opening_balance),
    archived: Boolean(row.archived),
  };
}

export function localPartyToApi(row: LocalParty, totalTransactions = 0): Party {
  let address: Party["address"];
  if (row.address_json) {
    try {
      address = JSON.parse(row.address_json);
    } catch {
      address = undefined;
    }
  }
  return {
    _id: row.id,
    admin: "",
    code: row.code ?? "",
    name: row.name,
    type: (row.type as PartyType) || "customer",
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address,
    opening_balance: Number(row.opening_balance),
    current_balance: Number(row.current_balance),
    credit_limit: row.credit_limit ?? undefined,
    notes: row.notes ?? undefined,
    archived: Boolean(row.archived),
    total_transactions: totalTransactions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function localAccountToOverview(row: LocalAccount): AccountOverview {
  return {
    ...localAccountToApi(row),
    // Prefer local UUID so edit/delete hit SQLite `id` (server_id is for sync).
    _id: row.id,
    summary: {
      totalTransactions: 0,
      totalDebit: 0,
      totalCredit: 0,
      net: 0,
      lastTransactionDate: null,
    },
  };
}

/** Prefer local UUID as stable id when local-first is on. */
export function localAccountToApiLocalId(row: LocalAccount): Account {
  return {
    ...localAccountToApi(row),
    _id: row.id,
  };
}

// ── Shop ────────────────────────────────────────────────────────────────────

/**
 * Local product → API-shaped `Product`. `_id` is the local UUID so navigation,
 * edit, delete and stock adjust all resolve to the SQLite row (accounts pattern).
 * Server-only aggregates (sold/purchased/last dates) are passed in from the DAL.
 */
export function localProductToApi(
  row: LocalProduct,
  opts?: {
    totalSold?: number;
    totalPurchased?: number;
    lastSaleDate?: string | null;
    lastPurchaseDate?: string | null;
  },
): Product {
  const costPrice = Number(row.cost_price ?? 0);
  const salePrice = Number(row.sale_price ?? 0);
  const trackInventory = Boolean(row.track_inventory);
  const lowStockThreshold = Number(row.low_stock_threshold ?? 0);
  const currentStock = Number(row.current_stock ?? 0);

  let meta: Record<string, unknown> | undefined;
  if (row.meta_data_json) {
    try {
      meta = JSON.parse(row.meta_data_json);
    } catch {
      meta = undefined;
    }
  }

  return {
    _id: row.id,
    server_id: row.server_id ?? undefined,
    admin: "",
    organization: row.organization_id ?? undefined,
    name: row.name,
    brand: row.brand ?? undefined,
    sku: row.sku ?? undefined,
    barcode: row.barcode ?? undefined,
    description: row.description ?? undefined,
    unit: (row.unit as Product["unit"]) || "pcs",
    purchase_price: Number(row.purchase_price ?? 0),
    additional_cost: Number(row.additional_cost ?? 0),
    cost_price: costPrice,
    sale_price: salePrice,
    tax_rate: Number(row.tax_rate ?? 0),
    current_stock: currentStock,
    opening_stock: Number(row.opening_stock ?? 0),
    low_stock_threshold: lowStockThreshold,
    track_inventory: trackInventory,
    images: [],
    meta_data: meta,
    is_active: Boolean(row.is_active),
    is_deleted: Boolean(row.deleted_at),
    total_sold: Number(opts?.totalSold ?? 0),
    total_purchased: Number(opts?.totalPurchased ?? 0),
    last_purchase_date: opts?.lastPurchaseDate ?? undefined,
    last_sale_date: opts?.lastSaleDate ?? undefined,
    is_low_stock:
      trackInventory && lowStockThreshold > 0 && currentStock <= lowStockThreshold,
    profit_margin:
      salePrice > 0 ? (((salePrice - costPrice) / salePrice) * 100).toFixed(2) : "0.00",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function localMovementToApi(row: LocalStockMovement): StockMovement {
  return {
    _id: row.id,
    product: row.product_id,
    type: row.type,
    quantity: Number(row.quantity),
    unit_cost: Number(row.unit_cost ?? 0),
    stock_after: Number(row.stock_after ?? 0),
    notes: row.notes ?? undefined,
    date: row.date,
    createdAt: row.created_at,
  };
}

export function localInvoiceToApi(
  row: LocalInvoice,
  items: LocalInvoiceItem[],
  payments: LocalInvoicePayment[],
  party?: Party | null,
): Invoice {
  return {
    _id: row.id,
    organization: row.organization_id ?? undefined,
    admin: row.admin_id ?? "",
    invoice_number: row.invoice_number,
    type: row.type,
    status: row.status,
    party: party ?? undefined,
    party_name: row.party_name ?? undefined,
    party_phone: row.party_phone ?? undefined,
    party_address: row.party_address ?? undefined,
    date: row.date,
    due_date: row.due_date ?? undefined,
    items: items.map((i) => ({
      _id: i.id,
      description: i.description,
      quantity: Number(i.quantity),
      unit: i.unit ?? undefined,
      unit_price: Number(i.unit_price),
      discount: Number(i.discount ?? 0),
      discount_type: i.discount_type,
      tax_rate: Number(i.tax_rate ?? 0),
      subtotal: Number(i.subtotal ?? 0),
      discount_amount: Number(i.discount_amount ?? 0),
      tax_amount: Number(i.tax_amount ?? 0),
      total: Number(i.total ?? 0),
      notes: i.notes ?? undefined,
      product: i.product_id ?? undefined,
      barcode: i.barcode_snapshot ?? undefined,
      unit_cost_at_sale: i.unit_cost_at_sale ?? undefined,
    })),
    subtotal: Number(row.subtotal ?? 0),
    total_discount: Number(row.total_discount ?? 0),
    total_tax: Number(row.total_tax ?? 0),
    shipping_charge: Number(row.shipping_charge ?? 0),
    adjustment: Number(row.adjustment ?? 0),
    adjustment_description: row.adjustment_description ?? undefined,
    grand_total: Number(row.grand_total ?? 0),
    amount_paid: Number(row.amount_paid ?? 0),
    balance_due: Number(row.balance_due ?? 0),
    notes: row.notes ?? undefined,
    terms: row.terms ?? undefined,
    internal_notes: row.internal_notes ?? undefined,
    payments: payments.map((p) => ({
      _id: p.id,
      date: p.date,
      amount: Number(p.amount),
      method: (p.method as InvoicePayment["method"]) ?? "cash",
      account: p.account_id ?? undefined,
      transaction: p.transaction_id ?? undefined,
      reference: p.reference ?? undefined,
      notes: p.notes ?? undefined,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

