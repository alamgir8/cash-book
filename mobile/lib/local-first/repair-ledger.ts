import type { Db } from "@/db/client";
import {
  recalculateBalances,
  recalculateCashBalancesOnly,
} from "@/db/balances";
import { getMeta, META_KEYS, setMeta } from "@/db/meta";

/** Bump when repair SQL/rules change so existing devices re-apply. */
export const LEDGER_REPAIR_VERSION = "16";

/** Soft deadline for optional cloud overlay — never block Home paint. */
const CLOUD_RECONCILE_MS = 12_000;
const ACCOUNT_OPENING_RECONCILE_MS = 15_000;

let repairInFlight: Promise<void> | null = null;

/**
 * Rewrite FK columns that still hold Mongo server_ids to the local UUID.
 * Enrichment, filters, and loan pairing all expect consistent local ids.
 */
async function normalizeForeignKeys(db: Db): Promise<number> {
  let changes = 0;
  const rewrites: Array<{ column: string; table: string }> = [
    { column: "account_id", table: "accounts" },
    { column: "category_id", table: "categories" },
    { column: "party_id", table: "parties" },
    { column: "for_party_id", table: "parties" },
  ];

  for (const { column, table } of rewrites) {
    const result = await db.runAsync(
      `UPDATE transactions
       SET ${column} = (
         SELECT ${table}.id FROM ${table}
         WHERE ${table}.server_id = transactions.${column}
           AND ${table}.deleted_at IS NULL
         LIMIT 1
       ),
       updated_at = COALESCE(updated_at, datetime('now'))
       WHERE deleted_at IS NULL
         AND ${column} IS NOT NULL
         AND ${column} != ''
         AND EXISTS (
           SELECT 1 FROM ${table}
           WHERE ${table}.server_id = transactions.${column}
             AND ${table}.deleted_at IS NULL
         )
         AND NOT EXISTS (
           SELECT 1 FROM ${table}
           WHERE ${table}.id = transactions.${column}
         )`,
    );
    changes += Number(result.changes ?? 0);
  }

  // parent_due_id may also be a Mongo id.
  const parentFix = await db.runAsync(
    `UPDATE transactions
     SET parent_due_id = (
       SELECT p.id FROM transactions p
       WHERE p.server_id = transactions.parent_due_id
         AND p.deleted_at IS NULL
       LIMIT 1
     ),
     updated_at = COALESCE(updated_at, datetime('now'))
     WHERE deleted_at IS NULL
       AND parent_due_id IS NOT NULL
       AND parent_due_id != ''
       AND EXISTS (
         SELECT 1 FROM transactions p
         WHERE p.server_id = transactions.parent_due_id
           AND p.deleted_at IS NULL
       )
       AND NOT EXISTS (
         SELECT 1 FROM transactions p WHERE p.id = transactions.parent_due_id
       )`,
  );
  changes += Number(parentFix.changes ?? 0);

  return changes;
}

/**
 * Legacy migrate left some txs with NULL organization_id even though their
 * account belongs to a shop. Stamp the account's org so cloud and local
 * counts both converge on the full book (~1204).
 */
async function stampOrganizationFromAccount(db: Db): Promise<number> {
  const result = await db.runAsync(
    `UPDATE transactions
     SET organization_id = (
       SELECT a.organization_id FROM accounts a
       WHERE (a.id = transactions.account_id OR a.server_id = transactions.account_id)
         AND a.organization_id IS NOT NULL
         AND a.organization_id != ''
         AND a.deleted_at IS NULL
       LIMIT 1
     ),
     updated_at = COALESCE(updated_at, datetime('now'))
     WHERE deleted_at IS NULL
       AND (organization_id IS NULL OR organization_id = '')
       AND EXISTS (
         SELECT 1 FROM accounts a
         WHERE (a.id = transactions.account_id OR a.server_id = transactions.account_id)
           AND a.organization_id IS NOT NULL
           AND a.organization_id != ''
           AND a.deleted_at IS NULL
       )`,
  );
  return Number(result.changes ?? 0);
}

async function countLocalTransactions(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) as n FROM transactions WHERE deleted_at IS NULL`,
  );
  return Number(row?.n ?? 0);
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[repair] ${label} timed out after ${ms}ms`);
          resolve(null);
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Optional cloud overlay + full chronological trails. Never awaited on the
 * Home query path — runs after cash balances are already correct.
 */
