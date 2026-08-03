import dayjs from "dayjs";
import type { Db } from "@/db/client";
import type { ScopeFilter } from "@/db/types";
import { scopeWhere } from "@/db/meta";
import type { TransactionFilters } from "@/services/transactions";

export type LocalTxnFilterSql = {
  clauses: string[];
  params: (string | number | null)[];
};

/** Guard against pathological queries building huge WHERE trees. */
const MAX_SEARCH_TERMS = 6;

/** Treat user input as literal text — `%`/`_` must not act as wildcards. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Digits-only terms should also match the transaction amount. */
function parseSearchAmount(term: string): number | null {
  if (!/^[\d.,]+$/.test(term)) return null;
  const parsed = Number(term.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Match a foreign-key column against a related row's name. Local rows and
 * synced rows can be referenced by either `id` or `server_id`, so both are
 * resolved. Consumes two `?` params (the same LIKE pattern twice).
 */
function nameLookupClause(column: string, table: string): string {
  return `${column} IN (
    SELECT id FROM ${table}
    WHERE deleted_at IS NULL AND name LIKE ? ESCAPE '\\' COLLATE NOCASE
    UNION
    SELECT server_id FROM ${table}
    WHERE server_id IS NOT NULL AND deleted_at IS NULL
      AND name LIKE ? ESCAPE '\\' COLLATE NOCASE
  )`;
}

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
    // Only open dues. Legacy rows never got due_remaining backfilled, so a bare
    // `due_remaining > 0` silently hides them (NULL > 0 is NULL, not true).
    clauses.push("COALESCE(due_remaining, amount) > 0");
    clauses.push("(due_settled_at IS NULL OR due_settled_at = '')");
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

  // Loan chips: match loan roots by category type + cash direction, mirroring
  // isLoanGivenRoot / isLoanReceivedRoot. Without the direction guard the
  // repayment legs (same category type, opposite direction) are fetched too and
  // only dropped client-side, which wastes the page budget.
  if (filters.loan_filter === "loan_given") {
    clauses.push("type = 'debit'");
    clauses.push(
      `category_id IN (
         SELECT id FROM categories WHERE type = 'loan_out'
         UNION
         SELECT server_id FROM categories
         WHERE server_id IS NOT NULL AND type = 'loan_out'
       )`,
    );
  } else if (filters.loan_filter === "loan_received") {
    clauses.push("type = 'credit'");
    clauses.push(
      `category_id IN (
         SELECT id FROM categories WHERE type = 'loan_in'
         UNION
         SELECT server_id FROM categories
         WHERE server_id IS NOT NULL AND type = 'loan_in'
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
    // Every whitespace-separated term must match somewhere, so extra words
    // narrow the result set instead of widening it.
    const terms = q.split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TERMS);
    for (const term of terms) {
      const like = `%${escapeLikePattern(term)}%`;
      const amount = parseSearchAmount(term);
      const amountClause = amount != null ? " OR amount = ?" : "";

      clauses.push(
        `(
          description LIKE ? ESCAPE '\\'
          OR keyword LIKE ? ESCAPE '\\'
          OR vendor LIKE ? ESCAPE '\\'
          OR counterparty LIKE ? ESCAPE '\\'
          OR ${nameLookupClause("party_id", "parties")}
          OR ${nameLookupClause("for_party_id", "parties")}
          OR ${nameLookupClause("category_id", "categories")}
          OR ${nameLookupClause("account_id", "accounts")}
          ${amountClause}
        )`,
      );

      // 4 direct columns + 2 params per name lookup × 4 lookups.
      allParams.push(like, like, like, like);
      allParams.push(like, like, like, like, like, like, like, like);
      if (amount != null) allParams.push(amount);
    }
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
