import { getDb, withDbTransaction } from "@/db/client";
import * as invoicesRepo from "@/db/repos/invoices";
import * as partiesRepo from "@/db/repos/parties";
import * as productsRepo from "@/db/repos/products";
import * as transactionsRepo from "@/db/repos/transactions";
import { applyStockMovement } from "@/db/stock";
import type { LocalInvoice } from "@/db/types";
import { localInvoiceToApi, localPartyToApi } from "./mappers";
import {
  invoicesApi,
  type CreateInvoiceParams,
  type Invoice,
  type InvoiceSummary,
  type InvoicesListResponse,
  type ListInvoicesParams,
  type RecordPaymentParams,
} from "@/services/invoices";
import { isDualWriteEnabled } from "@/lib/local-first/flags";
import { getOrCreateDeviceId } from "@/services/device";

export type CreateInvoiceDALParams = CreateInvoiceParams & {
  payment_mode?: "cash" | "due" | "partial";
  initial_payment_amount?: string | number;
  initial_payment_account?: string;
  initial_payment_method?: string;
  initial_payment_reference?: string;
  initial_payment_notes?: string;
};

async function resolveLocalInvoice(invoiceId: string) {
  const db = await getDb();
  let row = await invoicesRepo.getInvoiceById(db, invoiceId);
  if (!row) row = await invoicesRepo.getInvoiceByServerId(db, invoiceId);
  return { db, row };
}

async function mapInvoice(
  db: Awaited<ReturnType<typeof getDb>>,
  row: LocalInvoice,
): Promise<Invoice> {
  const [items, payments] = await Promise.all([
    invoicesRepo.listInvoiceItems(db, row.id),
    invoicesRepo.listInvoicePayments(db, row.id),
  ]);
  let party = null;
  if (row.party_id) {
    const partyRow = await partiesRepo.getPartyById(db, row.party_id);
    if (partyRow) party = localPartyToApi(partyRow);
  }
  return localInvoiceToApi(row, items, payments, party);
}

async function resolveLocalProductForLine(
  db: Awaited<ReturnType<typeof getDb>>,
  item: { local_product_id?: string; product?: string },
) {
  if (item.local_product_id) {
    const byLocal = await productsRepo.getProductById(db, item.local_product_id);
    if (byLocal && !byLocal.deleted_at) return byLocal;
  }
  if (item.product) {
    const byServer = await productsRepo.getProductByServerId(db, item.product);
    if (byServer && !byServer.deleted_at) return byServer;
  }
  return null;
}

