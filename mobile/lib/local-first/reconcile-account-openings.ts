import type { Db } from "@/db/client";
import { api } from "@/lib/api";
import { organizationsApi } from "@/services/organizations";
import { recalculateAccountRunningBalances } from "@/db/balances";

type CloudAccount = {
  _id?: string;
  id?: string;
  opening_balance?: number;
  current_balance?: number;
  balance?: number;
  name?: string;
};

const PAID_SQL = `(payment_status = 'paid' OR payment_status IS NULL OR payment_status = '')`;

async function fetchCloudAccounts(
  organizationId: string | null,
): Promise<CloudAccount[]> {
  const { data } = await api.get<{ accounts?: CloudAccount[] }>("/accounts", {
    params: organizationId ? { organization: organizationId } : undefined,
    timeout: 30000,
  });
  return data.accounts ?? [];
}

async function paidNetForAccount(
  db: Db,
  accountId: string,
  serverId: string | null,
): Promise<number> {
  const sid = serverId || accountId;
  const sum = await db.getFirstAsync<{
    paid_debit: number;
    paid_credit: number;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'debit' AND ${PAID_SQL} THEN amount ELSE 0 END), 0) as paid_debit,
       COALESCE(SUM(CASE WHEN type = 'credit' AND ${PAID_SQL} THEN amount ELSE 0 END), 0) as paid_credit
     FROM transactions
     WHERE deleted_at IS NULL
       AND (account_id = ? OR account_id = ?)`,
    accountId,
    sid,
  );
  return Number(sum?.paid_credit ?? 0) - Number(sum?.paid_debit ?? 0);
}

/**
 * Align local account cash to Mongo current_balance (source of truth).
 *
 * Local paid/all sums drift when payment_status or migrate is wrong. Mongo
 * already has the wallet the user expects (নগদ ≈16k, বিকাশ ≈5.7k, ব্যাংক 612k).
 *
 * We persist:
 *   opening_balance = cloud.current − localPaidNet
 *   current_balance = cloud.current
 * so Balance = Opening + Cash net, and Balance-after trails end on cloud cash.
 */
export async function reconcileAccountOpeningsFromCloud(
  db: Db,
): Promise<{ updated: number }> {
  const byServerId = new Map<string, CloudAccount>();

  try {
    for (const a of await fetchCloudAccounts(null)) {
      const id = String(a._id ?? a.id ?? "");
      if (id) byServerId.set(id, a);
    }
  } catch (e) {
    console.warn("[reconcile-accounts] personal fetch failed", e);
  }

  try {
    const orgs = await organizationsApi.list();
    for (const org of orgs || []) {
      const orgId = (org as { id?: string; _id?: string }).id || org._id;
      if (!orgId) continue;
      try {
        for (const a of await fetchCloudAccounts(String(orgId))) {
          const id = String(a._id ?? a.id ?? "");
          if (id) byServerId.set(id, a);
        }
      } catch (e) {
        console.warn(`[reconcile-accounts] org ${orgId} fetch failed`, e);
      }
    }
  } catch (e) {
    console.warn("[reconcile-accounts] org list failed", e);
  }

  if (!byServerId.size) return { updated: 0 };

  const locals = await db.getAllAsync<{
    id: string;
    server_id: string | null;
    opening_balance: number;
    current_balance: number;
    name: string;
  }>(
    `SELECT id, server_id, opening_balance, current_balance, name
     FROM accounts WHERE deleted_at IS NULL`,
  );

  let updated = 0;
  const touched: string[] = [];

  for (const local of locals) {
    const cloud =
      (local.server_id ? byServerId.get(local.server_id) : undefined) ||
      byServerId.get(local.id);
    if (!cloud) continue;

    const cloudCurrent = Number(
      cloud.current_balance ?? cloud.balance ?? NaN,
    );
    if (!Number.isFinite(cloudCurrent)) continue;

    const paidNet = await paidNetForAccount(db, local.id, local.server_id);
    // Keep Balance = Opening + Cash net with Cash net = local paid sum.
    const nextOpening = cloudCurrent - paidNet;

    const openingChanged =
      Math.abs(Number(local.opening_balance) - nextOpening) > 0.0001;
    const currentChanged =
      Math.abs(Number(local.current_balance) - cloudCurrent) > 0.0001;

    if (!openingChanged && !currentChanged) continue;

    await db.runAsync(
      `UPDATE accounts
       SET opening_balance = ?, current_balance = ?
       WHERE id = ?`,
      nextOpening,
      cloudCurrent,
      local.id,
    );
    updated += 1;
    touched.push(local.id);
  }

  for (const id of touched) {
    try {
      await recalculateAccountRunningBalances(db, id);
    } catch (e) {
      console.warn(`[reconcile-accounts] trail rewrite failed for ${id}`, e);
    }
  }

  return { updated };
}
