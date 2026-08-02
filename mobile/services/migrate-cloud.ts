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
    payment_status: t.payment_status ?? "paid",
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

  const personal = await fetchCloudTransactionsPage(null);
  for (const t of personal) byId.set(String(t._id), t);

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
    console.warn("[migrate] list organizations failed", e);
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
    /* ignore */
  }

  return [...byId.values()];
}

/**
 * Cloud → local migration. Imports personal + organization ledgers into SQLite
 * with relational fields (party, for_party, category, description, etc.).
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

    try {
      const parties = await fetchAllParties();
      if (parties.length) {
        (data as any).data.parties = parties;
      }
    } catch {
      /* backup may already include parties */
    }

    try {
      const apiTxns = await fetchAllCloudTransactions();
      if (apiTxns.length > 0) {
        (data as any).data.transactions = apiTxns.map(apiTransactionToBackupRow);
      }
    } catch (e) {
      console.warn(
        "[migrate] full transaction fetch failed — using backup export rows",
        e,
      );
    }

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
