import { partiesApi } from "@/services/parties";
import { productsApi } from "@/services/products";
import { invoicesApi } from "@/services/invoices";
import { organizationsApi } from "@/services/organizations";
import { api } from "@/lib/api";
import { getDb, withDbTransaction } from "@/db/client";
import * as productsRepo from "@/db/repos/products";
import * as invoicesRepo from "@/db/repos/invoices";
import { cacheOrganizations } from "@/data/organizations";
import { META_KEYS, setMeta } from "@/db/meta";
import { importLocalBackup } from "@/services/local-backup";
import type {
  LocalInvoice,
  LocalInvoiceItem,
  LocalInvoicePayment,
  LocalProduct,
} from "@/db/types";
import {
  getLocalFirstFlagsSync,
  setLocalFirstFlags,
} from "@/lib/local-first/flags";
import {
  errorCodeFromUnknown,
  trackLfEvent,
} from "@/lib/local-first/telemetry";
import type { BackupData } from "@/services/backup";

/**
 * Map a populated /transactions API row into backup-v2 shape so import
 * keeps party / for / vendor / keyword / organization / payment fields.
 */
function apiTransactionToBackupRow(t: any) {
  const accountId =
    t.account?._id ?? t.account ?? t.account_id?._id ?? t.account_id ?? null;
  const categoryId =
    t.category?._id ??
    t.category_id?._id ??
    t.category_id ??
    t.category ??
    null;
  const partyId = t.party?._id ?? t.party ?? t.party_id ?? null;
  const forPartyId = t.for_party?._id ?? t.for_party ?? t.for_party_id ?? null;
  const organizationId =
    t.organization?._id ?? t.organization ?? t.organization_id ?? null;

  return {
    _originalId: String(t._id),
    _id: String(t._id),
    organization: organizationId ? String(organizationId) : null,
    _originalAccountId: accountId ? String(accountId) : null,
    _originalCategoryId: categoryId ? String(categoryId) : null,
    _originalPartyId: partyId ? String(partyId) : null,
    _originalForPartyId: forPartyId ? String(forPartyId) : null,
    account: accountId ? String(accountId) : null,
    category_id: categoryId ? String(categoryId) : null,
    party: partyId ? String(partyId) : null,
    for_party: forPartyId ? String(forPartyId) : null,
    amount: t.amount,
    type: t.type,
    date: t.date,
    description: t.description ?? null,
    keyword: t.keyword ?? t.comment ?? null,
    counterparty: t.counterparty ?? null,
    vendor: t.vendor ?? null,
    payment_status:
      t.payment_status === "due" || t.payment_status === "paid"
        ? t.payment_status
        : t.due_remaining != null && Number(t.due_remaining) > 0
          ? "due"
          : (t.payment_status ?? "paid"),
    due_date: t.due_date ?? null,
    due_group_id: t.due_group_id
      ? String(t.due_group_id._id || t.due_group_id)
      : null,
    parent_due_id: t.parent_due_id
      ? String(t.parent_due_id._id || t.parent_due_id)
      : null,
    due_remaining: t.due_remaining ?? null,
    due_settled_at: t.due_settled_at ?? null,
    party_balance_after: t.party_balance_after ?? null,
    meta_data: t.meta_data ?? null,
    balance_after_transaction: t.balance_after_transaction ?? null,
    client_request_id: t.client_request_id ?? null,
    transfer_id: t.transfer_id
      ? String(t.transfer_id._id || t.transfer_id)
      : null,
    transfer_direction: t.transfer_direction ?? null,
    attachments: t.attachments ?? [],
    is_deleted: t.is_deleted || false,
    deleted_at: t.deleted_at ?? null,
    createdAt: t.createdAt ?? t.created_at,
    updatedAt: t.updatedAt ?? t.updated_at,
  };
}

function rowId(row: any): string {
  return String(row._id || row._originalId || row.id || "");
}

