import { getDb } from "@/db/client";
import * as transactionsRepo from "@/db/repos/transactions";
import * as transfersRepo from "@/db/repos/transfers";
import { buildLocalTransactionFilterSql } from "@/data/local-txn-filters";
import type {
  LocalAccount,
  LocalCategory,
  LocalParty,
  LocalTransaction,
} from "@/db/types";
import {
  createTransaction as apiCreateTransaction,
  createTransfer as apiCreateTransfer,
  createDuePayment as apiCreateDuePayment,
  deleteTransaction as apiDeleteTransaction,
  updateTransaction as apiUpdateTransaction,
  fetchTransactions,
  type Transaction,
  type TransactionFilters,
} from "@/services/transactions";
import { isDualWriteEnabled } from "@/lib/local-first/flags";
import { getOrCreateDeviceId } from "@/services/device";
import { createClientRequestId } from "@/lib/local-first/ids";

async function resolveLocalTransaction(transactionId: string) {
  const db = await getDb();
  let row = await transactionsRepo.getTransactionById(db, transactionId);
  if (!row) {
    row =
      (await db.getFirstAsync<LocalTransaction>(
        `SELECT * FROM transactions WHERE server_id = ? AND deleted_at IS NULL LIMIT 1`,
        transactionId,
      )) ?? null;
  }
  return { db, row };
}

async function resolveByIdOrServerId<T extends { id: string }>(
  db: Awaited<ReturnType<typeof getDb>>,
  table: "accounts" | "categories" | "parties",
  id: string | null | undefined,
): Promise<T | null> {
  if (!id) return null;
  return (
    (await db.getFirstAsync<T>(
      `SELECT * FROM ${table} WHERE id = ? OR server_id = ? LIMIT 1`,
      id,
      id,
    )) ?? null
  );
}

function parseAttachments(json: string | null): Transaction["attachments"] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapLocalTxn(
  row: LocalTransaction,
  extras?: {
    accountName?: string;
    accountKind?: string;
    accountLocalId?: string;
    categoryName?: string;
    categoryType?: string;
    categoryFlow?: "credit" | "debit";
    categoryLocalId?: string;
    partyName?: string;
    partyType?: string;
    partyLocalId?: string;
    forPartyName?: string;
    forPartyType?: string;
    forPartyLocalId?: string;
  },
): Transaction {
  const notes = row.keyword?.trim() || undefined;
  const description = row.description?.trim() || undefined;
  const vendorText = row.vendor?.trim() || undefined;
  const counterpartyText = row.counterparty?.trim() || undefined;
  const partyName =
    extras?.partyName?.trim() ||
    vendorText ||
    counterpartyText ||
    "";
  const forPartyName = extras?.forPartyName?.trim() || "";
  // If party_id missing but vendor text exists, still surface a vendor chip.
  const party =
    row.party_id || partyName
      ? {
          _id: extras?.partyLocalId ?? row.party_id ?? "",
          name: partyName,
          type: (extras?.partyType as "customer" | "supplier") || "customer",
        }
      : null;
  const forParty =
    row.for_party_id || forPartyName
      ? {
          _id: extras?.forPartyLocalId ?? row.for_party_id ?? "",
          name: forPartyName,
          type:
            (extras?.forPartyType as "customer" | "supplier") || "customer",
        }
      : null;
  return {
    _id: row.id,
    account: {
      _id: extras?.accountLocalId ?? row.account_id,
      name: extras?.accountName ?? "",
      kind: extras?.accountKind,
    },
    category: row.category_id
      ? {
          _id: extras?.categoryLocalId ?? row.category_id,
          name: extras?.categoryName ?? "",
          type: extras?.categoryType ?? "",
          flow: extras?.categoryFlow,
        }
      : null,
    type: row.type,
    amount: Number(row.amount),
    date: row.date,
    createdAt: row.created_at,
    description,
    keyword: notes,
    // Cards / filters use `comment`; API uses `keyword` — expose both.
    comment: notes,
    counterparty: counterpartyText,
    vendor: vendorText,
    party,
    for_party: forParty,
    payment_status: row.payment_status === "due" ? "due" : "paid",
    due_date: row.due_date ?? undefined,
    due_remaining: row.due_remaining ?? undefined,
    due_group_id: row.due_group_id ?? undefined,
    parent_due_id: row.parent_due_id ?? undefined,
    due_settled_at: row.due_settled_at ?? undefined,
    balance_after_transaction: row.balance_after_transaction ?? undefined,
    transfer_id: row.transfer_id ?? undefined,
    transfer_direction: row.transfer_direction ?? undefined,
    is_deleted: Boolean(row.deleted_at),
    attachments: parseAttachments(row.attachments_json),
  };
}

