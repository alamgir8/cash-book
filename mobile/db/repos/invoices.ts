import type { Db } from "../client";
import { scopeWhere } from "../meta";
import type {
  LocalInvoice,
  LocalInvoiceItem,
  LocalInvoicePayment,
  ScopeFilter,
} from "../types";
import { createClientRequestId, createLocalId, nowIso } from "@/lib/local-first/ids";

// ── Insert helpers ──────────────────────────────────────────────────────────
// Column-map builders guarantee SQL/param alignment for these wide rows.

function buildInsert(
  table: string,
  values: Record<string, unknown>,
): { sql: string; params: (string | number | null)[] } {
  const cols = Object.keys(values);
  return {
    sql: `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols
      .map(() => "?")
      .join(", ")})`,
    params: cols.map((c) => values[c] as string | number | null),
  };
}

function buildUpsert(
  table: string,
  values: Record<string, unknown>,
  conflictCol: string,
): { sql: string; params: (string | number | null)[] } {
  const cols = Object.keys(values);
  const insert = buildInsert(table, values);
  const updates = cols
    .filter((c) => c !== conflictCol)
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  return {
    sql: `${insert.sql} ON CONFLICT(${conflictCol}) DO UPDATE SET ${updates}`,
    params: insert.params,
  };
}

// ── Pure math (shared with the DAL) ─────────────────────────────────────────

export type ItemTotals = {
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
};

export function computeItemTotals(input: {
  quantity: number;
  unit_price: number;
  discount?: number;
  discount_type?: "fixed" | "percent";
  tax_rate?: number;
}): ItemTotals {
  const qty = Number(input.quantity) || 0;
  const price = Number(input.unit_price) || 0;
  const subtotal = qty * price;
  const discount =
    input.discount_type === "percent"
      ? (subtotal * (Number(input.discount) || 0)) / 100
      : Number(input.discount) || 0;
  const afterDiscount = subtotal - discount;
  const tax = (afterDiscount * (Number(input.tax_rate) || 0)) / 100;
  return {
    subtotal,
    discount_amount: discount,
    tax_amount: tax,
    total: afterDiscount + tax,
  };
}

export function computeInvoiceTotals(items: ItemTotals[]): {
  subtotal: number;
  total_discount: number;
  total_tax: number;
} {
  return items.reduce(
    (acc, i) => ({
      subtotal: acc.subtotal + i.subtotal,
      total_discount: acc.total_discount + i.discount_amount,
      total_tax: acc.total_tax + i.tax_amount,
    }),
    { subtotal: 0, total_discount: 0, total_tax: 0 },
  );
}

// ── Inputs ──────────────────────────────────────────────────────────────────

export type InvoiceHeaderInput = {
  id?: string;
  server_id?: string | null;
  organization_id?: string | null;
  admin_id?: string | null;
  invoice_number: string;
  number_seq?: number | null;
  type: "sale" | "purchase";
  status?: LocalInvoice["status"];
  party_id?: string | null;
  party_name?: string | null;
  party_phone?: string | null;
  party_address?: string | null;
  date: string;
  due_date?: string | null;
  subtotal?: number;
  total_discount?: number;
  total_tax?: number;
  shipping_charge?: number;
  adjustment?: number;
  adjustment_description?: string | null;
  grand_total?: number;
  amount_paid?: number;
  balance_due?: number;
  notes?: string | null;
  terms?: string | null;
  internal_notes?: string | null;
  linked_transaction_ids_json?: string | null;
  device_id: string;
  dirty?: number;
};

export type InvoiceItemInput = {
  id?: string;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  discount?: number;
  discount_type?: "fixed" | "percent";
  tax_rate?: number;
  unit_cost_at_sale?: number | null;
  barcode_snapshot?: string | null;
  category_id?: string | null;
  notes?: string | null;
};

export type InvoicePaymentInput = {
  id?: string;
  date: string;
  amount: number;
  method?: string | null;
  account_id?: string | null;
  transaction_id?: string | null;
  reference?: string | null;
  notes?: string | null;
};