/** Prefer non-empty / non-null fields from `richer` onto `base`. */
function mergeTxnRows(base: any, richer: any): any {
  const out = { ...base };
  const keys = [
    "description",
    "keyword",
    "comment",
    "counterparty",
    "vendor",
    "party",
    "for_party",
    "payment_status",
    "due_date",
    "due_group_id",
    "parent_due_id",
    "due_remaining",
    "due_settled_at",
    "category_id",
    "account",
    "organization",
    "attachments",
    "_originalPartyId",
    "_originalForPartyId",
    "_originalCategoryId",
    "_originalAccountId",
    "_originalOrganizationId",
  ] as const;
  for (const k of keys) {
    const v = richer[k];
    if (v === undefined || v === null || v === "") continue;
    if (out[k] === undefined || out[k] === null || out[k] === "") {
      out[k] = v;
    } else if (k === "description" || k === "keyword" || k === "vendor") {
      // Prefer longer textual fields from populated API rows.
      if (String(v).length > String(out[k] ?? "").length) out[k] = v;
    } else if (k === "payment_status") {
      // Never let a thin/default "paid" overwrite a real "due".
      if (out[k] !== "due" && v === "due") out[k] = "due";
    } else if (k === "due_remaining") {
      // Prefer a positive remaining from the richer/API row.
      if (Number(v) > 0 && !(Number(out[k]) > 0)) out[k] = v;
    }
  }
  // Always take relational ids from populated API when present.
  if (richer.party) out.party = richer.party;
  if (richer.for_party) out.for_party = richer.for_party;
  if (richer._originalPartyId) out._originalPartyId = richer._originalPartyId;
  if (richer._originalForPartyId)
    out._originalForPartyId = richer._originalForPartyId;
  if (richer.keyword || richer.comment) {
    out.keyword = richer.keyword ?? richer.comment ?? out.keyword;
  }
  if (richer.description) out.description = richer.description;
  if (richer.vendor) out.vendor = richer.vendor;
  // Force due only for real open dues (remaining + due_date). Migrating
  // due_remaining alone used to mark paid cash rows as due and shrink wallets.
  if (
    out.due_remaining != null &&
    Number(out.due_remaining) > 0 &&
    !out.parent_due_id &&
    !out.due_settled_at &&
    out.due_date
  ) {
    out.payment_status = "due";
  }
  return out;
}

async function fetchCloudTransactionsPage(
  organizationId: string | null,
): Promise<any[]> {
  const out: any[] = [];
  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const params: Record<string, string | number> = { page, limit: 100 };
    if (organizationId) params.organization = organizationId;
    const { data } = await api.get<{
      transactions: any[];
      pagination?: { page: number; pages: number; total: number };
    }>("/transactions", { params });
    out.push(...(data.transactions ?? []));
    pages = Math.max(1, Number(data.pagination?.pages ?? 1));
    page += 1;
    if (page > 1000) break;
  }
  return out;
}

/** Personal + every organization the user belongs to. */
async function fetchAllCloudTransactions(): Promise<any[]> {
  const byId = new Map<string, any>();

  try {
    const personal = await fetchCloudTransactionsPage(null);
    for (const t of personal) byId.set(String(t._id), t);
  } catch (e) {
    console.warn("[migrate] personal transactions failed", e);
  }

  try {
    const orgs = await organizationsApi.list();
    for (const org of orgs || []) {
      const id = (org as any).id || org._id;
      if (!id) continue;
      try {
        const rows = await fetchCloudTransactionsPage(String(id));
        for (const t of rows) byId.set(String(t._id), t);
      } catch (e) {
        console.warn(`[migrate] org ${id} transactions failed`, e);
      }
    }
  } catch (e) {
    console.warn(
      "[migrate] list organizations failed — keeping backup-export transactions",
      e,
    );
  }

  return [...byId.values()];
}

async function fetchAllParties(): Promise<any[]> {
  const byId = new Map<string, any>();

  const pushList = async (params: Record<string, any>) => {
    try {
      const listed = await partiesApi.list({
        ...params,
        limit: 10000,
        page: 1,
      });
      for (const p of listed.parties || []) {
        byId.set(String(p._id), p);
      }
    } catch {
      /* ignore */
    }
  };

  await pushList({ scope: "personal" });
  try {
    const orgs = await organizationsApi.list();
    for (const org of orgs || []) {
      const id = (org as any).id || org._id;
      if (id) await pushList({ organization: String(id) });
    }
  } catch {
    /* backup export still has parties */
  }

  return [...byId.values()];
}

/** Personal + every organization product catalog (paginated). */
async function fetchAllCloudProducts(): Promise<any[]> {
  const byId = new Map<string, any>();

  const pushList = async (params: Record<string, any>) => {
    try {
      let page = 1;
      let pages = 1;
      while (page <= pages) {
        const listed = await productsApi.list({ ...params, page, limit: 200 });
        for (const p of listed.products || []) byId.set(String(p._id), p);
        pages = Math.max(1, Number(listed.pagination?.pages ?? 1));
        page += 1;
        if (page > 500) break;
      }
    } catch (e) {
      console.warn("[migrate] product page failed", e);
    }
  };

  await pushList({});
  try {
    const orgs = await organizationsApi.list();
    for (const org of orgs || []) {
      const id = (org as any).id || org._id;
      if (id) await pushList({ organization: String(id) });
    }
  } catch {
    /* personal catalog still migrated */
  }

  return [...byId.values()];
}