function lookupByIdOrServerId<T extends { id: string; server_id?: string | null }>(
  byId: Map<string, T>,
  byServerId: Map<string, T>,
  id: string | null | undefined,
): T | null {
  if (!id) return null;
  return byId.get(id) ?? byServerId.get(id) ?? null;
}

async function loadEnrichmentMaps(db: Awaited<ReturnType<typeof getDb>>) {
  const [accounts, categories, parties] = await Promise.all([
    db.getAllAsync<LocalAccount>(
      `SELECT id, server_id, name, kind FROM accounts WHERE deleted_at IS NULL`,
    ),
    db.getAllAsync<LocalCategory>(
      `SELECT id, server_id, name, type, flow FROM categories WHERE deleted_at IS NULL`,
    ),
    db.getAllAsync<LocalParty>(
      `SELECT id, server_id, name, type FROM parties WHERE deleted_at IS NULL`,
    ),
  ]);

  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const accountsByServer = new Map(
    accounts.filter((a) => a.server_id).map((a) => [a.server_id!, a]),
  );
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const categoriesByServer = new Map(
    categories.filter((c) => c.server_id).map((c) => [c.server_id!, c]),
  );
  const partiesById = new Map(parties.map((p) => [p.id, p]));
  const partiesByServer = new Map(
    parties.filter((p) => p.server_id).map((p) => [p.server_id!, p]),
  );

  return {
    accountsById,
    accountsByServer,
    categoriesById,
    categoriesByServer,
    partiesById,
    partiesByServer,
  };
}

function enrichFromMaps(
  row: LocalTransaction,
  maps: Awaited<ReturnType<typeof loadEnrichmentMaps>>,
): Transaction {
  const account = lookupByIdOrServerId(
    maps.accountsById,
    maps.accountsByServer,
    row.account_id,
  );
  const category = lookupByIdOrServerId(
    maps.categoriesById,
    maps.categoriesByServer,
    row.category_id,
  );
  const party = lookupByIdOrServerId(
    maps.partiesById,
    maps.partiesByServer,
    row.party_id,
  );
  const forParty = lookupByIdOrServerId(
    maps.partiesById,
    maps.partiesByServer,
    row.for_party_id,
  );
  return mapLocalTxn(row, {
    accountName: account?.name,
    accountKind: account?.kind,
    accountLocalId: account?.id,
    categoryName: category?.name,
    categoryType: category?.type,
    categoryFlow: category?.flow as "credit" | "debit" | undefined,
    categoryLocalId: category?.id,
    partyName: party?.name,
    partyType: party?.type,
    partyLocalId: party?.server_id || party?.id,
    forPartyName: forParty?.name,
    forPartyType: forParty?.type,
    forPartyLocalId: forParty?.server_id || forParty?.id,
  });
}

/**
 * Local rows store parent_due_id as a string id. Cards expect a hydrated
 * object (like the cloud API) so payment badges can show remaining due.
 */
async function hydrateParentDues(
  db: Awaited<ReturnType<typeof getDb>>,
  transactions: Transaction[],
  maps: Awaited<ReturnType<typeof loadEnrichmentMaps>>,
): Promise<Transaction[]> {
  const parentIds = [
    ...new Set(
      transactions
        .map((t) =>
          typeof t.parent_due_id === "string" && t.parent_due_id
            ? t.parent_due_id
            : null,
        )
        .filter(Boolean),
    ),
  ] as string[];
  if (!parentIds.length) return transactions;

  const placeholders = parentIds.map(() => "?").join(",");
  const parents = await db.getAllAsync<LocalTransaction>(
    `SELECT * FROM transactions
     WHERE deleted_at IS NULL
       AND (id IN (${placeholders}) OR server_id IN (${placeholders}))`,
    ...parentIds,
    ...parentIds,
  );
  const byId = new Map<string, Transaction>();
  for (const row of parents) {
    const mapped = enrichFromMaps(row, maps);
    byId.set(row.id, mapped);
    if (row.server_id) byId.set(row.server_id, mapped);
  }

  return transactions.map((t) => {
    if (typeof t.parent_due_id !== "string" || !t.parent_due_id) return t;
    const parent = byId.get(t.parent_due_id);
    if (!parent) return t;
    return {
      ...t,
      parent_due_id: {
        _id: parent._id,
        amount: parent.amount,
        due_remaining: parent.due_remaining,
        due_settled_at: parent.due_settled_at,
        date: String(parent.date),
        description: parent.description,
        vendor: parent.vendor,
        counterparty: parent.counterparty,
        party: parent.party ?? null,
        for_party: parent.for_party ?? null,
        payment_status: parent.payment_status,
      },
    };
  });
}

