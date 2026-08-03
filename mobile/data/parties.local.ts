import { getDb } from "@/db/client";
import * as partiesRepo from "@/db/repos/parties";
import type { LocalParty } from "@/db/types";
import {
  partiesApi,
  type CreatePartyParams,
  type ListPartiesParams,
  type Party,
  type UpdatePartyParams,
} from "@/services/parties";
import type { PartyRef } from "@/services/transactions";
import { isDualWriteEnabled } from "@/lib/local-first/flags";
import { getOrCreateDeviceId } from "@/services/device";
import { localPartyToApi } from "./mappers";

async function resolveLocalParty(partyId: string) {
  const db = await getDb();
  let row = await partiesRepo.getPartyById(db, partyId);
  if (!row) {
    row =
      (await db.getFirstAsync<LocalParty>(
        `SELECT * FROM parties WHERE server_id = ? AND deleted_at IS NULL LIMIT 1`,
        partyId,
      )) ?? null;
  }
  return { db, row };
}

/** Match party FKs stored as local id OR Mongo server_id. */
function partyMatchClause(alias = "") {
  const p = alias ? `${alias}.` : "";
  return `(
    ${p}party_id = ? OR ${p}party_id = ? OR
    ${p}for_party_id = ? OR ${p}for_party_id = ?
  )`;
}

function partyMatchParams(row: LocalParty): string[] {
  const serverId = row.server_id || row.id;
  return [row.id, serverId, row.id, serverId];
}

