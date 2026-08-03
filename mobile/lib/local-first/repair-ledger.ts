import type { Db } from "@/db/client";
import { recalculateBalances } from "@/db/balances";
import { getMeta, META_KEYS, setMeta } from "@/db/meta";

/** Bump when repair SQL/rules change so existing devices re-apply. */
export const LEDGER_REPAIR_VERSION = "5";

/**
 * Fix common migrate/restore damage:
 * - Previous aggressive repair wrongly marked paid/settled txns as "due"
 * - Loan categories with wrong/missing type so chips/badges break
 * - Bad parent_due_id from object→string coercion
 * Then recalc account cash balances (paid only).
 */
export async function repairLocalLedgerSemantics(db: Db): Promise<{
  duesFixed: number;
  categoriesFixed: number;
  revertedToPaid: number;
}> {
  // ─── Step 1: Revert damage from previous over-aggressive repair ───
  // Settled dues (due_settled_at set) should be "paid" — they were fully repaid.
  const revertSettled = await db.runAsync(
    `UPDATE transactions
     SET payment_status = 'paid',
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE deleted_at IS NULL
       AND payment_status = 'due'
       AND due_settled_at IS NOT NULL`,
  );

  // Transactions with due_remaining = 0 (or negative) are fully paid.
  const revertZero = await db.runAsync(
    `UPDATE transactions
     SET payment_status = 'paid',
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE deleted_at IS NULL
       AND payment_status = 'due'
       AND due_remaining IS NOT NULL
       AND CAST(due_remaining AS REAL) <= 0
       AND due_settled_at IS NOT NULL`,
  );

  // Payments against a due are always "paid" (they have parent_due_id).
  const revertPayments = await db.runAsync(
    `UPDATE transactions
     SET payment_status = 'paid',
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE deleted_at IS NULL
       AND payment_status = 'due'
       AND parent_due_id IS NOT NULL
       AND parent_due_id != ''`,
  );

  // ─── Step 2: Clean broken object-string coercions ───
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

  // ─── Step 3: Restore due status ONLY for clear root dues ───
  // Conditions: has due_remaining > 0, NOT settled, NOT a child payment.
  const dueFix = await db.runAsync(
    `UPDATE transactions
     SET payment_status = 'due',
         updated_at = COALESCE(updated_at, datetime('now'))
     WHERE deleted_at IS NULL
       AND payment_status != 'due'
       AND (parent_due_id IS NULL OR parent_due_id = '')
       AND due_remaining IS NOT NULL
       AND CAST(due_remaining AS REAL) > 0
       AND (due_settled_at IS NULL OR due_settled_at = '')`,
  );

  // ─── Step 4: Canonical loan category types ───
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
  const revertedToPaid =
    Number(revertSettled.changes ?? 0) +
    Number(revertZero.changes ?? 0) +
    Number(revertPayments.changes ?? 0);

  // Always recalc after repair to ensure balances match current payment_status.
  await recalculateBalances(db, { allOrganizations: true });

  return { duesFixed, categoriesFixed, revertedToPaid };
}

/** Idempotent gate — runs repair once per LEDGER_REPAIR_VERSION. */
export async function ensureLocalLedgerRepaired(db: Db): Promise<void> {
  const done = await getMeta(db, META_KEYS.LEDGER_REPAIR_VERSION);
  if (done === LEDGER_REPAIR_VERSION) return;
  await repairLocalLedgerSemantics(db);
  await setMeta(db, META_KEYS.LEDGER_REPAIR_VERSION, LEDGER_REPAIR_VERSION);
}