export async function enrichLocalTransaction(
  db: Awaited<ReturnType<typeof getDb>>,
  row: LocalTransaction,
) {
  const [account, category, party, forParty] = await Promise.all([
    resolveByIdOrServerId<LocalAccount>(db, "accounts", row.account_id),
    resolveByIdOrServerId<LocalCategory>(db, "categories", row.category_id),
    resolveByIdOrServerId<LocalParty>(db, "parties", row.party_id),
    resolveByIdOrServerId<LocalParty>(db, "parties", row.for_party_id),
  ]);
  return mapLocalTxn(row, {
    accountName: account?.name,
    accountKind: account?.kind,
    accountLocalId: account?.id,
    categoryName: category?.name,
    categoryType: category?.type,
    categoryFlow: category?.flow as "credit" | "debit" | undefined,
    categoryLocalId: category?.id,
    partyName: party?.name,
    partyType: party?.type,
    partyLocalId: party?.server_id || party?.id,
    forPartyName: forParty?.name,
    forPartyType: forParty?.type,
    forPartyLocalId: forParty?.server_id || forParty?.id,
  });
}

async function resolveLocalReadScope(
  _db: Awaited<ReturnType<typeof getDb>>,
  _filters: TransactionFilters,
): Promise<{
  organizationId: string | null;
  allOrganizations?: boolean;
  includePersonal?: boolean;
}> {
  // Local-first device book is the source of truth — same universe as
  // "Backup Now" (1204), not the narrower org-only cloud slice (~1175).
  return { organizationId: null, allOrganizations: true };
}

async function ensureRepaired(db: Awaited<ReturnType<typeof getDb>>) {
  try {
    const { ensureLocalLedgerRepaired } = await import(
      "@/lib/local-first/repair-ledger"
    );
    await ensureLocalLedgerRepaired(db);
  } catch (e) {
    console.warn("[local-txn] repair skipped", e);
  }
}

