import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  ensureLocalFirstFlags,
  isLocalFirstEnabled,
} from "@/lib/local-first/flags";

/** Pull-to-refresh / settings: broad but only active observers. */
const APP_REFRESH_KEYS = [
  ["transactions"],
  ["accounts"],
  queryKeys.accountsOverview,
  ["account"],
  queryKeys.categories.all,
  queryKeys.counterparties,
  queryKeys.vendors,
  ["summary"],
  ["parties"],
  ["schemes"],
  ["scheme"],
  ["schemeRoster"],
  ["invoices"],
  ["imports"],
  ["organizations"],
  ["profile"],
  ["due-chain"],
  ["counterparty-ledger"],
] as const;

/** After create/update/delete on Home / Ledger / Account — keep it light. */
const TRANSACTION_REFRESH_KEYS = [
  ["transactions"],
  ["transaction-totals"],
  ["accounts"],
  queryKeys.accountsOverview,
  ["account"],
  ["summary"],
  ["parties"],
  ["schemes"],
  ["scheme"],
  ["schemeRoster"],
  ["due-chain"],
  ["counterparty-ledger"],
  ["partyLedger"],
] as const;

async function refreshLocalBalancesIfNeeded() {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) return;
  try {
    const { getDb } = await import("@/db/client");
    const { recalculateBalances } = await import("@/db/balances");
    const db = await getDb();
    const orgRows = await db.getAllAsync<{ organization_id: string | null }>(
      `SELECT DISTINCT organization_id FROM accounts WHERE deleted_at IS NULL`,
    );
    const scopes = new Set<string | null>([null]);
    for (const r of orgRows) scopes.add(r.organization_id || null);
    for (const scope of scopes) {
      await recalculateBalances(db, { organizationId: scope });
    }
  } catch (e) {
    console.warn("[refresh] balance recalc failed", e);
  }
}

async function invalidateActive(
  queryClient: QueryClient,
  keys: readonly (readonly string[] | string)[],
) {
  await Promise.all(
    keys.map((queryKey) =>
      queryClient.invalidateQueries({
        queryKey: queryKey as string[],
        exact: false,
        // Only refetch queries currently mounted — avoids storms from frozen tabs
        refetchType: "active",
      }),
    ),
  );
}

/**
 * Full app refresh (pull-to-refresh on Settings / Shop / etc.).
 * Active queries only — no inactive refetch + no double refetch pass.
 * Balance recalc runs after UI refresh so lists never wait on it.
 */
export const refreshAppData = async (queryClient: QueryClient) => {
  await invalidateActive(queryClient, APP_REFRESH_KEYS as any);
  void refreshLocalBalancesIfNeeded();
};

/**
 * Fast refresh for transaction surfaces (Home, Ledger, Account detail).
 */
export const refreshTransactionData = async (queryClient: QueryClient) => {
  await invalidateActive(queryClient, TRANSACTION_REFRESH_KEYS as any);
  void refreshLocalBalancesIfNeeded();
};
