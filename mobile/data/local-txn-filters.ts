import dayjs from "dayjs";
import type { Db } from "@/db/client";
import type { ScopeFilter } from "@/db/types";
import { scopeWhere } from "@/db/meta";
import type { TransactionFilters } from "@/services/transactions";

export type LocalTxnFilterSql = {
  clauses: string[];
  params: (string | number | null)[];
};

/** Resolve inclusive day bounds from range / start-end filters. */
export function resolveLocalDateBounds(filters: TransactionFilters): {
  fromIso?: string;
  toIso?: string;
} {
  const explicitFrom = filters.from ?? filters.startDate;
  const explicitTo = filters.to ?? filters.endDate;

  if (explicitFrom || explicitTo) {
    return {
      fromIso: explicitFrom
        ? dayjs(explicitFrom).startOf("day").toISOString()
        : undefined,
      toIso: explicitTo
        ? dayjs(explicitTo).endOf("day").toISOString()
        : undefined,
    };
  }

  const range = filters.range;
  if (range === "daily") {
    return {
      fromIso: dayjs().startOf("day").toISOString(),
      toIso: dayjs().endOf("day").toISOString(),
    };
  }
  if (range === "weekly") {
    return {
      fromIso: dayjs().startOf("week").toISOString(),
      toIso: dayjs().endOf("week").toISOString(),
    };
  }
  if (range === "monthly") {
    return {
      fromIso: dayjs().startOf("month").toISOString(),
      toIso: dayjs().endOf("month").toISOString(),
    };
  }
  if (range === "yearly") {
    return {
      fromIso: dayjs().startOf("year").toISOString(),
      toIso: dayjs().endOf("year").toISOString(),
    };
  }

  return {};
}

/**
 * Build SQL WHERE clauses matching cloud list filters for local SQLite reads.
 */