export function deriveInvoiceStatus(
  grandTotal: number,
  amountPaid: number,
  current: LocalInvoice["status"],
  dueDate?: string | null,
): LocalInvoice["status"] {
  if (current === "cancelled" || current === "draft") return current;
  const due = grandTotal - amountPaid;
  if (due <= 0.0001) return "paid";
  if (amountPaid > 0) return "partial";
  if (dueDate && new Date(dueDate).getTime() < Date.now()) return "overdue";
  return "pending";
}

// ── Writes ──────────────────────────────────────────────────────────────────

export async function insertInvoice(
  txn: Db,
  input: InvoiceHeaderInput,
): Promise<LocalInvoice> {
  const id = input.id ?? (await createLocalId());
  const ts = nowIso();
  const { sql, params } = buildInsert("invoices", {
    id,
    server_id: input.server_id ?? null,
    organization_id: input.organization_id ?? null,
    admin_id: input.admin_id ?? null,
    invoice_number: input.invoice_number,
    number_seq: input.number_seq ?? null,
    type: input.type,
    status: input.status ?? "pending",
    party_id: input.party_id ?? null,
    party_name: input.party_name ?? null,
    party_phone: input.party_phone ?? null,
    party_address: input.party_address ?? null,
    date: input.date,
    due_date: input.due_date ?? null,
    subtotal: Number(input.subtotal ?? 0),
    total_discount: Number(input.total_discount ?? 0),
    total_tax: Number(input.total_tax ?? 0),
    shipping_charge: Number(input.shipping_charge ?? 0),
    adjustment: Number(input.adjustment ?? 0),
    adjustment_description: input.adjustment_description ?? null,
    grand_total: Number(input.grand_total ?? 0),
    amount_paid: Number(input.amount_paid ?? 0),
    balance_due: Number(input.balance_due ?? 0),
    notes: input.notes ?? null,
    terms: input.terms ?? null,
    internal_notes: input.internal_notes ?? null,
    linked_transaction_ids_json: input.linked_transaction_ids_json ?? null,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
    dirty: input.dirty ?? 1,
    sync_version: 0,
    client_request_id: createClientRequestId(),
    device_id: input.device_id,
    sync_status: "pending_create",
    retry_count: 0,
    last_sync_error: null,
  });
  await txn.runAsync(sql, ...params);

  const row = await getInvoiceById(txn, id);
  if (!row) throw new Error("Failed to create invoice");
  return row;
}

export async function insertInvoiceItem(
  txn: Db,
  invoiceId: string,
  input: InvoiceItemInput,
): Promise<LocalInvoiceItem> {
  const id = input.id ?? (await createLocalId());
  const totals = computeItemTotals(input);
  const { sql, params } = buildInsert("invoice_items", {
    id,
    invoice_id: invoiceId,
    product_id: input.product_id ?? null,
    description: input.description,
    quantity: Number(input.quantity ?? 1),
    unit: input.unit ?? null,
    unit_price: Number(input.unit_price ?? 0),
    discount: Number(input.discount ?? 0),
    discount_type: input.discount_type ?? "fixed",
    tax_rate: Number(input.tax_rate ?? 0),
    subtotal: totals.subtotal,
    discount_amount: totals.discount_amount,
    tax_amount: totals.tax_amount,
    total: totals.total,
    unit_cost_at_sale:
      input.unit_cost_at_sale === undefined
        ? null
        : input.unit_cost_at_sale,
    barcode_snapshot: input.barcode_snapshot ?? null,
    category_id: input.category_id ?? null,
    notes: input.notes ?? null,
    created_at: nowIso(),
  });
  await txn.runAsync(sql, ...params);

  const row = await txn.getFirstAsync<LocalInvoiceItem>(
    "SELECT * FROM invoice_items WHERE id = ?",
    id,
  );
  if (!row) throw new Error("Failed to create invoice item");
  return row;
}