async function withTxnCount(db: Awaited<ReturnType<typeof getDb>>, row: LocalParty) {
  const count = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM transactions
     WHERE deleted_at IS NULL AND ${partyMatchClause()}`,
    ...partyMatchParams(row),
  );
  return localPartyToApi(row, Number(count?.c ?? 0));
}

export async function fetchLocalParties(
  params?: ListPartiesParams,
): Promise<{ parties: Party[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
  const db = await getDb();
  const includeArchived = params?.archived === true || params?.archived === "all";
  // Local-first: organization id, or personal (null). scope=all without org → personal.
  let scopeOrg = params?.organization ? String(params.organization) : null;

  const listOpts = {
    includeArchived: params?.archived === "all" ? true : includeArchived,
    includeDeleted: false,
  };
  let rows = await partiesRepo.listParties(
    db,
    { organizationId: scopeOrg },
    listOpts,
  );
  if (scopeOrg && rows.length === 0) {
    rows = await partiesRepo.listParties(
      db,
      { organizationId: null },
      listOpts,
    );
  } else if (!scopeOrg) {
    const all = await partiesRepo.listParties(
      db,
      { allOrganizations: true },
      listOpts,
    );
    if (all.length > rows.length) rows = all;
  }

  if (params?.archived === true) {
    rows = rows.filter((r) => r.archived === 1);
  } else if (params?.archived !== "all") {
    rows = rows.filter((r) => r.archived === 0);
  }

  if (params?.type) {
    rows = rows.filter(
      (r) => r.type === params.type || r.type === "both",
    );
  }

  if (params?.search?.trim()) {
    const q = params.search.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.code ?? "").toLowerCase().includes(q) ||
        (r.phone ?? "").includes(q),
    );
  }

  const page = Number(params?.page ?? 1);
  const limit = Number(params?.limit ?? 50);
  const total = rows.length;
  const slice = rows.slice((page - 1) * limit, page * limit);
  const parties = [];
  for (const row of slice) {
    parties.push(await withTxnCount(db, row));
  }

  return {
    parties,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function fetchLocalParty(partyId: string): Promise<Party> {
  const { db, row } = await resolveLocalParty(partyId);
  if (!row || row.deleted_at) throw new Error("Party not found");
  return withTxnCount(db, row);
}

export async function createLocalParty(payload: CreatePartyParams): Promise<Party> {
  const db = await getDb();
  const device_id = await getOrCreateDeviceId();
  let address_json: string | null = null;
  if (payload.address != null) {
    address_json =
      typeof payload.address === "string"
        ? payload.address
        : JSON.stringify(payload.address);
  }

  const created = await partiesRepo.createParty(db, {
    type: payload.type,
    name: payload.name,
    code: payload.code ?? null,
    phone: payload.phone ?? null,
    email: payload.email ?? null,
    address_json,
    opening_balance: payload.opening_balance ?? 0,
    credit_limit: payload.credit_limit ?? null,
    notes: payload.notes ?? null,
    organization_id: payload.organization ? String(payload.organization) : null,
    device_id,
  });

  if (isDualWriteEnabled()) {
    try {
      const remote = await partiesApi.create(payload);
      if (remote?._id) {
        await db.runAsync(
          `UPDATE parties SET server_id = ?, dirty = 0 WHERE id = ?`,
          remote._id,
          created.id,
        );
      }
    } catch (e) {
      console.warn("[dal] dual-write party create failed", e);
    }
  }

  return withTxnCount(db, created);
}

export async function updateLocalParty(
  partyId: string,
  payload: UpdatePartyParams,
): Promise<Party> {
  const { db, row } = await resolveLocalParty(partyId);
  if (!row || row.deleted_at) throw new Error("Party not found");
  const device_id = await getOrCreateDeviceId();

  let address_json: string | null | undefined = undefined;
  if (payload.address !== undefined) {
    address_json =
      payload.address == null
        ? null
        : typeof payload.address === "string"
          ? payload.address
          : JSON.stringify(payload.address);
  }

  const updated = await partiesRepo.updateParty(db, row.id, {
    device_id,
    name: payload.name,
    type: payload.type,
    code: payload.code,
    phone: payload.phone,
    email: payload.email,
    address_json,
    credit_limit: payload.credit_limit,
    notes: payload.notes,
    archived: payload.archived,
  });

  if (isDualWriteEnabled() && row.server_id) {
    try {
      await partiesApi.update(row.server_id, payload);
      await db.runAsync(`UPDATE parties SET dirty = 0 WHERE id = ?`, row.id);
    } catch (e) {
      console.warn("[dal] dual-write party update failed", e);
    }
  }

  return withTxnCount(db, updated);
}

export async function archiveLocalParty(
  partyId: string,
  archived: boolean,
): Promise<{ party: Party; message: string }> {
  const party = await updateLocalParty(partyId, { archived });
  return {
    party,
    message: archived ? "Party archived" : "Party restored",
  };
}

export async function deleteLocalParty(partyId: string): Promise<{ message: string }> {
  const { db, row } = await resolveLocalParty(partyId);
  if (!row || row.deleted_at) throw new Error("Party not found");

  const count = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM transactions
     WHERE deleted_at IS NULL AND ${partyMatchClause()}`,
    ...partyMatchParams(row),
  );
  const transactionCount = Number(count?.c ?? 0);
  if (transactionCount > 0) {
    const err: any = new Error(
      `Cannot delete party with ${transactionCount} linked transaction(s)`,
    );
    err.response = {
      data: { message: err.message, canMerge: true, transactionCount },
    };
    throw err;
  }

  const device_id = await getOrCreateDeviceId();
  await partiesRepo.softDeleteParty(db, row.id, device_id);

  if (isDualWriteEnabled() && row.server_id) {
    try {
      await partiesApi.delete(row.server_id);
      await db.runAsync(`UPDATE parties SET dirty = 0 WHERE id = ?`, row.id);
    } catch (e) {
      console.warn("[dal] dual-write party delete failed", e);
    }
  }

  return { message: "Party deleted" };
}

