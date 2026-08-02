import type { LocalAccount, LocalParty } from "@/db/types";
import type { Account, AccountOverview } from "@/services/accounts";
import type { Party, PartyType } from "@/services/parties";

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

export function localPartyToApi(row: LocalParty, totalTransactions = 0): Party {
  let address: Party["address"];
  if (row.address_json) {
    try {
      address = JSON.parse(row.address_json);
    } catch {
      address = undefined;
    }
  }
  return {
    _id: row.id,
    admin: "",
    code: row.code ?? "",
    name: row.name,
    type: (row.type as PartyType) || "customer",
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address,
    opening_balance: Number(row.opening_balance),
    current_balance: Number(row.current_balance),
    credit_limit: row.credit_limit ?? undefined,
    notes: row.notes ?? undefined,
    archived: Boolean(row.archived),
    total_transactions: totalTransactions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