/** Cloud product → local row. Migrated rows are clean (id = server id). */
function cloudProductToLocal(p: any): LocalProduct {
  const serverId = String(p._id);
  const purchase = Number(p.purchase_price ?? 0);
  const additional = Number(p.additional_cost ?? 0);
  const created = p.createdAt ?? p.created_at ?? new Date().toISOString();
  const updated = p.updatedAt ?? p.updated_at ?? created;
  const organizationId = p.organization
    ? String(p.organization._id ?? p.organization)
    : null;
  const categoryId = p.category_id
    ? String(p.category_id._id ?? p.category_id)
    : null;

  return {
    id: serverId,
    server_id: serverId,
    organization_id: organizationId,
    admin_id: p.admin ? String(p.admin._id ?? p.admin) : null,
    name: p.name,
    sku: p.sku ?? null,
    barcode: p.barcode ?? null,
    description: p.description ?? null,
    category_id: categoryId,
    brand: p.brand ?? null,
    unit: p.unit ?? "pcs",
    image_uri: p.images?.[0]?.url ?? null,
    purchase_price: purchase,
    additional_cost: additional,
    cost_price: Number(p.cost_price ?? purchase + additional),
    sale_price: Number(p.sale_price ?? 0),
    tax_rate: Number(p.tax_rate ?? 0),
    current_stock: Number(p.current_stock ?? 0),
    opening_stock: Number(p.opening_stock ?? 0),
    low_stock_threshold: Number(p.low_stock_threshold ?? 0),
    track_inventory: p.track_inventory === false ? 0 : 1,
    supplier_party_id: null,
    is_active: p.is_active === false ? 0 : 1,
    meta_data_json: p.meta_data ? JSON.stringify(p.meta_data) : null,
    created_at: created,
    updated_at: updated,
    deleted_at: p.is_deleted ? (p.deleted_at ?? null) : null,
    dirty: 0,
    sync_version: 0,
    client_request_id: null,
    device_id: "migrate",
    sync_status: "synced",
    retry_count: 0,
    last_sync_error: null,
  };
}

/** Personal + every organization invoices (paginated; items/payments included). */
async function fetchAllCloudInvoices(): Promise<any[]> {
  const byId = new Map<string, any>();

  const pushList = async (params: Record<string, any>) => {
    try {
      let page = 1;
      let pages = 1;
      while (page <= pages) {
        const listed = await invoicesApi.list({ ...params, page, limit: 100 });
        for (const inv of listed.invoices || []) byId.set(String(inv._id), inv);
        pages = Math.max(1, Number(listed.pagination?.pages ?? 1));
        page += 1;
        if (page > 500) break;
      }
    } catch (e) {
      console.warn("[migrate] invoice page failed", e);
    }
  };

  await pushList({});
  try {
    const orgs = await organizationsApi.list();
    for (const org of orgs || []) {
      const id = (org as any).id || org._id;
      if (id) await pushList({ organization: String(id) });
    }
  } catch {
    /* personal invoices still migrated */
  }

  return [...byId.values()];
}

const idStr = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === "object") return v._id ? String(v._id) : null;
  return String(v);
};