export async function insertInvoicePayment(
  txn: Db,
  invoiceId: string,
  input: InvoicePaymentInput,
): Promise<LocalInvoicePayment> {
  const id = input.id ?? (await createLocalId());
  const { sql, params } = buildInsert("invoice_payments", {
    id,
    invoice_id: invoiceId,
    date: input.date,
    amount: Number(input.amount ?? 0),
    method: input.method ?? null,
    account_id: input.account_id ?? null,
    transaction_id: input.transaction_id ?? null,
    reference: input.reference ?? null,
    notes: input.notes ?? null,
    created_at: nowIso(),
  });
  await txn.runAsync(sql, ...params);

  const row = await txn.getFirstAsync<LocalInvoicePayment>(
    "SELECT * FROM invoice_payments WHERE id = ?",
    id,
  );
  if (!row) throw new Error("Failed to create invoice payment");
  return row;
}

export async function updateInvoice(
  db: Db,
  id: string,
  patch: Partial<
    Pick<
      LocalInvoice,
      | "status"
      | "amount_paid"
      | "balance_due"
      | "linked_transaction_ids_json"
      | "due_date"
      | "party_name"
      | "party_phone"
      | "party_address"
      | "notes"
      | "server_id"
    >
  > & { device_id?: string; markSynced?: boolean },
): Promise<LocalInvoice> {
  const existing = await getInvoiceById(db, id);
  if (!existing) throw new Error("Invoice not found");

  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "device_id" || k === "markSynced") continue;
    fields[k] = v;
  }
  fields.updated_at = nowIso();
  fields.dirty = patch.markSynced ? 0 : 1;
  fields.sync_status = patch.markSynced ? "synced" : "pending_update";
  fields.retry_count = 0;
  fields.last_sync_error = null;
  fields.device_id = patch.device_id ?? existing.device_id;
  fields.sync_version = existing.sync_version + 1;

  const cols = Object.keys(fields);
  await db.runAsync(
    `UPDATE invoices SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
    ...cols.map((c) => fields[c] as string | number | null),
    id,
  );

  const row = await getInvoiceById(db, id);
  if (!row) throw new Error("Invoice not found");
  return row;
}

export async function softDeleteInvoice(
  db: Db,
  id: string,
  device_id: string,
): Promise<void> {
  const ts = nowIso();
  const res = await db.runAsync(
    `UPDATE invoices SET deleted_at = ?, updated_at = ?, dirty = 1,
      sync_status = 'pending_delete', retry_count = 0, last_sync_error = NULL,
      device_id = ?, sync_version = sync_version + 1
     WHERE id = ? AND deleted_at IS NULL`,
    ts,
    ts,
    device_id,
    id,
  );
  if (!res.changes) throw new Error("Invoice not found");
}

// ── Reads ───────────────────────────────────────────────────────────────────

export async function getInvoiceById(
  db: Db,
  id: string,
): Promise<LocalInvoice | null> {
  return (
    (await db.getFirstAsync<LocalInvoice>(
      "SELECT * FROM invoices WHERE id = ?",
      id,
    )) ?? null
  );
}

export async function getInvoiceByServerId(
  db: Db,
  serverId: string,
): Promise<LocalInvoice | null> {
  return (
    (await db.getFirstAsync<LocalInvoice>(
      "SELECT * FROM invoices WHERE server_id = ? LIMIT 1",
      serverId,
    )) ?? null
  );
}

export async function listInvoiceItems(
  db: Db,
  invoiceId: string,
): Promise<LocalInvoiceItem[]> {
  return db.getAllAsync<LocalInvoiceItem>(
    "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY rowid ASC",
    invoiceId,
  );
}

export async function listInvoicePayments(
  db: Db,
  invoiceId: string,
): Promise<LocalInvoicePayment[]> {
  return db.getAllAsync<LocalInvoicePayment>(
    "SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY date ASC, rowid ASC",
    invoiceId,
  );
}

export type ListInvoiceFilters = {
  type?: "sale" | "purchase";
  status?: string;
  partyId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
};

export async function listInvoices(
  db: Db,
  scope?: ScopeFilter,
  filters?: ListInvoiceFilters,
  opts?: { limit?: number; offset?: number },
): Promise<{ invoices: LocalInvoice[]; total: number }> {
  const { sql, params } = scopeWhere("", scope);
  const clauses = [sql, "deleted_at IS NULL"];
  const values: (string | number)[] = [...params];

  if (filters?.type) {
    clauses.push("type = ?");
    values.push(filters.type);
  }
  if (filters?.status) {
    clauses.push("status = ?");
    values.push(filters.status);
  }
  if (filters?.partyId) {
    clauses.push("party_id = ?");
    values.push(filters.partyId);
  }
  if (filters?.startDate) {
    clauses.push("date >= ?");
    values.push(filters.startDate);
  }
  if (filters?.endDate) {
    clauses.push("date <= ?");
    values.push(filters.endDate);
  }
  if (filters?.search?.trim()) {
    const like = `%${filters.search.trim()}%`;
    clauses.push("(invoice_number LIKE ? OR COALESCE(party_name, '') LIKE ?)");
    values.push(like, like);
  }

  const where = clauses.join(" AND ");
  const limit = Math.max(1, Number(opts?.limit ?? 50));
  const offset = Math.max(0, Number(opts?.offset ?? 0));

  const rows = await db.getAllAsync<LocalInvoice>(
    `SELECT * FROM invoices WHERE ${where} ORDER BY date DESC, rowid DESC LIMIT ? OFFSET ?`,
    ...values,
    limit,
    offset,
  );
  const countRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM invoices WHERE ${where}`,
    ...values,
  );
  return { invoices: rows, total: Number(countRow?.c ?? rows.length) };
}