export async function buildLocalTransactionFilterSql(
  db: Db,
  scope: ScopeFilter | undefined,
  filters: TransactionFilters = {},
): Promise<LocalTxnFilterSql> {
  const { sql, params } = scopeWhere("", scope);
  const clauses = [sql];
  const allParams: (string | number | null)[] = [...params];

  if (!filters.includeDeleted) {
    clauses.push("deleted_at IS NULL");
  }

  if (filters.accountId) {
    const acc = await db.getFirstAsync<{ id: string; server_id: string | null }>(
      `SELECT id, server_id FROM accounts WHERE id = ? OR server_id = ? LIMIT 1`,
      filters.accountId,
      filters.accountId,
    );
    clauses.push("(account_id = ? OR account_id = ?)");
    allParams.push(
      acc?.id ?? filters.accountId,
      acc?.server_id ?? filters.accountId,
    );
  }

  if (filters.type === "debit" || filters.type === "credit") {
    clauses.push("type = ?");
    allParams.push(filters.type);
  }

  if (filters.payment_status === "due") {
    // Match cloud Due chip: open root dues only (not loan categories).
    clauses.push("payment_status = 'due'");
    clauses.push("(parent_due_id IS NULL OR parent_due_id = '')");
    // Match Mongo: only open dues with remaining > 0.
    clauses.push("due_remaining > 0");
    if (!filters.loan_filter) {
      clauses.push(
        `(category_id IS NULL OR category_id NOT IN (
          SELECT id FROM categories WHERE type IN ('loan_in','loan_out')
          UNION
          SELECT server_id FROM categories
          WHERE server_id IS NOT NULL AND type IN ('loan_in','loan_out')
        ))`,
      );
    }
  } else if (filters.payment_status === "paid") {
    clauses.push(
      "(payment_status = 'paid' OR payment_status IS NULL OR payment_status = '')",
    );
  }

  // Loan chips: category type only — unsettled filter applied after loan_summary.
  if (filters.loan_filter === "loan_given") {
    clauses.push(
      `category_id IN (
         SELECT id FROM categories
         WHERE type = 'loan_out'
            OR name = 'Loan Given'
            OR name LIKE '%Loan Given%'
         UNION
         SELECT server_id FROM categories
         WHERE server_id IS NOT NULL AND (
           type = 'loan_out' OR name = 'Loan Given' OR name LIKE '%Loan Given%'
         )
       )`,
    );
  } else if (filters.loan_filter === "loan_received") {
    clauses.push(
      `category_id IN (
         SELECT id FROM categories
         WHERE type = 'loan_in'
            OR name = 'Loan Received'
            OR name LIKE '%Loan Received%'
         UNION
         SELECT server_id FROM categories
         WHERE server_id IS NOT NULL AND (
           type = 'loan_in' OR name = 'Loan Received' OR name LIKE '%Loan Received%'
         )
       )`,
    );
  }

  const { fromIso, toIso } = resolveLocalDateBounds(filters);
  // Compare by calendar day so timezone / date-only strings still match.
  if (fromIso) {
    clauses.push("date(date) >= date(?)");
    allParams.push(fromIso);
  }
  if (toIso) {
    clauses.push("date(date) <= date(?)");
    allParams.push(toIso);
  }

  if (filters.categoryId) {
    clauses.push("(category_id = ? OR category_id = ?)");
    allParams.push(filters.categoryId, filters.categoryId);
  } else if (filters.category_name?.trim()) {
    const name = filters.category_name.trim();
    clauses.push(
      `category_id IN (
        SELECT id FROM categories WHERE name = ? COLLATE NOCASE
        UNION
        SELECT server_id FROM categories
        WHERE server_id IS NOT NULL AND name = ? COLLATE NOCASE
      )`,
    );
    allParams.push(name, name);
  }

  if (filters.party_id) {
    clauses.push("(party_id = ? OR party_id IN (SELECT id FROM parties WHERE server_id = ?))");
    allParams.push(filters.party_id, filters.party_id);
  } else if (filters.party_name?.trim()) {
    const name = filters.party_name.trim();
    clauses.push(
      `(
        party_id IN (
          SELECT id FROM parties WHERE name = ? COLLATE NOCASE
          UNION
          SELECT server_id FROM parties WHERE server_id IS NOT NULL AND name = ? COLLATE NOCASE
        )
        OR vendor = ? COLLATE NOCASE
        OR counterparty = ? COLLATE NOCASE
      )`,
    );
    allParams.push(name, name, name, name);
  }

  if (filters.for_party_id) {
    clauses.push(
      "(for_party_id = ? OR for_party_id IN (SELECT id FROM parties WHERE server_id = ?))",
    );
    allParams.push(filters.for_party_id, filters.for_party_id);
  } else if (filters.for_party_name?.trim()) {
    const name = filters.for_party_name.trim();
    clauses.push(
      `for_party_id IN (
        SELECT id FROM parties WHERE name = ? COLLATE NOCASE
        UNION
        SELECT server_id FROM parties WHERE server_id IS NOT NULL AND name = ? COLLATE NOCASE
      )`,
    );
    allParams.push(name, name);
  }

  if (filters.counterparty?.trim()) {
    clauses.push("counterparty = ? COLLATE NOCASE");
    allParams.push(filters.counterparty.trim());
  }

  const q = (filters.search ?? filters.q)?.trim();
  if (q) {
    clauses.push(
      `(description LIKE ? OR keyword LIKE ? OR vendor LIKE ? OR counterparty LIKE ?)`,
    );
    const like = `%${q}%`;
    allParams.push(like, like, like, like);
  }

  if (filters.minAmount != null && !Number.isNaN(Number(filters.minAmount))) {
    clauses.push("amount >= ?");
    allParams.push(Number(filters.minAmount));
  }
  if (filters.maxAmount != null && !Number.isNaN(Number(filters.maxAmount))) {
    clauses.push("amount <= ?");
    allParams.push(Number(filters.maxAmount));
  }

  return { clauses, params: allParams };
}