function cloudInvoiceToLocal(inv: any): {
  invoice: LocalInvoice;
  items: LocalInvoiceItem[];
  payments: LocalInvoicePayment[];
} {
  const serverId = String(inv._id);
  const created = inv.createdAt ?? inv.created_at ?? new Date().toISOString();
  const updated = inv.updatedAt ?? inv.updated_at ?? created;
  const deletedAt = inv.deleted_at ?? null;

  const invoice: LocalInvoice = {
    id: serverId,
    server_id: serverId,
    organization_id: idStr(inv.organization),
    admin_id: idStr(inv.admin),
    invoice_number: inv.invoice_number,
    number_seq: null,
    type: inv.type === "purchase" ? "purchase" : "sale",
    status: inv.status ?? "pending",
    party_id: idStr(inv.party),
    party_name: inv.party_name ?? (inv.party?.name as string) ?? null,
    party_phone: inv.party_phone ?? null,
    party_address: inv.party_address ?? null,
    date: inv.date,
    due_date: inv.due_date ?? null,
    subtotal: Number(inv.subtotal ?? 0),
    total_discount: Number(inv.total_discount ?? 0),
    total_tax: Number(inv.total_tax ?? 0),
    shipping_charge: Number(inv.shipping_charge ?? 0),
    adjustment: Number(inv.adjustment ?? 0),
    adjustment_description: inv.adjustment_description ?? null,
    grand_total: Number(inv.grand_total ?? 0),
    amount_paid: Number(inv.amount_paid ?? 0),
    balance_due: Number(inv.balance_due ?? 0),
    notes: inv.notes ?? null,
    terms: inv.terms ?? null,
    internal_notes: inv.internal_notes ?? null,
    linked_transaction_ids_json: Array.isArray(inv.linked_transactions)
      ? JSON.stringify(inv.linked_transactions.map((t: any) => idStr(t)))
      : null,
    created_at: created,
    updated_at: updated,
    deleted_at: deletedAt,
    dirty: 0,
    sync_version: 0,
    client_request_id: null,
    device_id: "migrate",
    sync_status: "synced",
    retry_count: 0,
    last_sync_error: null,
  };

  const items: LocalInvoiceItem[] = (inv.items ?? []).map(
    (it: any, idx: number): LocalInvoiceItem => ({
      id: it._id ? String(it._id) : `${serverId}:item:${idx}`,
      invoice_id: serverId,
      product_id: idStr(it.product),
      description: it.description ?? "",
      quantity: Number(it.quantity ?? 1),
      unit: it.unit ?? null,
      unit_price: Number(it.unit_price ?? 0),
      discount: Number(it.discount ?? 0),
      discount_type: it.discount_type === "percent" ? "percent" : "fixed",
      tax_rate: Number(it.tax_rate ?? 0),
      subtotal: Number(it.subtotal ?? 0),
      discount_amount: Number(it.discount_amount ?? 0),
      tax_amount: Number(it.tax_amount ?? 0),
      total: Number(it.total ?? 0),
      unit_cost_at_sale:
        it.unit_cost_at_sale === undefined || it.unit_cost_at_sale === null
          ? null
          : Number(it.unit_cost_at_sale),
      barcode_snapshot: it.barcode ?? null,
      category_id: idStr(it.category_id),
      notes: it.notes ?? null,
      created_at: created,
    }),
  );

  const payments: LocalInvoicePayment[] = (inv.payments ?? []).map(
    (p: any, idx: number): LocalInvoicePayment => ({
      id: p._id ? String(p._id) : `${serverId}:pay:${idx}`,
      invoice_id: serverId,
      date: p.date ?? created,
      amount: Number(p.amount ?? 0),
      method: p.method ?? null,
      account_id: idStr(p.account),
      transaction_id: idStr(p.transaction),
      reference: p.reference ?? null,
      notes: p.notes ?? null,
      created_at: created,
    }),
  );

  return { invoice, items, payments };
}