export type InvoiceSummaryBucket = {
  count: number;
  total: number;
  paid: number;
  due: number;
};

export async function getInvoiceSummary(
  db: Db,
  scope?: ScopeFilter,
  filters?: {
    type?: "sale" | "purchase";
    startDate?: string;
    endDate?: string;
  },
): Promise<{
  sales: InvoiceSummaryBucket & { by_status: Record<string, InvoiceSummaryBucket> };
  purchases: InvoiceSummaryBucket & {
    by_status: Record<string, InvoiceSummaryBucket>;
  };
}> {
  const { sql, params } = scopeWhere("", scope);
  const clauses = [sql, "deleted_at IS NULL", "status != 'cancelled'"];
  const values: (string | number)[] = [...params];
  if (filters?.type) {
    clauses.push("type = ?");
    values.push(filters.type);
  }
  if (filters?.startDate) {
    clauses.push("date >= ?");
    values.push(filters.startDate);
  }
  if (filters?.endDate) {
    clauses.push("date <= ?");
    values.push(filters.endDate);
  }

  const rows = await db.getAllAsync<{
    type: string;
    status: string;
    count: number;
    total: number;
    paid: number;
    due: number;
  }>(
    `SELECT type, status, COUNT(*) as count,
       COALESCE(SUM(grand_total), 0) as total,
       COALESCE(SUM(amount_paid), 0) as paid,
       COALESCE(SUM(balance_due), 0) as due
     FROM invoices WHERE ${clauses.join(" AND ")}
     GROUP BY type, status`,
    ...values,
  );

  const empty = () => ({
    total: 0,
    paid: 0,
    due: 0,
    count: 0,
    by_status: {} as Record<string, InvoiceSummaryBucket>,
  });
  const result = { sales: empty(), purchases: empty() };

  for (const r of rows) {
    const key = r.type === "sale" ? "sales" : "purchases";
    const bucket = result[key];
    bucket.total += Number(r.total);
    bucket.paid += Number(r.paid);
    bucket.due += Number(r.due);
    bucket.count += Number(r.count);
    bucket.by_status[r.status] = {
      count: Number(r.count),
      total: Number(r.total),
      paid: Number(r.paid),
      due: Number(r.due),
    };
  }
  return result;
}

