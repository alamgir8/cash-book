import type { Db } from "@/db/client";
import { recalculateBalances } from "@/db/balances";
import { getMeta, META_KEYS, setMeta } from "@/db/meta";

/** Bump when repair SQL/rules change so existing devices re-apply. */
export const LEDGER_REPAIR_VERSION = "3";

/**
 * Fix common migrate/restore damage:
 * - Dues imported as payment_status=paid (lost due_remaining semantics)
 * - Bad parent_due_id from object→string coercion
 * - Loan categories with wrong/missing type so chips/badges break
 * Then recalc account cash balances (paid only).
 */
export async function repairLocalLedgerSemantics(db: Db): Promise<{
  duesFixed: number;
  categoriesFixed: number;
  parentsCleared: number;
}> {
  // ObjectIds stringified as "[object Object]" break due-chain filters.
  const parentClear = await db.runAsync(
    `UPDATE transactions
     SET parent_due_id = NULL,
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE parent_due_id = '[object Object]'
        OR parent_due_id = 'undefined'
        OR parent_due_id = 'null'`,
  );

  const groupClear = await db.runAsync(
    `UPDATE transactions
     SET due_group_id = NULL,
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE due_group_id = '[object Object]'
        OR due_group_id = 'undefined'
        OR due_group_id = 'null'`,
  );

  // Restore due status when due-chain fields exist (root dues only).
  const dueFix = await db.runAsync(
    `UPDATE transactions
     SET payment_status = 'due',
         due_remaining = COALESCE(
           CASE WHEN due_remaining IS NOT NULL THEN due_remaining END,
           amount
         ),
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE deleted_at IS NULL
       AND payment_status != 'due'
       AND (parent_due_id IS NULL OR parent_due_id = '')
       AND (
         (due_remaining IS NOT NULL AND due_remaining > 0)
         OR (
           due_group_id IS NOT NULL AND due_group_id != ''
           AND (due_remaining IS NULL OR due_remaining > 0 OR due_settled_at IS NOT NULL)
         )
       )`,
  );

  // Fill missing remaining on already-due roots.
  await db.runAsync(
    `UPDATE transactions
     SET due_remaining = amount,
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE deleted_at IS NULL
       AND payment_status = 'due'
       AND (parent_due_id IS NULL OR parent_due_id = '')
       AND due_remaining IS NULL`,
  );

  // Canonical loan category types by English name.
  const catFixes = [
    `UPDATE categories SET type = 'loan_out', flow = 'debit'
      WHERE deleted_at IS NULL AND (
        name = 'Loan Given' OR name LIKE '%Loan Given%'
      ) AND type != 'loan_out'`,
    `UPDATE categories SET type = 'loan_in', flow = 'credit'
      WHERE deleted_at IS NULL AND (
        name = 'Loan Received' OR name LIKE '%Loan Received%'
      ) AND type != 'loan_in'`,
    `UPDATE categories SET type = 'loan_in', flow = 'debit'
      WHERE deleted_at IS NULL AND (
        name = 'Loan Repayment Paid' OR name LIKE '%Repayment Paid%'
      ) AND type != 'loan_in'`,
    `UPDATE categories SET type = 'loan_out', flow = 'credit'
      WHERE deleted_at IS NULL AND (
        name = 'Loan Repayment Received' OR name LIKE '%Repayment Received%'
      ) AND type != 'loan_out'`,
  ] as const;

  let categoriesFixed = 0;
  for (const sql of catFixes) {
    const r = await db.runAsync(sql);
    categoriesFixed += Number(r.changes ?? 0);
  }

  const duesFixed = Number(dueFix.changes ?? 0);
  const parentsCleared =
    Number(parentClear.changes ?? 0) + Number(groupClear.changes ?? 0);

  if (duesFixed > 0 || categoriesFixed > 0 || parentsCleared > 0) {
    await recalculateBalances(db, { allOrganizations: true });
  }

  return { duesFixed, categoriesFixed, parentsCleared };
}

/** Idempotent gate — runs repair once per LEDGER_REPAIR_VERSION. */
export async function ensureLocalLedgerRepaired(db: Db): Promise<void> {
  const done = await getMeta(db, META_KEYS.LEDGER_REPAIR_VERSION);
  if (done === LEDGER_REPAIR_VERSION) return;
  await repairLocalLedgerSemantics(db);
  await setMeta(db, META_KEYS.LEDGER_REPAIR_VERSION, LEDGER_REPAIR_VERSION);
}