async function withBudget<T>(
  label: string,
  ms: number,
  work: () => Promise<T>,
  fallback: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      work(),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[migrate] ${label} timed out after ${ms}ms — continuing`);
          resolve(fallback);
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Cloud → local migration. Imports personal + organization ledgers into SQLite
 * with relational fields (party, for_party, category, description, etc.).
 *
 * Strategy: `/backup/export` is the full admin dump (never discard it). Overlay
 * populated `/transactions` + `/parties` rows by id so names/relations enrich
 * without dropping org rows when org APIs 401. Overlay is best-effort and
 * budgeted so Migrate never spins forever on slow Vercel cold starts.
 */
export async function migrateCloudToLocal(opts?: {
  force?: boolean;
}): Promise<{ migrated: boolean; summary?: Record<string, number> }> {
  const flags = getLocalFirstFlagsSync();
  if (flags.migrationCompletedAt && !opts?.force) {
    return { migrated: false };
  }

  const { pauseSyncForMaintenance, setSyncPaused } = await import(
    "@/sync/engine"
  );
  await pauseSyncForMaintenance(45_000);

  try {
    const { data } = await api.get<BackupData>("/backup/export", {
      // Full ledger dump — default 15s axios timeout is too short on cold start.
      timeout: 120_000,
    });
    const payload = (data as any).data ?? {};

    const txnById = new Map<string, any>();
    for (const t of payload.transactions ?? []) {
      const id = rowId(t);
      if (id) txnById.set(id, t);
    }

    const partyById = new Map<string, any>();
    for (const p of payload.parties ?? []) {
      const id = rowId(p);
      if (id) partyById.set(id, p);
    }

    // Overlay is optional enrichment. When backup already has the ledger,
    // skip the multi-page /transactions crawl (that hung Migrate for minutes).
    await withBudget("parties overlay", 30_000, async () => {
      try {
        const parties = await fetchAllParties();
        for (const p of parties) {
          const id = String(p._id);
          const prev = partyById.get(id);
          partyById.set(id, prev ? { ...prev, ...p } : p);
        }
      } catch {
        /* backup parties stand alone */
      }
      return null;
    }, null);

    if (txnById.size === 0) {
      await withBudget("transactions overlay", 60_000, async () => {
        try {
          const apiTxns = await fetchAllCloudTransactions();
          for (const t of apiTxns) {
            const mapped = apiTransactionToBackupRow(t);
            const id = rowId(mapped);
            if (!id) continue;
            const prev = txnById.get(id);
            txnById.set(id, prev ? mergeTxnRows(prev, mapped) : mapped);
          }
        } catch (e) {
          console.warn(
            "[migrate] full transaction fetch failed — using backup export rows",
            e,
          );
        }
        return null;
      }, null);
    }

    payload.transactions = [...txnById.values()];
    payload.parties = [...partyById.values()];
    (data as any).data = payload;

    const summary = await importLocalBackup(data, {
      mode: "replace",
      wipeAll: true,
    });
    const completedAt = new Date().toISOString();
    const db = await getDb();

    // Shop foundation (Phase 2): seed product catalog + shop settings cache.
    // Best-effort — ledger migration must never fail if shop APIs 404.
    let productsCount = 0;
    let productsSkipped = 0;
    await withBudget("products seed", 45_000, async () => {
      try {
        const cloudProducts = await fetchAllCloudProducts();
        for (const p of cloudProducts) {
          try {
            await productsRepo.upsertProductFromSync(db, cloudProductToLocal(p));
            productsCount += 1;
          } catch (e) {
            productsSkipped += 1;
            console.warn(
              "[migrate] skipped product (duplicate barcode?)",
              (p as any)?.name,
              e,
            );
          }
        }
      } catch (e) {
        console.warn("[migrate] product seed failed", e);
      }
      return null;
    }, null);

    let invoicesCount = 0;
    let invoicesSkipped = 0;
    await withBudget("invoices seed", 45_000, async () => {
      try {
        const cloudInvoices = await fetchAllCloudInvoices();
        await withDbTransaction(db, async (txn) => {
          for (const inv of cloudInvoices) {
            try {
              const mapped = cloudInvoiceToLocal(inv);
              await invoicesRepo.upsertInvoiceFromSync(txn, mapped.invoice);
              for (const it of mapped.items) {
                await invoicesRepo.upsertInvoiceItemFromSync(txn, it);
              }
              for (const p of mapped.payments) {
                await invoicesRepo.upsertInvoicePaymentFromSync(txn, p);
              }
              invoicesCount += 1;
            } catch (e) {
              invoicesSkipped += 1;
              console.warn("[migrate] skipped invoice", (inv as any)?._id, e);
            }
          }
        });
      } catch (e) {
        console.warn("[migrate] invoice seed failed", e);
      }
      return null;
    }, null);

    try {
      const orgs = await organizationsApi.list();
      await cacheOrganizations(orgs);
    } catch (e) {
      console.warn("[migrate] org cache seed failed", e);
    }

    // Align wallets to Mongo current_balance (নগদ 16343 / বিকাশ 5737 / ব্যাংক 612888).
    try {
      const { reconcileAccountOpeningsFromCloud } = await import(
        "@/lib/local-first/reconcile-account-openings"
      );
      await withBudget(
        "opening reconcile",
        20_000,
        () => reconcileAccountOpeningsFromCloud(db),
        { updated: 0 },
      );
    } catch (e) {
      console.warn("[migrate] opening reconcile skipped", e);
    }

    await setMeta(db, META_KEYS.MIGRATION_COMPLETED_AT, completedAt);
    // Fresh full export already includes org books — skip epoch re-pull.
    await setMeta(db, META_KEYS.LAST_SYNC_CURSOR, completedAt);
    await setMeta(db, META_KEYS.SYNC_SCOPE_VERSION, "2");
    await setMeta(db, META_KEYS.LAST_SYNC_ERROR, null);
    await setLocalFirstFlags({
      localFirstEnabled: true,
      migrationCompletedAt: completedAt,
    });

    void trackLfEvent("migration_success", {
      count: summary.transactionsCount,
    });

    return {
      migrated: true,
      summary: {
        accountsCount: summary.accountsCount,
        categoriesCount: summary.categoriesCount,
        partiesCount: summary.partiesCount,
        transactionsCount: summary.transactionsCount,
        transfersCount: summary.transfersCount,
        productsCount,
        productsSkipped,
        invoicesCount,
        invoicesSkipped,
      },
    };
  } catch (e) {
    void trackLfEvent("migration_fail", { code: errorCodeFromUnknown(e) });
    throw e;
  } finally {
    setSyncPaused(false);
  }
}