export async function mergeLocalParties(
  sourcePartyId: string,
  targetPartyId: string,
) {
  const { db, row: source } = await resolveLocalParty(sourcePartyId);
  const target = (await resolveLocalParty(targetPartyId)).row;
  if (!source || !target) throw new Error("Party not found");
  if (source.id === target.id) throw new Error("Cannot merge a party into itself");

  const device_id = await getOrCreateDeviceId();
  const { withDbTransaction } = await import("@/db/client");
  let transactionsUpdated = 0;

  await withDbTransaction(db, async (txn) => {
    const result = await txn.runAsync(
      `UPDATE transactions SET party_id = ?, dirty = 1, device_id = ?, updated_at = datetime('now')
       WHERE party_id = ? AND deleted_at IS NULL`,
      target.id,
      device_id,
      source.id,
    );
    const result2 = await txn.runAsync(
      `UPDATE transactions SET for_party_id = ?, dirty = 1, device_id = ?, updated_at = datetime('now')
       WHERE for_party_id = ? AND deleted_at IS NULL`,
      target.id,
      device_id,
      source.id,
    );
    transactionsUpdated =
      Number(result.changes ?? 0) + Number(result2.changes ?? 0);

    await txn.runAsync(
      `UPDATE parties SET current_balance = current_balance + ?, dirty = 1, device_id = ?, updated_at = datetime('now')
       WHERE id = ?`,
      Number(source.current_balance ?? 0),
      device_id,
      target.id,
    );
    await partiesRepo.softDeleteParty(txn, source.id, device_id);
  });

  if (isDualWriteEnabled() && source.server_id && target.server_id) {
    try {
      await partiesApi.merge(source.server_id, target.server_id);
    } catch (e) {
      console.warn("[dal] dual-write party merge failed", e);
    }
  }

  const party = await fetchLocalParty(target.id);
  return {
    message: `Merged into ${party.name}`,
    target: party,
    transactionsUpdated,
    sourceDeleted: true,
  };
}

