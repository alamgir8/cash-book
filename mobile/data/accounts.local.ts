import { getDb } from "@/db/client";
import * as accountsRepo from "@/db/repos/accounts";
import * as transactionsRepo from "@/db/repos/transactions";
import { localAccountToApiLocalId, localAccountToOverview } from "./mappers";
import {
  createAccount as apiCreateAccount,
  deleteAccount as apiDeleteAccount,
  updateAccount as apiUpdateAccount,
  type AccountOverview,
} from "@/services/accounts";
import type { AccountPayload } from "@/types/account";
import { isDualWriteEnabled } from "@/lib/local-first/flags";
import { getOrCreateDeviceId } from "@/services/device";
import type { TransactionFilters } from "@/services/transactions";

async function resolveLocalAccount(accountId: string) {
  const db = await getDb();
  let row = await accountsRepo.getAccountById(db, accountId);
  if (!row) {
    row =
      (await db.getFirstAsync<any>(
        `SELECT * FROM accounts WHERE server_id = ? AND deleted_at IS NULL LIMIT 1`,
        accountId,
      )) ?? null;
  }
  return { db, row };
}

async function sumForAccount(
  db: Awaited<ReturnType<typeof getDb>>,
  row: { id: string; server_id: string | null },
  orgId: string | null,
) {
  return db.getFirstAsync<{
    total_debit: number;
    total_credit: number;
    total_transactions: number;
    last_transaction_date: string | null;
  }>(
    orgId
      ? `SELECT
          COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as total_debit,
          COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_credit,
          COUNT(*) as total_transactions,
          MAX(date) as last_transaction_date
         FROM transactions
         WHERE deleted_at IS NULL
           AND organization_id = ?
           AND (account_id = ? OR account_id = ?)`
      : `SELECT
          COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as total_debit,
          COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_credit,
          COUNT(*) as total_transactions,
          MAX(date) as last_transaction_date
         FROM transactions
         WHERE deleted_at IS NULL
           AND (organization_id IS NULL OR organization_id = '')
           AND (account_id = ? OR account_id = ?)`,
    ...(orgId
      ? [orgId, row.id, row.server_id ?? row.id]
      : [row.id, row.server_id ?? row.id]),
  );
}

export async function fetchLocalAccounts(
  organizationId?: string | null,
): Promise<AccountOverview[]> {
  const db = await getDb();
  let orgId = organizationId ?? null;
  let rows = await accountsRepo.listAccounts(db, { organizationId: orgId });
  // Pre-org migrate left everything as personal — don't show a blank app.
  if (orgId && rows.length === 0) {
    rows = await accountsRepo.listAccounts(db, { organizationId: null });
    if (rows.length > 0) orgId = null;
  }
  const out: AccountOverview[] = [];
  for (const row of rows) {
    const sum = await sumForAccount(db, row, orgId ?? row.organization_id);
    const totalDebit = Number(sum?.total_debit ?? 0);
    const totalCredit = Number(sum?.total_credit ?? 0);
    out.push({
      ...localAccountToOverview(row),
      summary: {
        totalTransactions: Number(sum?.total_transactions ?? 0),
        totalDebit,
        totalCredit,
        net: totalCredit - totalDebit,
        lastTransactionDate: sum?.last_transaction_date ?? null,
      },
    });
  }
  return out;
}

