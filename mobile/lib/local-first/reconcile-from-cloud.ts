import type { Db } from "@/db/client";
import { api } from "@/lib/api";
import { organizationsApi } from "@/services/organizations";

type CloudTxn = Record<string, any>;

function refId(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "object" && value && "_id" in (value as object)) {
    const id = (value as { _id?: unknown })._id;
    return id != null && id !== "" ? String(id) : null;
  }
  return String(value);
}

function resolvePaymentStatus(row: CloudTxn): "paid" | "due" {
  const parent = refId(row.parent_due_id);
  if (parent) return "paid";
  if (row.due_settled_at) return "paid";
  const remaining =
    row.due_remaining != null && row.due_remaining !== ""
      ? Number(row.due_remaining)
      : null;
  if (remaining != null && remaining <= 0) return "paid";
  if (row.payment_status === "due") return "due";
  if (row.payment_status === "paid") return "paid";
  if (remaining != null && remaining > 0) return "due";
  return "paid";
}

async function fetchCloudPages(
  organizationId: string | null,
): Promise<CloudTxn[]> {
  const out: CloudTxn[] = [];
  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const params: Record<string, string | number> = { page, limit: 100 };
    if (organizationId) params.organization = organizationId;
    const { data } = await api.get<{
      transactions?: CloudTxn[];
      pagination?: { pages?: number };
    }>("/transactions", { params });
    out.push(...(data.transactions ?? []));
    pages = Math.max(1, Number(data.pagination?.pages ?? 1));
    page += 1;
    if (page > 1000) break;
  }
  return out;
}

/**
 * Overlay populated cloud fields onto existing SQLite rows so local-first
 * cards / Due+Loan filters / paid-only balances match cloud.
 *
 * Does not insert missing rows (migrate/re-download handles that) — only
 * repairs thin local copies of transactions that already exist.
 */