export async function fetchLocalInvoices(
  params?: ListInvoicesParams,
  opts?: { includeItems?: boolean },
): Promise<InvoicesListResponse> {
  const db = await getDb();
  const page = Math.max(1, Number(params?.page ?? 1));
  const limit = Math.max(1, Number(params?.limit ?? 50));

  const { invoices, total } = await invoicesRepo.listInvoices(
    db,
    { organizationId: params?.organization ?? null },
    {
      type: params?.type,
      status: params?.status,
      partyId: params?.party,
      startDate: params?.startDate,
      endDate: params?.endDate,
      search: params?.search,
    },
    { limit, offset: (page - 1) * limit },
  );

  const mapped: Invoice[] = [];
  for (const row of invoices) {
    if (opts?.includeItems) {
      mapped.push(await mapInvoice(db, row));
    } else {
      mapped.push(localInvoiceToApi(row, [], []));
    }
  }

  return {
    invoices: mapped,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function fetchLocalInvoice(invoiceId: string): Promise<Invoice> {
  const { db, row } = await resolveLocalInvoice(invoiceId);
  if (!row) throw new Error("Invoice not found");
  return mapInvoice(db, row);
}

/**
 * Offline invoice create. One transaction covers: numbering, header, items,
 * stock movements, the paid ledger transaction and the payment row.
 */
export async function createLocalInvoice(
  params: CreateInvoiceDALParams,
): Promise<Invoice> {
  const db = await getDb();
  const device_id = await getOrCreateDeviceId();
  const orgId = params.organization ?? null;

  const items = (params.items ?? []).filter((i) => i.description?.trim());
  if (!items.length) throw new Error("At least one item is required");

  const partyRow = params.party
    ? await partiesRepo.getPartyById(db, params.party)
    : null;

  const itemTotals = items.map((i) =>
    invoicesRepo.computeItemTotals({
      quantity: Number(i.quantity) || 0,
      unit_price: Number(i.unit_price) || 0,
      discount: i.discount,
      discount_type: i.discount_type,
      tax_rate: i.tax_rate,
    }),
  );
  const agg = invoicesRepo.computeInvoiceTotals(itemTotals);
  const shipping = Number(params.shipping_charge ?? 0);
  const adjustment = Number(params.adjustment ?? 0);
  const grandTotal =
    agg.subtotal - agg.total_discount + agg.total_tax + shipping + adjustment;
  if (grandTotal < 0) {
    throw new Error("Invoice total cannot be negative");
  }

  const mode = params.payment_mode ?? "due";
  const rawPaid =
    mode === "cash"
      ? grandTotal
      : mode === "partial"
        ? Math.min(Number(params.initial_payment_amount) || 0, grandTotal)
        : 0;
  const paid = Math.max(0, rawPaid);
  const balanceDue = Math.max(0, grandTotal - paid);
  const invoiceDate = params.date ?? new Date().toISOString();

  let createdId: string | undefined;
  await withDbTransaction(db, async (txn) => {
    const { invoice_number, number_seq } = await invoicesRepo.nextInvoiceNumber(
      txn,
      orgId,
      params.type,
    );
    const status = invoicesRepo.deriveInvoiceStatus(
      grandTotal,
      paid,
      "pending",
      params.due_date,
    );

    const header = await invoicesRepo.insertInvoice(txn, {
      organization_id: orgId,
      invoice_number,
      number_seq,
      type: params.type,
      status,
      party_id: params.party ?? null,
      party_name: params.party_name ?? partyRow?.name ?? null,
      party_phone: params.party_phone ?? partyRow?.phone ?? null,
      party_address: params.party_address ?? null,
      date: invoiceDate,
      due_date: params.due_date ?? null,
      subtotal: agg.subtotal,
      total_discount: agg.total_discount,
      total_tax: agg.total_tax,
      shipping_charge: shipping,
      adjustment,
      adjustment_description: params.adjustment_description ?? null,
      grand_total: grandTotal,
      amount_paid: paid,
      balance_due: balanceDue,
      notes: params.notes ?? null,
      terms: params.terms ?? null,
      internal_notes: params.internal_notes ?? null,
      device_id,
    });
    createdId = header.id;

    for (const it of items) {
      const product = await resolveLocalProductForLine(txn, it);
      const qty = Number(it.quantity) || 0;
      const unitPrice = Number(it.unit_price) || 0;
      // Cost basis is captured at transaction time, never recomputed later.
      const unitCostAtSale = product
        ? params.type === "sale"
          ? Number(product.cost_price)
          : unitPrice
        : params.type === "purchase"
          ? unitPrice
          : null;

      await invoicesRepo.insertInvoiceItem(txn, header.id, {
        description: it.description,
        quantity: qty,
        unit: it.unit,
        unit_price: unitPrice,
        discount: it.discount,
        discount_type: it.discount_type,
        tax_rate: it.tax_rate,
        unit_cost_at_sale: unitCostAtSale,
        barcode_snapshot: it.barcode ?? null,
        product_id: product?.id ?? null,
        notes: it.notes,
      });

      if (product && product.track_inventory && qty > 0) {
        await applyStockMovement(txn, {
          product_id: product.id,
          organization_id: orgId,
          type: params.type === "purchase" ? "purchase" : "sale",
          quantity: params.type === "purchase" ? qty : -qty,
          unit_cost: Number(unitCostAtSale ?? 0),
          reference_type: "invoice",
          reference_id: header.id,
          notes: `${params.type === "purchase" ? "Purchase" : "Sale"} ${invoice_number}`,
          date: invoiceDate,
          device_id,
        });
      }
    }

    if (paid > 0) {
      const accountId = params.initial_payment_account || null;
      let txnId: string | null = null;
      if (accountId) {
        const ledger = await transactionsRepo.createTransaction(txn, {
          account_id: accountId,
          party_id: params.party ?? null,
          type: params.type === "sale" ? "credit" : "debit",
          amount: paid,
          date: invoiceDate,
          description: `Payment for invoice ${invoice_number}`,
          organization_id: orgId,
          device_id,
        });
        txnId = ledger.id;
      }
      await invoicesRepo.insertInvoicePayment(txn, header.id, {
        date: invoiceDate,
        amount: paid,
        method: params.initial_payment_method ?? "cash",
        account_id: accountId,
        transaction_id: txnId,
        reference: params.initial_payment_reference ?? null,
        notes: params.initial_payment_notes ?? null,
      });
      if (txnId) {
        await invoicesRepo.updateInvoice(txn, header.id, {
          linked_transaction_ids_json: JSON.stringify([txnId]),
        });
      }
    }
  });

  if (!createdId) throw new Error("Failed to create invoice");

  if (isDualWriteEnabled()) {
    try {
      const remote = await invoicesApi.create(params);
      if (remote?._id) {
        await db.runAsync(
          `UPDATE invoices SET server_id = ?, dirty = 0, sync_status = 'synced' WHERE id = ?`,
          remote._id,
          createdId,
        );
      }
    } catch (e) {
      console.warn("[dal] dual-write invoice create failed", e);
    }
  }

  const row = await invoicesRepo.getInvoiceById(db, createdId);
  if (!row) throw new Error("Invoice not found");
  return mapInvoice(db, row);
}

export async function recordLocalInvoicePayment(
  params: RecordPaymentParams,
): Promise<Invoice> {
  const { db, row } = await resolveLocalInvoice(params.invoiceId);
  if (!row) throw new Error("Invoice not found");
  if (row.status === "cancelled") {
    throw new Error("Cannot add payment to a cancelled invoice");
  }

  const remaining = Number(row.grand_total) - Number(row.amount_paid);
  const amount = Math.min(Math.max(0, Number(params.amount) || 0), remaining);
  if (amount <= 0) throw new Error("Invoice is already fully paid");

  const device_id = await getOrCreateDeviceId();
  const accountId =
    params.account && params.account !== "" ? params.account : null;

  let updated = row;
  await withDbTransaction(db, async (txn) => {
    let txnId: string | null = null;
    if (accountId) {
      const ledger = await transactionsRepo.createTransaction(txn, {
        account_id: accountId,
        party_id: row.party_id,
        type: row.type === "sale" ? "credit" : "debit",
        amount,
        date: params.date ?? new Date().toISOString(),
        description: `Payment for invoice ${row.invoice_number}`,
        organization_id: row.organization_id,
        device_id,
      });
      txnId = ledger.id;
    }

    await invoicesRepo.insertInvoicePayment(txn, row.id, {
      date: params.date ?? new Date().toISOString(),
      amount,
      method: params.method ?? "cash",
      account_id: accountId,
      transaction_id: txnId,
      reference: params.reference ?? null,
      notes: params.notes ?? null,
    });

    const totalPaid = Number(row.amount_paid) + amount;
    const balanceDue = Math.max(0, Number(row.grand_total) - totalPaid);
    const status = invoicesRepo.deriveInvoiceStatus(
      Number(row.grand_total),
      totalPaid,
      row.status,
      row.due_date,
    );

    let linked: string[] = [];
    if (row.linked_transaction_ids_json) {
      try {
        linked = JSON.parse(row.linked_transaction_ids_json);
      } catch {
        linked = [];
      }
    }
    if (txnId) linked.push(txnId);

    updated = await invoicesRepo.updateInvoice(txn, row.id, {
      amount_paid: totalPaid,
      balance_due: balanceDue,
      status,
      linked_transaction_ids_json: linked.length
        ? JSON.stringify(linked)
        : null,
      device_id,
    });
  });

  return mapInvoice(db, updated);
}

export async function updateLocalInvoiceStatus(
  invoiceId: string,
  status: Invoice["status"],
): Promise<Invoice> {
  const { db, row } = await resolveLocalInvoice(invoiceId);
  if (!row) throw new Error("Invoice not found");
  const device_id = await getOrCreateDeviceId();

  // Setting a status manually must not fabricate a payment.
  if (status === "paid" && Number(row.amount_paid) + 0.0001 < Number(row.grand_total)) {
    throw new Error("Record a payment to mark this invoice paid");
  }

  const patch: Parameters<typeof invoicesRepo.updateInvoice>[2] = {
    status,
    device_id,
  };
  const updated = await invoicesRepo.updateInvoice(db, row.id, patch);
  return mapInvoice(db, updated);
}

export async function deleteLocalInvoice(invoiceId: string): Promise<void> {
  const { db, row } = await resolveLocalInvoice(invoiceId);
  if (!row) throw new Error("Invoice not found");
  const device_id = await getOrCreateDeviceId();
  if (Number(row.amount_paid) > 0) {
    throw new Error("Cannot delete an invoice with payments. Cancel it instead.");
  }
  await invoicesRepo.softDeleteInvoice(db, row.id, device_id);
}

/**
 * Cancel ≠ return. Cancel is only allowed while nothing has been paid and
 * reverses the stock movement. Auditable returns arrive in Phase 8.
 */
export async function cancelLocalInvoice(invoiceId: string): Promise<Invoice> {
  const { db, row } = await resolveLocalInvoice(invoiceId);
  if (!row) throw new Error("Invoice not found");
  if (row.status === "cancelled") return mapInvoice(db, row);
  if (Number(row.amount_paid) > 0) {
    throw new Error("Cannot cancel an invoice with payments.");
  }

  const device_id = await getOrCreateDeviceId();
  let updated = row;
  await withDbTransaction(db, async (txn) => {
    const items = await invoicesRepo.listInvoiceItems(txn, row.id);
    for (const item of items) {
      if (!item.product_id) continue;
      const product = await productsRepo.getProductById(txn, item.product_id);
      if (!product || !product.track_inventory) continue;
      await applyStockMovement(txn, {
        product_id: product.id,
        organization_id: row.organization_id,
        type: row.type === "purchase" ? "purchase_return" : "sale_return",
        quantity: row.type === "purchase" ? -Number(item.quantity) : Number(item.quantity),
        unit_cost: Number(item.unit_cost_at_sale ?? product.cost_price),
        reference_type: "invoice_cancel",
        reference_id: row.id,
        notes: `Cancellation of ${row.invoice_number}`,
        device_id,
      });
    }
    updated = await invoicesRepo.updateInvoice(txn, row.id, {
      status: "cancelled",
      balance_due: 0,
      device_id,
    });
  });

  return mapInvoice(db, updated);
}

export async function fetchLocalInvoiceSummary(params?: {
  organization?: string;
  type?: "sale" | "purchase";
  startDate?: string;
  endDate?: string;
}): Promise<InvoiceSummary> {
  const db = await getDb();
  const summary = await invoicesRepo.getInvoiceSummary(
    db,
    { organizationId: params?.organization ?? null },
    {
      type: params?.type,
      startDate: params?.startDate,
      endDate: params?.endDate,
    },
  );
  // Local buckets are keyed by whatever statuses exist; the API type names all.
  return summary as InvoiceSummary;
}
