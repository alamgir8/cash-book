import {
  invoicesApi,
  type CreateInvoiceParams,
  type ListInvoicesParams,
  type RecordPaymentParams,
  type UpdateInvoiceParams,
} from "@/services/invoices";
import type { CreateInvoiceDALParams } from "./invoices.local";
import {
  ensureLocalFirstFlags,
  isLocalFirstEnabled,
} from "@/lib/local-first/flags";

/**
 * Shop invoice DAL — local-first when enabled, REST otherwise.
 * Reads, writes, payments and stock all resolve to SQLite offline.
 */
export async function dalFetchInvoices(params?: ListInvoicesParams) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) return invoicesApi.list(params);
  const local = await import("./invoices.local");
  return local.fetchLocalInvoices(params);
}

export async function dalFetchInvoice(invoiceId: string) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) return invoicesApi.get(invoiceId);
  const local = await import("./invoices.local");
  return local.fetchLocalInvoice(invoiceId);
}

export async function dalFetchInvoiceSummary(params?: {
  organization?: string;
  type?: "sale" | "purchase";
  startDate?: string;
  endDate?: string;
}) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) return invoicesApi.getSummary(params);
  const local = await import("./invoices.local");
  return local.fetchLocalInvoiceSummary(params);
}

export async function dalCreateInvoice(params: CreateInvoiceDALParams) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return invoicesApi.create(params as CreateInvoiceParams);
  }
  const local = await import("./invoices.local");
  return local.createLocalInvoice(params);
}

export async function dalUpdateInvoice(
  invoiceId: string,
  params: UpdateInvoiceParams,
) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return invoicesApi.update(invoiceId, params);
  }
  // Full offline invoice editing arrives with returns (Phase 8); until then
  // fall back to the API so behavior stays consistent when online.
  return invoicesApi.update(invoiceId, params);
}

export async function dalUpdateInvoiceStatus(
  invoiceId: string,
  status: Parameters<typeof invoicesApi.updateStatus>[1],
) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return invoicesApi.updateStatus(invoiceId, status);
  }
  const local = await import("./invoices.local");
  return local.updateLocalInvoiceStatus(invoiceId, status);
}

export async function dalRecordInvoicePayment(params: RecordPaymentParams) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) return invoicesApi.recordPayment(params);
  const local = await import("./invoices.local");
  return local.recordLocalInvoicePayment(params);
}

export async function dalDeleteInvoice(invoiceId: string) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) return invoicesApi.delete(invoiceId);
  const local = await import("./invoices.local");
  return local.deleteLocalInvoice(invoiceId);
}

export async function dalCancelInvoice(invoiceId: string, reason?: string) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) return invoicesApi.cancel(invoiceId, reason);
  const local = await import("./invoices.local");
  return local.cancelLocalInvoice(invoiceId);
}
