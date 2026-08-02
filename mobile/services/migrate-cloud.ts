import { partiesApi } from "@/services/parties";
import { organizationsApi } from "@/services/organizations";
import { api } from "@/lib/api";
import { getDb } from "@/db/client";
import { META_KEYS, setMeta } from "@/db/meta";
import { importLocalBackup } from "@/services/local-backup";
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
  // Force due when remaining balance says so (backup export sometimes defaults paid).
  if (
    out.due_remaining != null &&
    Number(out.due_remaining) > 0 &&
    !out.parent_due_id
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

/**
 * Cloud → local migration. Imports personal + organization ledgers into SQLite
 * with relational fields (party, for_party, category, description, etc.).
 *
 * Strategy: `/backup/export` is the full admin dump (never discard it). Overlay
 * populated `/transactions` + `/parties` rows by id so names/relations enrich
 * without dropping org rows when org APIs 401.
 */
export async function migrateCloudToLocal(opts?: {
  force?: boolean;
}): Promise<{ migrated: boolean; summary?: Record<string, number> }> {
  const flags = getLocalFirstFlagsSync();
  if (flags.migrationCompletedAt && !opts?.force) {
    return { migrated: false };
  }

  try {
    const { data } = await api.get<BackupData>("/backup/export");
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

    payload.transactions = [...txnById.values()];
    payload.parties = [...partyById.values()];
    (data as any).data = payload;

    const summary = await importLocalBackup(data, {
      mode: "replace",
      wipeAll: true,
    });
    const completedAt = new Date().toISOString();
    const db = await getDb();
    await setMeta(db, META_KEYS.MIGRATION_COMPLETED_AT, completedAt);
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
      },
    };
  } catch (e) {
    void trackLfEvent("migration_fail", { code: errorCodeFromUnknown(e) });
    throw e;
  }
}