export async function reconcileLocalTxnDetailsFromCloud(
  db: Db,
): Promise<{ updated: number }> {
  const byId = new Map<string, CloudTxn>();

  try {
    for (const t of await fetchCloudPages(null)) {
      byId.set(String(t._id), t);
    }
  } catch (e) {
    console.warn("[reconcile] personal cloud fetch failed", e);
  }

  try {
    const orgs = await organizationsApi.list();
    for (const org of orgs || []) {
      const id = (org as any).id || org._id;
      if (!id) continue;
      try {
        for (const t of await fetchCloudPages(String(id))) {
          byId.set(String(t._id), t);
        }
      } catch (e) {
        console.warn(`[reconcile] org ${id} fetch failed`, e);
      }
    }
  } catch (e) {
    console.warn("[reconcile] org list failed", e);
  }

  if (!byId.size) return { updated: 0 };

  // Resolve local UUIDs for FKs that still arrive as Mongo ids.
  const [accounts, categories, parties] = await Promise.all([
    db.getAllAsync<{ id: string; server_id: string | null }>(
      `SELECT id, server_id FROM accounts WHERE deleted_at IS NULL`,
    ),
    db.getAllAsync<{ id: string; server_id: string | null }>(
      `SELECT id, server_id FROM categories WHERE deleted_at IS NULL`,
    ),
    db.getAllAsync<{ id: string; server_id: string | null }>(
      `SELECT id, server_id FROM parties WHERE deleted_at IS NULL`,
    ),
  ]);
  const accMap = new Map<string, string>();
  for (const a of accounts) {
    accMap.set(a.id, a.id);
    if (a.server_id) accMap.set(a.server_id, a.id);
  }
  const catMap = new Map<string, string>();
  for (const c of categories) {
    catMap.set(c.id, c.id);
    if (c.server_id) catMap.set(c.server_id, c.id);
  }
  const partyMap = new Map<string, string>();
  for (const p of parties) {
    partyMap.set(p.id, p.id);
    if (p.server_id) partyMap.set(p.server_id, p.id);
  }

  let updated = 0;
  for (const cloud of byId.values()) {
    const serverId = String(cloud._id);
    const local = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM transactions WHERE id = ? OR server_id = ? LIMIT 1`,
      serverId,
      serverId,
    );
    if (!local) continue;

    const accountRef = refId(cloud.account ?? cloud.account_id);
    const categoryRef = refId(cloud.category_id ?? cloud.category);
    const partyRef = refId(cloud.party ?? cloud.party_id);
    const forPartyRef = refId(cloud.for_party ?? cloud.for_party_id);
    const orgRef = refId(cloud.organization ?? cloud.organization_id);
    const parentRef = refId(cloud.parent_due_id);
    const keyword = cloud.keyword ?? cloud.comment ?? null;
    const paymentStatus = resolvePaymentStatus(cloud);

    const accountId = accountRef
      ? (accMap.get(accountRef) ?? accountRef)
      : null;
    const categoryId = categoryRef
      ? (catMap.get(categoryRef) ?? categoryRef)
      : null;
    const partyId = partyRef ? (partyMap.get(partyRef) ?? partyRef) : null;
    const forPartyId = forPartyRef
      ? (partyMap.get(forPartyRef) ?? forPartyRef)
      : null;

    const result = await db.runAsync(
      `UPDATE transactions SET
         server_id = COALESCE(server_id, ?),
         organization_id = CASE WHEN ? IS NOT NULL THEN ? ELSE organization_id END,
         account_id = CASE WHEN ? IS NOT NULL THEN ? ELSE account_id END,
         category_id = CASE WHEN ? IS NOT NULL THEN ? ELSE category_id END,
         party_id = CASE WHEN ? IS NOT NULL THEN ? ELSE party_id END,
         for_party_id = CASE WHEN ? IS NOT NULL THEN ? ELSE for_party_id END,
         description = CASE
           WHEN ? IS NOT NULL AND length(?) > 0 THEN ?
           ELSE description END,
         keyword = CASE
           WHEN ? IS NOT NULL AND length(?) > 0 THEN ?
           ELSE keyword END,
         vendor = CASE
           WHEN ? IS NOT NULL AND length(?) > 0 THEN ?
           ELSE vendor END,
         counterparty = CASE
           WHEN ? IS NOT NULL AND length(?) > 0 THEN ?
           ELSE counterparty END,
         payment_status = ?,
         due_remaining = CASE WHEN ? IS NOT NULL THEN ? ELSE due_remaining END,
         due_settled_at = CASE WHEN ? IS NOT NULL THEN ? ELSE due_settled_at END,
         due_date = CASE WHEN ? IS NOT NULL THEN ? ELSE due_date END,
         parent_due_id = CASE WHEN ? IS NOT NULL THEN ? ELSE parent_due_id END,
         updated_at = datetime('now')
       WHERE id = ?`,
      serverId,
      orgRef,
      orgRef,
      accountId,
      accountId,
      categoryId,
      categoryId,
      partyId,
      partyId,
      forPartyId,
      forPartyId,
      cloud.description ?? null,
      cloud.description ?? null,
      cloud.description ?? null,
      keyword,
      keyword,
      keyword,
      cloud.vendor ?? null,
      cloud.vendor ?? null,
      cloud.vendor ?? null,
      cloud.counterparty ?? null,
      cloud.counterparty ?? null,
      cloud.counterparty ?? null,
      paymentStatus,
      cloud.due_remaining != null ? Number(cloud.due_remaining) : null,
      cloud.due_remaining != null ? Number(cloud.due_remaining) : null,
      cloud.due_settled_at
        ? new Date(cloud.due_settled_at).toISOString()
        : null,
      cloud.due_settled_at
        ? new Date(cloud.due_settled_at).toISOString()
        : null,
      cloud.due_date ? new Date(cloud.due_date).toISOString() : null,
      cloud.due_date ? new Date(cloud.due_date).toISOString() : null,
      parentRef,
      parentRef,
      local.id,
    );
    updated += Number(result.changes ?? 0);
  }

  return { updated };
}