export async function fetchLocalAccountDetail(accountId: string) {
  const { db, row } = await resolveLocalAccount(accountId);
  if (!row) throw new Error("Account not found");

  const txns = await transactionsRepo.listTransactions(
    db,
    { organizationId: row.organization_id },
    { accountId: row.id, limit: 20, offset: 0 },
  );
  const sum = await db.getFirstAsync<{
    total_debit: number;
    total_credit: number;
    total_transactions: number;
    last_transaction_date: string | null;
  }>(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as total_debit,
      COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_credit,
      COUNT(*) as total_transactions,
      MAX(date) as last_transaction_date
     FROM transactions
     WHERE deleted_at IS NULL
       AND (account_id = ? OR account_id = ?)`,
    row.id,
    row.server_id ?? row.id,
  );

  const { enrichLocalTransaction } = await import("./transactions.local");
  const recentTransactions = [];
  for (const t of txns) {
    recentTransactions.push(await enrichLocalTransaction(db, t));
  }

  const totalDebit = Number(sum?.total_debit ?? 0);
  const totalCredit = Number(sum?.total_credit ?? 0);

  return {
    account: localAccountToApiLocalId(row),
    summary: {
      totalTransactions: Number(sum?.total_transactions ?? 0),
      totalDebit,
      totalCredit,
      net: totalCredit - totalDebit,
      lastTransactionDate: sum?.last_transaction_date ?? null,
    },
    recentTransactions,
  };
}

export async function fetchLocalAccountTransactions(
  accountId: string,
  filters: TransactionFilters,
) {
  const { row } = await resolveLocalAccount(accountId);
  if (!row) throw new Error("Account not found");

  const { fetchLocalTransactions } = await import("./transactions.local");
  const result = await fetchLocalTransactions({
    ...filters,
    accountId: row.id,
  });
  const page = Number(filters.page ?? 1);
  const limit = Number(filters.limit ?? 20);
  const total = result.pagination?.total ?? result.transactions.length;

  return {
    account: localAccountToApiLocalId(row),
    transactions: result.transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function createLocalAccount(
  payload: AccountPayload & { organization?: string | null },
) {
  const db = await getDb();
  const device_id = await getOrCreateDeviceId();
  const row = await accountsRepo.createAccount(db, {
    name: payload.name,
    description: payload.description,
    kind: payload.kind,
    opening_balance: payload.opening_balance,
    currency_code: payload.currency_code,
    currency_symbol: payload.currency_symbol,
    organization_id: payload.organization ?? null,
    device_id,
  });

  if (isDualWriteEnabled()) {
    try {
      const remote = await apiCreateAccount(payload);
      if (remote?._id) {
        await db.runAsync(
          `UPDATE accounts SET server_id = ?, dirty = 0 WHERE id = ?`,
          remote._id,
          row.id,
        );
      }
    } catch (e) {
      console.warn("[dal] dual-write account create failed", e);
    }
  }

  return localAccountToApiLocalId(row);
}

export async function updateLocalAccount(
  args: { accountId: string; archived?: boolean } & Partial<AccountPayload>,
) {
  const db = await getDb();
  const device_id = await getOrCreateDeviceId();
  const row = await accountsRepo.updateAccount(db, args.accountId, {
    name: args.name,
    description: args.description,
    kind: args.kind,
    opening_balance: args.opening_balance,
    currency_code: args.currency_code,
    currency_symbol: args.currency_symbol,
    archived: args.archived,
    device_id,
  });

  if (isDualWriteEnabled() && row.server_id) {
    try {
      await apiUpdateAccount({
        accountId: row.server_id,
        name: args.name,
        description: args.description,
        kind: args.kind,
        opening_balance: args.opening_balance,
        currency_code: args.currency_code,
        currency_symbol: args.currency_symbol,
      });
      await db.runAsync(`UPDATE accounts SET dirty = 0 WHERE id = ?`, row.id);
    } catch (e) {
      console.warn("[dal] dual-write account update failed", e);
    }
  }

  return localAccountToApiLocalId(row);
}

export async function deleteLocalAccount(accountId: string) {
  const db = await getDb();
  const device_id = await getOrCreateDeviceId();
  const existing = await accountsRepo.getAccountById(db, accountId);
  await accountsRepo.softDeleteAccount(db, accountId, device_id);

  if (isDualWriteEnabled() && existing?.server_id) {
    try {
      await apiDeleteAccount(existing.server_id);
      await db.runAsync(`UPDATE accounts SET dirty = 0 WHERE id = ?`, accountId);
    } catch (e) {
      console.warn("[dal] dual-write account delete failed", e);
    }
  }
}
