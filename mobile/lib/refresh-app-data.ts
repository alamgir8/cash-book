import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

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

export const refreshAppData = async (queryClient: QueryClient) => {
  await Promise.all(
    APP_REFRESH_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({
        queryKey,
        exact: false,
        refetchType: "all",
      }),
    ),
  );

  await queryClient.refetchQueries({ type: "active" });
};
