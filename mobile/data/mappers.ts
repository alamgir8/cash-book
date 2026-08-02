import type { LocalAccount } from "@/db/types";
import type { Account, AccountOverview } from "@/services/accounts";

export function localAccountToApi(row: LocalAccount): Account {
  return {
    _id: row.server_id || row.id,
    name: row.name,
    description: row.description ?? "",
    balance: Number(row.current_balance),
    kind: row.kind,
    currency_code: row.currency_code ?? undefined,
    currency_symbol: row.currency_symbol ?? undefined,
    opening_balance: Number(row.opening_balance),
    archived: Boolean(row.archived),
  };
}

export function localAccountToOverview(row: LocalAccount): AccountOverview {
  return {
    ...localAccountToApi(row),
    summary: {
      totalTransactions: 0,
      totalDebit: 0,
      totalCredit: 0,
      net: 0,
      lastTransactionDate: null,
    },
  };
}

/** Prefer local UUID as stable id when local-first is on. */
export function localAccountToApiLocalId(row: LocalAccount): Account {
  return {
    ...localAccountToApi(row),
    _id: row.id,
  };
}
