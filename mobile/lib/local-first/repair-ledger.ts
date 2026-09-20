import type { Db } from "@/db/client";
import {
  recalculateBalances,
  recalculateCashBalancesOnly,
} from "@/db/balances";
import { getMeta, META_KEYS, setMeta } from "@/db/meta";

/** Bump when repair SQL/rules change so existing devices re-apply. */
export const LEDGER_REPAIR_VERSION = "20";

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
 * Give every row an explicit `payment_status`.
 *
 * A blank/NULL status is treated as paid by every cash rule
 * (`CASH_PAID_SQL` matches `IS NULL OR ''`), so this cannot move a balance —
 * it removes a fragile convention that 671 cloud rows were relying on.
 */
async function normalizeBlankPaymentStatuses(db: Db): Promise<number> {
  const result = await db.runAsync(
    `UPDATE transactions
     SET payment_status = 'paid',
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE payment_status IS NULL OR payment_status = ''`,
  );
  return Number(result.changes ?? 0);
}

/**
 * Undo the end-of-day transfer dates written by the old `createLocalTransfer`.
 *
 * That code turned a picked day (`2026-09-20`) into `2026-09-20T23:59:59.000Z`.
 * The ordering fix in `lib/local-first/ledger-order.ts` already ignores the time
 * part, but the value is still wrong in two user-visible ways:
 *
 *  - `components/transaction-card.tsx` formats with `dayjs(date).format(...)` in
 *    local time, so in a positive UTC offset (e.g. +06:00) the transfer renders
 *    as the NEXT day.
 *  - Anything reading the raw column keeps seeing a timestamp where a calendar
 *    day is meant.
 *
 * Deliberately narrow: only rows that (a) belong to a transfer and (b) carry the
 * exact `T23:59:59.000Z` suffix this code wrote. Blanket-truncating every
 * timestamp would be wrong — rows synced from the cloud can carry a real UTC
 * instant whose local day is the previous day, and truncating those would shift
 * their displayed date.
 */
async function normalizeLegacyTransferDates(db: Db): Promise<number> {
  const txns = await db.runAsync(
    `UPDATE transactions
     SET date = substr(date, 1, 10)
     WHERE deleted_at IS NULL
       AND transfer_id IS NOT NULL
       AND transfer_id != ''
       AND date LIKE '%T23:59:59.000Z'`,
  );
  const transfers = await db.runAsync(
    `UPDATE transfers
     SET date = substr(date, 1, 10)
     WHERE date LIKE '%T23:59:59.000Z'`,
  );
  return Number(txns.changes ?? 0) + Number(transfers.changes ?? 0);
}

/**
 * Fix common migrate/restore damage (local SQL only + cash balances).
 * Cloud overlay and Balance-after trails finish in the background.
 */
export async function repairLocalLedgerSemantics(
  db: Db,
  opts?: { skipCloud?: boolean },
): Promise<{
  duesFixed: number;
  categoriesFixed: number;
  revertedToPaid: number;
  fksNormalized: number;
  orgsStamped: number;
  transferDatesFixed: number;
  statusesNormalized: number;
}> {
  const fksNormalized = await normalizeForeignKeys(db);
  const orgsStamped = await stampOrganizationFromAccount(db);
  const transferDatesFixed = await normalizeLegacyTransferDates(db);
  const statusesNormalized = await normalizeBlankPaymentStatuses(db);

  // ─── Payment status cleanup ───
  // Canonical due model (matches cloud):
  //   open due     → payment_status='due', remaining > 0, due_settled_at NULL
  //   partial pay  → payment_status='due', remaining decreased
  //   fully paid   → payment_status='due', remaining = 0, due_settled_at set
  // Payment children are always payment_status='paid'.

  const revertPayments = await db.runAsync(
    `UPDATE transactions
     SET payment_status = 'paid',
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE deleted_at IS NULL
       AND payment_status = 'due'
       AND parent_due_id IS NOT NULL
       AND parent_due_id != ''`,
  );

  // Stamp settled when remaining hit 0 — keep status 'due' (never flip to paid).
  const stampSettled = await db.runAsync(
    `UPDATE transactions
     SET due_remaining = 0,
         due_settled_at = COALESCE(
           NULLIF(due_settled_at, ''),
           updated_at,
           datetime('now')
         ),
         payment_status = 'due',
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE deleted_at IS NULL
       AND (parent_due_id IS NULL OR parent_due_id = '')
       AND due_remaining IS NOT NULL
       AND CAST(due_remaining AS REAL) <= 0`,
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

  // Restore due roots wrongly flipped to paid (v16 falseDueFix / v17 settleZero).
  // Do NOT touch normal cash-paid rows that never had a due chain.
  const dueFix = await db.runAsync(
    `UPDATE transactions
     SET payment_status = 'due',
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE deleted_at IS NULL
       AND payment_status != 'due'
       AND (parent_due_id IS NULL OR parent_due_id = '')
       AND (
         category_id IS NULL OR category_id NOT IN (
           SELECT id FROM categories WHERE type IN ('loan_in','loan_out')
           UNION
           SELECT server_id FROM categories
           WHERE server_id IS NOT NULL AND type IN ('loan_in','loan_out')
         )
       )
       AND (
         (due_remaining IS NOT NULL AND CAST(due_remaining AS REAL) > 0
           AND (due_settled_at IS NULL OR due_settled_at = ''))
         OR (due_settled_at IS NOT NULL AND due_settled_at != '')
         OR (
           due_remaining IS NOT NULL
           AND CAST(due_remaining AS REAL) <= 0
           AND (
             (due_group_id IS NOT NULL AND due_group_id != '')
             OR EXISTS (
               SELECT 1 FROM transactions c
               WHERE c.deleted_at IS NULL
                 AND (
                   c.parent_due_id = transactions.id
                   OR (transactions.server_id IS NOT NULL
                       AND c.parent_due_id = transactions.server_id)
                 )
             )
           )
         )
       )`,
  );

  const duesFixed = Number(dueFix.changes ?? 0);
  const revertedToPaid =
    Number(revertPayments.changes ?? 0) + Number(stampSettled.changes ?? 0);

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
  // Skip during migrate/import — caller already has cloud currents in the dump.
  if (!opts?.skipCloud) {
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
  }

  // Cash first so Accounts/Dashboard can paint; trails finish in background.
  await recalculateCashBalancesOnly(db, { allOrganizations: true });

  return {
    duesFixed,
    categoriesFixed,
    revertedToPaid,
    fksNormalized,
    orgsStamped,
    transferDatesFixed,
    statusesNormalized,
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