async function finishRepairEnrichment(db: Db): Promise<void> {
  // 1) Restore openings from cloud first — missing openings make Balance and
  //    Cash net collapse to the same number and shift every Balance-after.
  try {
    const { reconcileAccountOpeningsFromCloud } = await import(
      "./reconcile-account-openings"
    );
    await withTimeout(
      reconcileAccountOpeningsFromCloud(db),
      ACCOUNT_OPENING_RECONCILE_MS,
      "account openings",
    );
  } catch (e) {
    console.warn("[repair] account openings reconcile skipped", e);
  }

  const localCount = await countLocalTransactions(db);
  if (localCount > 0) {
    try {
      const { reconcileLocalTxnDetailsFromCloud } = await import(
        "./reconcile-from-cloud"
      );
      const result = await withTimeout(
        reconcileLocalTxnDetailsFromCloud(db),
        CLOUD_RECONCILE_MS,
        "cloud reconcile",
      );
      if (result && result.updated > 0) {
        await normalizeForeignKeys(db);
        await stampOrganizationFromAccount(db);
        // Re-align openings after payment_status overlays change paid nets.
        try {
          const { reconcileAccountOpeningsFromCloud } = await import(
            "./reconcile-account-openings"
          );
          await reconcileAccountOpeningsFromCloud(db);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      console.warn("[repair] cloud reconcile skipped", e);
    }
  }

  try {
    await recalculateBalances(db, { allOrganizations: true });
  } catch (e) {
    console.warn("[repair] trail rewrite skipped", e);
  }

  try {
    const { queryClient } = await import("@/lib/queryClient");
    await queryClient.invalidateQueries({ refetchType: "active" });
  } catch {
    /* ignore */
  }
}

/**
 * Fix common migrate/restore damage (local SQL only + cash balances).
 * Cloud overlay and Balance-after trails finish in the background.
 */
export async function repairLocalLedgerSemantics(db: Db): Promise<{
  duesFixed: number;
  categoriesFixed: number;
  revertedToPaid: number;
  fksNormalized: number;
  orgsStamped: number;
}> {
  const fksNormalized = await normalizeForeignKeys(db);
  const orgsStamped = await stampOrganizationFromAccount(db);

  // ─── Payment status cleanup ───
  // Settled due roots stay payment_status='due' with due_settled_at set so they
  // remain excluded from wallet cash; their payment children are the cash hits.
  // (Flipping settled roots to paid double-counts with those children.)

  const revertZero = await db.runAsync(
    `UPDATE transactions
     SET payment_status = 'paid',
         due_remaining = NULL,
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE deleted_at IS NULL
       AND payment_status = 'due'
       AND due_remaining IS NOT NULL
       AND CAST(due_remaining AS REAL) <= 0
       AND (due_settled_at IS NULL OR due_settled_at = '')`,
  );

  const revertPayments = await db.runAsync(
    `UPDATE transactions
     SET payment_status = 'paid',
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE deleted_at IS NULL
       AND payment_status = 'due'
       AND parent_due_id IS NOT NULL
       AND parent_due_id != ''`,
  );

  await db.runAsync(
    `UPDATE transactions
     SET parent_due_id = NULL,
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE parent_due_id IN ('[object Object]', 'undefined', 'null')`,
  );
  await db.runAsync(
    `UPDATE transactions
     SET due_group_id = NULL,
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE due_group_id IN ('[object Object]', 'undefined', 'null')`,
  );

  // False dues from thin migrate / old repair: marked due with remaining but
  // NEVER given a due_date. Those excluded debit cash and inflated balances
  // (Bank +1,30,000). Flip them back to paid so wallet cash is correct.
  const falseDueFix = await db.runAsync(
    `UPDATE transactions
     SET payment_status = 'paid',
         due_remaining = NULL,
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE deleted_at IS NULL
       AND payment_status = 'due'
       AND (parent_due_id IS NULL OR parent_due_id = '')
       AND (due_date IS NULL OR due_date = '')
       AND (due_settled_at IS NULL OR due_settled_at = '')`,
  );

  // Restore real open dues only when remaining > 0 AND due_date is set.
  const dueFix = await db.runAsync(
    `UPDATE transactions
     SET payment_status = 'due',
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE deleted_at IS NULL
       AND payment_status != 'due'
       AND (parent_due_id IS NULL OR parent_due_id = '')
       AND due_remaining IS NOT NULL
       AND CAST(due_remaining AS REAL) > 0
       AND due_date IS NOT NULL
       AND due_date != ''
       AND (due_settled_at IS NULL OR due_settled_at = '')
       AND (
         category_id IS NULL OR category_id NOT IN (
           SELECT id FROM categories WHERE type IN ('loan_in','loan_out')
           UNION
           SELECT server_id FROM categories
           WHERE server_id IS NOT NULL AND type IN ('loan_in','loan_out')
         )
       )`,
  );

  const duesFixed = Number(dueFix.changes ?? 0);
  const revertedToPaid =
    Number(revertZero.changes ?? 0) +
    Number(revertPayments.changes ?? 0) +
    Number(falseDueFix.changes ?? 0);

  const catFixes = [
    `UPDATE categories SET type = 'loan_out', flow = 'debit'
      WHERE deleted_at IS NULL AND (
        name = 'Loan Given' OR name LIKE '%Loan Given%'
        OR lower(name) LIKE '%loan given%'
      ) AND type != 'loan_out'`,
    `UPDATE categories SET type = 'loan_in', flow = 'credit'
      WHERE deleted_at IS NULL AND (
        name = 'Loan Received' OR name LIKE '%Loan Received%'
        OR lower(name) LIKE '%loan received%'
      ) AND type != 'loan_in'`,
    `UPDATE categories SET type = 'loan_in', flow = 'debit'
      WHERE deleted_at IS NULL AND (
        name = 'Loan Repayment Paid' OR name LIKE '%Repayment Paid%'
        OR lower(name) LIKE '%repayment paid%'
      ) AND type != 'loan_in'`,
    `UPDATE categories SET type = 'loan_out', flow = 'credit'
      WHERE deleted_at IS NULL AND (
        name = 'Loan Repayment Received' OR name LIKE '%Repayment Received%'
        OR lower(name) LIKE '%repayment received%'
      ) AND type != 'loan_out'`,
  ] as const;

  let categoriesFixed = 0;
  for (const sql of catFixes) {
    const r = await db.runAsync(sql);
    categoriesFixed += Number(r.changes ?? 0);
  }

  // Align openings to Mongo current before cash paint so Accounts shows
  // নগদ≈16k / বিকাশ≈5.7k / ব্যাংক≈612k instead of local paid-net drift.
  try {
    const { reconcileAccountOpeningsFromCloud } = await import(
      "./reconcile-account-openings"
    );
    await withTimeout(
      reconcileAccountOpeningsFromCloud(db),
      ACCOUNT_OPENING_RECONCILE_MS,
      "account openings (pre-cash)",
    );
  } catch (e) {
    console.warn("[repair] pre-cash opening reconcile skipped", e);
  }

  // Cash first so Accounts/Dashboard can paint; trails finish in background.
  await recalculateCashBalancesOnly(db, { allOrganizations: true });

  return {
    duesFixed,
    categoriesFixed,
    revertedToPaid,
    fksNormalized,
    orgsStamped,
  };
}

/**
 * Idempotent gate — runs repair once per LEDGER_REPAIR_VERSION.
 * Single-flight: concurrent Home queries share one promise.
 */
export async function ensureLocalLedgerRepaired(db: Db): Promise<void> {
  const done = await getMeta(db, META_KEYS.LEDGER_REPAIR_VERSION);
  if (done === LEDGER_REPAIR_VERSION) return;

  if (!repairInFlight) {
    repairInFlight = (async () => {
      try {
        await repairLocalLedgerSemantics(db);
        await setMeta(db, META_KEYS.LEDGER_REPAIR_VERSION, LEDGER_REPAIR_VERSION);
        // Cloud overlay + Balance-after trails — never block readers.
        void finishRepairEnrichment(db).catch((e) =>
          console.warn("[repair] enrichment failed", e),
        );
      } finally {
        repairInFlight = null;
      }
    })();
  }

  await repairInFlight;
}

/**
 * Kick repair without blocking the caller (Home/Accounts first paint).
 * After enrichment finishes, active queries are invalidated.
 */
export function scheduleLocalLedgerRepair(db: Db): void {
  void ensureLocalLedgerRepaired(db).catch((e) =>
    console.warn("[repair] background failed", e),
  );
}
