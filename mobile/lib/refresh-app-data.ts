import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

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
  ["accounts"],
  queryKeys.accountsOverview,
  ["account"],
  ["summary"],
  ["parties"],
  ["due-chain"],
  ["counterparty-ledger"],
  ["partyLedger"],
] as const;

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
 */
export const refreshAppData = async (queryClient: QueryClient) => {
  await invalidateActive(queryClient, APP_REFRESH_KEYS as any);
};

/**
 * Fast refresh for transaction surfaces (Home, Ledger, Account detail).
 */
export const refreshTransactionData = async (queryClient: QueryClient) => {
  await invalidateActive(queryClient, TRANSACTION_REFRESH_KEYS as any);
};