// ── Numbering ───────────────────────────────────────────────────────────────

/**
 * Allocate the next local invoice number for an org. Reads the cached org
 * prefix/counter and advances it. Server numbering reconciles in Phase 13.
 */
export async function nextInvoiceNumber(
  db: Db,
  organizationId: string | null,
  type: "sale" | "purchase",
): Promise<{ invoice_number: string; number_seq: number }> {
  let prefix = type === "purchase" ? "PO" : "INV";
  let seq = 1;

  if (organizationId) {
    const org = await db.getFirstAsync<{
      invoice_prefix: string | null;
      invoice_next_number: number;
    }>(
      "SELECT invoice_prefix, invoice_next_number FROM organizations WHERE id = ?",
      organizationId,
    );
    if (org?.invoice_prefix && type === "sale") prefix = org.invoice_prefix;
    const countRow = await db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM invoices WHERE organization_id = ? AND type = ?",
      organizationId,
      type,
    );
    seq = Math.max(
      Number(org?.invoice_next_number ?? 1),
      Number(countRow?.c ?? 0) + 1,
    );
  } else {
    const countRow = await db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM invoices WHERE organization_id IS NULL AND type = ?",
      type,
    );
    seq = Number(countRow?.c ?? 0) + 1;
  }

  if (organizationId) {
    await db.runAsync(
      "UPDATE organizations SET invoice_next_number = ? WHERE id = ? AND invoice_next_number <= ?",
      seq + 1,
      organizationId,
      seq,
    );
  }

  return {
    invoice_number: `${prefix}-${String(seq).padStart(6, "0")}`,
    number_seq: seq,
  };
}

// ── Sync upserts (Phase 13 wiring) ──────────────────────────────────────────

export async function upsertInvoiceFromSync(
  db: Db,
  row: LocalInvoice,
): Promise<void> {
  const values: Record<string, unknown> = { ...row };
  values.sync_status = row.sync_status ?? (row.dirty ? "pending_update" : "synced");
  values.retry_count = row.retry_count ?? 0;
  values.last_sync_error = row.last_sync_error ?? null;
  const { sql, params } = buildUpsert("invoices", values, "id");
  await db.runAsync(sql, ...params);
}

export async function upsertInvoiceItemFromSync(
  db: Db,
  row: LocalInvoiceItem,
): Promise<void> {
  // Defensive: a server payload missing these must not abort the whole sync
  // (the columns are NOT NULL). `invoice_id` is also re-asserted from the row.
  const safe = {
    ...row,
    description: row.description ?? "",
    quantity: Number(row.quantity ?? 0),
    unit_price: Number(row.unit_price ?? 0),
    discount: Number(row.discount ?? 0),
    discount_type: row.discount_type === "percent" ? "percent" : "fixed",
    tax_rate: Number(row.tax_rate ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    discount_amount: Number(row.discount_amount ?? 0),
    tax_amount: Number(row.tax_amount ?? 0),
    total: Number(row.total ?? 0),
    created_at: row.created_at ?? nowIso(),
  };
  const { sql, params } = buildUpsert(
    "invoice_items",
    { ...(safe as unknown as Record<string, unknown>) },
    "id",
  );
  await db.runAsync(sql, ...params);
}

export async function upsertInvoicePaymentFromSync(
  db: Db,
  row: LocalInvoicePayment,
): Promise<void> {
  const safe = {
    ...row,
    amount: Number(row.amount ?? 0),
    date: row.date ?? nowIso(),
    created_at: row.created_at ?? nowIso(),
  };
  const { sql, params } = buildUpsert(
    "invoice_payments",
    { ...(safe as unknown as Record<string, unknown>) },
    "id",
  );
  await db.runAsync(sql, ...params);
}