export async function fetchLocalPartyLedger(
  partyId: string,
  params?: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    search?: string;
    type?: "debit" | "credit" | "all";
    sort?: string;
  },
) {
  const { db, row } = await resolveLocalParty(partyId);
  if (!row || row.deleted_at) throw new Error("Party not found");

  const page = Number(params?.page ?? 1);
  const limit = Number(params?.limit ?? 30);
  const offset = (page - 1) * limit;

  const clauses = ["deleted_at IS NULL", partyMatchClause()];
  const bind: (string | number)[] = [...partyMatchParams(row)];

  if (params?.type === "debit" || params?.type === "credit") {
    clauses.push("type = ?");
    bind.push(params.type);
  }
  if (params?.startDate) {
    clauses.push("date >= ?");
    bind.push(params.startDate);
  }
  if (params?.endDate) {
    clauses.push("date <= ?");
    bind.push(params.endDate);
  }
  if (params?.search?.trim()) {
    clauses.push("(description LIKE ? OR keyword LIKE ?)");
    const q = `%${params.search.trim()}%`;
    bind.push(q, q);
  }

  const where = clauses.join(" AND ");
  const totalRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM transactions WHERE ${where}`,
    ...bind,
  );
  const total = Number(totalRow?.c ?? 0);

  const txns = await db.getAllAsync<{
    id: string;
    date: string;
    type: string;
    description: string | null;
    keyword: string | null;
    amount: number;
    payment_status: string;
    balance_after_transaction: number | null;
    account_id: string;
    category_id: string | null;
  }>(
    `SELECT id, date, type, description, keyword, amount, payment_status,
            balance_after_transaction, account_id, category_id
     FROM transactions WHERE ${where}
     ORDER BY date DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    ...bind,
    limit,
    offset,
  );

  const sums = await db.getFirstAsync<{ debit: number; credit: number }>(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as debit,
      COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as credit
     FROM transactions WHERE deleted_at IS NULL AND ${partyMatchClause()}`,
    ...partyMatchParams(row),
  );

  const opening = Number(row.opening_balance ?? 0);
  const totalDebit = Number(sums?.debit ?? 0);
  const totalCredit = Number(sums?.credit ?? 0);
  const closing = opening + totalCredit - totalDebit;

  // The page is newest-first, so the first row's balance is the closing balance
  // minus everything newer than this page. Walking back from there gives a true
  // party running balance; `balance_after_transaction` is the *account* balance
  // and would be wrong here.
  const newerRow = offset
    ? await db.getFirstAsync<{ net: number }>(
        `SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as net
         FROM (
           SELECT type, amount FROM transactions WHERE ${where}
           ORDER BY date DESC, created_at DESC
           LIMIT ?
         )`,
        ...bind,
        offset,
      )
    : null;
  let runningBalance = closing - Number(newerRow?.net ?? 0);

  const entries = [];
  for (const t of txns) {
    const account = await db.getFirstAsync<{ name: string }>(
      `SELECT name FROM accounts WHERE id = ? OR server_id = ? LIMIT 1`,
      t.account_id,
      t.account_id,
    );
    const category = t.category_id
      ? await db.getFirstAsync<{ name: string }>(
          `SELECT name FROM categories WHERE id = ?`,
          t.category_id,
        )
      : null;
    const debit = t.type === "debit" ? Number(t.amount) : 0;
    const credit = t.type === "credit" ? Number(t.amount) : 0;
    entries.push({
      _id: t.id,
      date: t.date,
      type: t.type,
      description: t.description ?? category?.name ?? t.type,
      comment: t.keyword ?? undefined,
      debit,
      credit,
      running_balance: runningBalance,
      transaction_id: t.id,
      category_name: category?.name,
      account_name: account?.name,
      payment_status: t.payment_status,
    });
    // Next row is one step older, so undo this row's effect.
    runningBalance -= credit - debit;
  }

  return {
    party: await withTxnCount(db, row),
    entries,
    summary: {
      opening_balance: opening,
      total_debit: totalDebit,
      total_credit: totalCredit,
      closing_balance: closing,
    },
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function fetchLocalCounterparties(
  search?: string,
  organizationId?: string | null,
): Promise<string[]> {
  const db = await getDb();
  const q = search?.trim();
  const orgClause = organizationId
    ? "AND organization_id = ?"
    : "AND (organization_id IS NULL OR organization_id = '')";
  const orgParams = organizationId ? [organizationId] : [];
  const rows = q
    ? await db.getAllAsync<{ counterparty: string }>(
        `SELECT DISTINCT counterparty FROM transactions
         WHERE deleted_at IS NULL AND counterparty IS NOT NULL AND counterparty != ''
           ${orgClause}
           AND counterparty LIKE ?
         ORDER BY counterparty COLLATE NOCASE ASC LIMIT 100`,
        ...orgParams,
        `%${q}%`,
      )
    : await db.getAllAsync<{ counterparty: string }>(
        `SELECT DISTINCT counterparty FROM transactions
         WHERE deleted_at IS NULL AND counterparty IS NOT NULL AND counterparty != ''
           ${orgClause}
         ORDER BY counterparty COLLATE NOCASE ASC LIMIT 100`,
        ...orgParams,
      );
  return rows.map((r) => r.counterparty);
}

export async function fetchLocalVendors(
  search?: string,
  organizationId?: string | null,
): Promise<PartyRef[]> {
  const db = await getDb();
  const q = search?.trim()?.toLowerCase();
  let orgId = organizationId ?? null;
  let rows = await partiesRepo.listParties(db, { organizationId: orgId });
  if (orgId && rows.length === 0) {
    rows = await partiesRepo.listParties(db, { organizationId: null });
  } else if (!orgId) {
    const all = await partiesRepo.listParties(db, { allOrganizations: true });
    if (all.length > rows.length) rows = all;
  }
  if (q) {
    rows = rows.filter((r) => r.name.toLowerCase().includes(q));
  }
  return rows.slice(0, 100).map((r) => ({
    _id: r.id,
    name: r.name,
    type: r.type,
    code: r.code ?? undefined,
  }));
}

/**
 * Full vendor/party ledger (any category) for History sheet + PDF.
 * Matches cloud `/transactions/vendor-ledger` shape.
 */
export async function fetchLocalVendorLedger(params: {
  partyId?: string;
  counterparty?: string;
  limit?: number;
}): Promise<{
  party_id: string | null;
  party_name: string;
  counterparty: string | null;
  timeline: Array<{
    _id: string;
    date: string;
    type: "debit" | "credit";
    amount: number;
    description?: string;
    entry_type: "credit" | "debit";
    running_balance: number;
    account?: { _id: string; name: string };
    category?: { _id: string; name: string; type: string } | null;
    payment_status?: string;
  }>;
  summary: {
    total_credit: number;
    total_debit: number;
    net_balance: number;
    transaction_count: number;
  };
}> {
  const db = await getDb();
  const limit = Math.min(Math.max(Number(params.limit ?? 200), 1), 500);

  let clauses: string[] = ["deleted_at IS NULL"];
  const bind: (string | number)[] = [];
  let partyName = "";
  let resolvedPartyId: string | null = params.partyId ?? null;

  if (params.partyId) {
    const { row } = await resolveLocalParty(params.partyId);
    if (!row || row.deleted_at) {
      return {
        party_id: params.partyId,
        party_name: "",
        counterparty: null,
        timeline: [],
        summary: {
          total_credit: 0,
          total_debit: 0,
          net_balance: 0,
          transaction_count: 0,
        },
      };
    }
    partyName = row.name;
    resolvedPartyId = row.server_id || row.id;
    // Vendor ledger: party_id only (not for_party)
    clauses.push(`(party_id = ? OR party_id = ?)`);
    bind.push(row.id, row.server_id || row.id);
  } else if (params.counterparty?.trim()) {
    const cp = params.counterparty.trim();
    if (cp.toLowerCase() === "transfer") {
      return {
        party_id: null,
        party_name: "",
        counterparty: null,
        timeline: [],
        summary: {
          total_credit: 0,
          total_debit: 0,
          net_balance: 0,
          transaction_count: 0,
        },
      };
    }
    clauses.push("counterparty = ?");
    bind.push(cp);
    partyName = cp;
  } else {
    throw new Error("partyId or counterparty required");
  }

  const where = clauses.join(" AND ");

  const sums = await db.getFirstAsync<{
    credit: number;
    debit: number;
    c: number;
  }>(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as credit,
      COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as debit,
      COUNT(*) as c
     FROM transactions WHERE ${where}`,
    ...bind,
  );

  const totalCredit = Number(sums?.credit ?? 0);
  const totalDebit = Number(sums?.debit ?? 0);
  const transactionCount = Number(sums?.c ?? 0);

  // Oldest-first for running balance, then reverse for newest-first UI
  const rows = await db.getAllAsync<{
    id: string;
    date: string;
    type: string;
    amount: number;
    description: string | null;
    payment_status: string | null;
    account_id: string;
    category_id: string | null;
  }>(
    `SELECT id, date, type, amount, description, payment_status, account_id, category_id
     FROM transactions WHERE ${where}
     ORDER BY date ASC, created_at ASC, id ASC
     LIMIT ?`,
    ...bind,
    limit,
  );

  let running = 0;
  const timelineAsc = [];
  for (const t of rows) {
    const amt = Number(t.amount ?? 0);
    if (t.type === "credit") running += amt;
    else running -= amt;
    running = Math.round(running * 100) / 100;

    const account = await db.getFirstAsync<{ id: string; name: string }>(
      `SELECT id, name FROM accounts WHERE id = ? OR server_id = ? LIMIT 1`,
      t.account_id,
      t.account_id,
    );
    const category = t.category_id
      ? await db.getFirstAsync<{ id: string; name: string; type: string }>(
          `SELECT id, name, type FROM categories WHERE id = ? OR server_id = ? LIMIT 1`,
          t.category_id,
          t.category_id,
        )
      : null;

    timelineAsc.push({
      _id: t.id,
      date: t.date,
      type: (t.type === "credit" ? "credit" : "debit") as "debit" | "credit",
      amount: amt,
      description: t.description ?? undefined,
      entry_type: (t.type === "credit" ? "credit" : "debit") as
        | "credit"
        | "debit",
      running_balance: running,
      account: account
        ? { _id: account.id, name: account.name }
        : { _id: t.account_id, name: "" },
      category: category
        ? { _id: category.id, name: category.name, type: category.type }
        : null,
      payment_status: t.payment_status ?? undefined,
    });
  }

  return {
    party_id: resolvedPartyId,
    party_name: partyName,
    counterparty: params.counterparty ?? null,
    timeline: timelineAsc.reverse(),
    summary: {
      total_credit: Math.round(totalCredit * 100) / 100,
      total_debit: Math.round(totalDebit * 100) / 100,
      net_balance: Math.round((totalCredit - totalDebit) * 100) / 100,
      transaction_count: transactionCount,
    },
  };
}