export async function fetchLocalTransactions(
  filters: TransactionFilters = {},
): Promise<{
  transactions: Transaction[];
  pagination?: { page: number; limit: number; total: number; pages: number };
}> {
  const db = await getDb();
  await ensureRepaired(db);

  const page = Number(filters.page ?? 1);
  const limit = Number(filters.limit ?? 20);
  const offset = (page - 1) * limit;
  const scope = await resolveLocalReadScope(db, filters);
  const { clauses, params } = await buildLocalTransactionFilterSql(
    db,
    scope,
    filters,
  );
  const where = clauses.join(" AND ");
  const maps = await loadEnrichmentMaps(db);
  const { decorateLocalLoanSummaries } = await import(
    "@/lib/local-first/loan-summary"
  );
  const { isLoanGivenRoot, isLoanReceivedRoot } = await import(
    "@/lib/loan-utils"
  );

  // Loan chips need loan_summary before unsettled filtering — load a wider set.
  if (filters.loan_filter === "loan_given" || filters.loan_filter === "loan_received") {
    const wide = await db.getAllAsync<LocalTransaction>(
      `SELECT * FROM transactions WHERE ${where}
       ORDER BY date DESC, created_at DESC LIMIT 2000`,
      ...params,
    );
    let wideTx = wide.map((row) => enrichFromMaps(row, maps));
    wideTx = await hydrateParentDues(db, wideTx, maps);
    wideTx = await decorateLocalLoanSummaries(db, wideTx);
    if (filters.loan_filter === "loan_given") {
      wideTx = wideTx.filter(
        (t) =>
          isLoanGivenRoot(t) &&
          !!t.loan_summary &&
          !t.loan_summary.is_settled &&
          (t.loan_summary.owed_by_them ?? 0) > 0,
      );
    } else {
      wideTx = wideTx.filter(
        (t) =>
          isLoanReceivedRoot(t) &&
          !!t.loan_summary &&
          !t.loan_summary.is_settled &&
          (t.loan_summary.owed_by_me ?? 0) > 0,
      );
    }
    const finalTotal = wideTx.length;
    return {
      transactions: wideTx.slice(offset, offset + limit),
      pagination: {
        page,
        limit,
        total: finalTotal,
        pages: Math.max(1, Math.ceil(finalTotal / limit)),
      },
    };
  }

  const totalRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM transactions WHERE ${where}`,
    ...params,
  );
  const total = Number(totalRow?.c ?? 0);

  const rows = await db.getAllAsync<LocalTransaction>(
    `SELECT * FROM transactions WHERE ${where}
     ORDER BY date DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  let transactions = rows.map((row) => enrichFromMaps(row, maps));
  transactions = await hydrateParentDues(db, transactions, maps);
  transactions = await decorateLocalLoanSummaries(db, transactions);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/** Debit/credit/count for dashboard — respects the same filters as the list. */
export async function fetchLocalTransactionTotals(
  filters: TransactionFilters = {},
): Promise<{ debit: number; credit: number; count: number }> {
  const db = await getDb();
  await ensureRepaired(db);

  // Loan chips need the same unsettled post-filter as the list, or the
  // StatsCards count drifts from the visible rows.
  if (
    filters.loan_filter === "loan_given" ||
    filters.loan_filter === "loan_received"
  ) {
    const listed = await fetchLocalTransactions({
      ...filters,
      page: 1,
      limit: 2000,
    });
    const txns = listed.transactions;
    let debit = 0;
    let credit = 0;
    for (const t of txns) {
      const amount = Number(t.amount) || 0;
      if (t.type === "debit") debit += amount;
      else if (t.type === "credit") credit += amount;
    }
    return {
      debit,
      credit,
      count: listed.pagination?.total ?? txns.length,
    };
  }

  const scope = await resolveLocalReadScope(db, filters);
  // Totals ignore pagination; strip page/limit from filter copy.
  const { page: _p, limit: _l, ...rest } = filters;
  const { clauses, params } = await buildLocalTransactionFilterSql(
    db,
    scope,
    rest,
  );
  const row = await db.getFirstAsync<{
    debit: number;
    credit: number;
    count: number;
  }>(
    `SELECT
      COALESCE(SUM(CASE WHEN lower(trim(type)) = 'debit' THEN CAST(amount AS REAL) ELSE 0 END), 0) as debit,
      COALESCE(SUM(CASE WHEN lower(trim(type)) = 'credit' THEN CAST(amount AS REAL) ELSE 0 END), 0) as credit,
      COUNT(*) as count
     FROM transactions
     WHERE ${clauses.join(" AND ")}`,
    ...params,
  );
  return {
    debit: Number(row?.debit ?? 0),
    credit: Number(row?.credit ?? 0),
    count: Number(row?.count ?? 0),
  };
}

type CreatePayload = {
  accountId: string;
  amount: number;
  type: "debit" | "credit";
  date?: string;
  description?: string;
  comment?: string;
  categoryId?: string;
  party?: string;
  for_party?: string;
  payment_status?: "paid" | "due";
  due_date?: string;
  organizationId?: string | null;
};

export async function createLocalTransaction(payload: CreatePayload) {
  const db = await getDb();
  const device_id = await getOrCreateDeviceId();
  const client_request_id = createClientRequestId();

  let created: LocalTransaction | null = null;
  const { withDbTransaction } = await import("@/db/client");
  await withDbTransaction(db, async (txn) => {
    created = await transactionsRepo.createTransaction(txn, {
      account_id: payload.accountId,
      category_id: payload.categoryId ?? null,
      party_id: payload.party ?? null,
      for_party_id: payload.for_party ?? null,
      type: payload.type,
      amount: payload.amount,
      date: payload.date ?? new Date().toISOString(),
      description: payload.description ?? null,
      keyword: payload.comment ?? null,
      payment_status: payload.payment_status ?? "paid",
      due_date: payload.due_date ?? null,
      organization_id: payload.organizationId ?? null,
      device_id,
      client_request_id,
    });
  });

  if (!created) throw new Error("Failed to create local transaction");

  if (isDualWriteEnabled()) {
    try {
      const remote = await apiCreateTransaction(payload);
      if (remote?._id) {
        await db.runAsync(
          `UPDATE transactions SET server_id = ?, dirty = 0 WHERE id = ?`,
          remote._id,
          created.id,
        );
      }
    } catch (e) {
      console.warn("[dal] dual-write transaction create failed", e);
    }
  }

  return enrichLocalTransaction(db, created);
}

export async function deleteLocalTransaction(transactionId: string) {
  const { db, row: existing } = await resolveLocalTransaction(transactionId);
  if (!existing) throw new Error("Transaction not found");
  const device_id = await getOrCreateDeviceId();
  await transactionsRepo.softDeleteTransaction(db, existing.id, device_id);

  if (isDualWriteEnabled() && existing.server_id) {
    try {
      await apiDeleteTransaction(existing.server_id);
      await db.runAsync(`UPDATE transactions SET dirty = 0 WHERE id = ?`, existing.id);
    } catch (e) {
      console.warn("[dal] dual-write transaction delete failed", e);
    }
  }
}

type UpdatePayload = {
  transactionId: string;
  accountId?: string;
  amount?: number;
  type?: "debit" | "credit";
  date?: string;
  description?: string;
  comment?: string;
  categoryId?: string;
  party?: string;
  for_party?: string;
  payment_status?: "paid" | "due";
  due_date?: string;
};

export async function updateLocalTransaction(payload: UpdatePayload) {
  const { db, row: existing } = await resolveLocalTransaction(
    payload.transactionId,
  );
  if (!existing) throw new Error("Transaction not found");
  const device_id = await getOrCreateDeviceId();

  const updated = await transactionsRepo.updateTransaction(db, existing.id, {
    device_id,
    account_id: payload.accountId,
    amount: payload.amount,
    type: payload.type,
    date: payload.date,
    description: payload.description,
    keyword: payload.comment,
    category_id: payload.categoryId,
    party_id: payload.party,
    for_party_id: payload.for_party,
    payment_status: payload.payment_status,
    due_date: payload.due_date,
  });

  if (isDualWriteEnabled() && existing.server_id) {
    try {
      await apiUpdateTransaction({
        ...payload,
        transactionId: existing.server_id,
      });
      await db.runAsync(`UPDATE transactions SET dirty = 0 WHERE id = ?`, existing.id);
    } catch (e) {
      console.warn("[dal] dual-write transaction update failed", e);
    }
  }

  return enrichLocalTransaction(db, updated);
}

export async function createLocalDuePayment(payload: {
  parentDueId: string;
  accountId: string;
  amount: number;
  type: "debit" | "credit";
  date?: string;
  description?: string;
  categoryId?: string;
}) {
  const { db, row: parent } = await resolveLocalTransaction(payload.parentDueId);
  if (!parent) throw new Error("Due transaction not found");
  const device_id = await getOrCreateDeviceId();

  const created = await transactionsRepo.createDuePaymentTransaction(db, {
    parentDueId: parent.id,
    account_id: payload.accountId,
    amount: payload.amount,
    type: payload.type,
    date: payload.date ?? new Date().toISOString(),
    description: payload.description ?? null,
    category_id: payload.categoryId ?? null,
    device_id,
  });

  if (isDualWriteEnabled() && parent.server_id) {
    try {
      const remote = await apiCreateDuePayment({
        ...payload,
        parentDueId: parent.server_id,
      });
      if (remote?._id) {
        await db.runAsync(
          `UPDATE transactions SET server_id = ?, dirty = 0 WHERE id = ?`,
          remote._id,
          created.id,
        );
      }
    } catch (e) {
      console.warn("[dal] dual-write due payment failed", e);
    }
  }

  return enrichLocalTransaction(db, created);
}

export async function createLocalTransfer(payload: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date?: string;
  description?: string;
  organizationId?: string | null;
}) {
  const db = await getDb();
  const device_id = await getOrCreateDeviceId();
  const transfer = await transfersRepo.createTransfer(db, {
    from_account_id: payload.fromAccountId,
    to_account_id: payload.toAccountId,
    amount: payload.amount,
    date: payload.date ?? new Date().toISOString(),
    description: payload.description ?? null,
    organization_id: payload.organizationId ?? null,
    device_id,
  });

  if (isDualWriteEnabled()) {
    try {
      await apiCreateTransfer(payload);
      await db.runAsync(`UPDATE transfers SET dirty = 0 WHERE id = ?`, transfer.id);
    } catch (e) {
      console.warn("[dal] dual-write transfer failed", e);
    }
  }

  return transfer;
}

/**
 * Payment History for a due / payment transaction (local-first).
 */
export async function fetchLocalDueChain(transactionId: string): Promise<{
  root: Transaction;
  payments: Array<Transaction & { remaining_after: number }>;
  summary: {
    original_amount: number;
    total_paid: number;
    remaining: number;
    is_settled: boolean;
    settled_at: string | null;
    payment_count: number;
  };
}> {
  const db = await getDb();
  const maps = await loadEnrichmentMaps(db);

  const seed = await db.getFirstAsync<LocalTransaction>(
    `SELECT * FROM transactions
     WHERE deleted_at IS NULL AND (id = ? OR server_id = ?)
     LIMIT 1`,
    transactionId,
    transactionId,
  );
  if (!seed) throw new Error("Transaction not found");

  const rootId = seed.parent_due_id || seed.id;
  const rootIdAlt = seed.parent_due_id
    ? (
        await db.getFirstAsync<{ id: string; server_id: string | null }>(
          `SELECT id, server_id FROM transactions WHERE id = ? OR server_id = ? LIMIT 1`,
          seed.parent_due_id,
          seed.parent_due_id,
        )
      )
    : { id: seed.id, server_id: seed.server_id };

  const ids = [
    rootId,
    rootIdAlt?.id,
    rootIdAlt?.server_id,
    seed.id,
    seed.server_id,
  ].filter(Boolean) as string[];
  const uniqueIds = [...new Set(ids)];
  const ph = uniqueIds.map(() => "?").join(",");

  const chainRaw = await db.getAllAsync<LocalTransaction>(
    `SELECT * FROM transactions
     WHERE deleted_at IS NULL
       AND (
         id IN (${ph}) OR server_id IN (${ph})
         OR parent_due_id IN (${ph})
         OR due_group_id IN (${ph})
       )
     ORDER BY date ASC, created_at ASC`,
    ...uniqueIds,
    ...uniqueIds,
    ...uniqueIds,
    ...uniqueIds,
  );

  const mapped = await Promise.all(
    chainRaw.map(async (row) => enrichFromMaps(row, maps)),
  );
  const hydrated = await hydrateParentDues(db, mapped, maps);

  const rootIdStr = String(rootIdAlt?.id || rootId);
  const rootServer = rootIdAlt?.server_id;
  const root =
    hydrated.find(
      (t) =>
        (t._id === rootIdStr || t._id === rootServer) &&
        t.payment_status === "due",
    ) ??
    hydrated.find((t) => t._id === rootIdStr || t._id === rootServer) ??
    hydrated[0];

  if (!root) throw new Error("Due root not found");

  const paymentsBase = hydrated.filter((t) => {
    const parent =
      typeof t.parent_due_id === "string"
        ? t.parent_due_id
        : t.parent_due_id && typeof t.parent_due_id === "object"
          ? t.parent_due_id._id
          : null;
    return (
      parent != null &&
      (parent === rootIdStr ||
        parent === rootServer ||
        parent === root._id)
    );
  });

  const originalAmount = Number(root.amount ?? 0);
  let running = originalAmount;
  const payments = paymentsBase.map((p) => {
    running = Math.max(0, running - Number(p.amount ?? 0));
    return { ...p, remaining_after: running };
  });

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const remaining = Math.max(0, originalAmount - totalPaid);

  return {
    root,
    payments,
    summary: {
      original_amount: originalAmount,
      total_paid: totalPaid,
      remaining,
      is_settled: remaining === 0,
      settled_at: root.due_settled_at ?? null,
      payment_count: payments.length,
    },
  };
}

// silence unused if tree-shaken oddly
void fetchTransactions;
