/**
 * Shared ledger classification rules.
 *
 * Kept dependency-free (no DB, no React) so the same rule can be expressed as
 * SQL for the database and as a plain predicate for in-memory page filtering.
 * Those two used to drift, which is what made chip counts disagree with the
 * visible rows.
 */

/** Anything with a `transfer_id` is one leg of an account-to-account transfer. */
export type TransferLegLike = { transfer_id?: string | null };

/** A due row is "settled" once it has been fully paid off. */
export type DueLike = {
  payment_status?: string | null;
  /**
   * A raw local id, but `Transaction.parent_due_id` is hydrated into an object
   * before reaching the UI — hence `unknown`. Only truthiness is used.
   */
  parent_due_id?: unknown;
  due_remaining?: number | null;
  due_settled_at?: string | null;
  amount?: number | null;
};

/**
 * SQL fragment that keeps only NON-transfer rows.
 *
 * Transfers are not income or expense — they are your own money moving between
 * your own accounts. `createTransfer` writes two ordinary transaction legs (a
 * debit out of the source and a credit into the destination), so any aggregate
 * that sums `credit`/`debit` without this filter counts a transfer as BOTH new
 * income and new expense. The net (`credit − debit`) is unaffected because the
 * legs cancel, which is why the balance looked right while the cards did not.
 */
export const NON_TRANSFER_SQL = "(transfer_id IS NULL OR transfer_id = '')";

/** JS twin of {@link NON_TRANSFER_SQL}, for page-level filtering. */
export const isTransferLeg = (row: TransferLegLike): boolean =>
  Boolean(row?.transfer_id);

/**
 * A due root that has been fully paid off.
 *
 * Settled dues deliberately keep `payment_status = 'due'` (see
 * `repair-ledger.ts`): the status records how the row was created, while
 * `due_remaining`/`due_settled_at` record whether it is still outstanding.
 *
 * The consequence was that a settled due matched neither status chip — the Due
 * chip requires `remaining > 0`, and the Paid chip required
 * `payment_status = 'paid'`. It became reachable only under All. Treating it as
 * paid is the semantically correct reading, since the money has moved.
 */
export const SETTLED_DUE_SQL = `(
          payment_status = 'due'
          AND (parent_due_id IS NULL OR parent_due_id = '')
          AND (
            (due_settled_at IS NOT NULL AND due_settled_at != '')
            OR CAST(COALESCE(due_remaining, amount) AS REAL) <= 0
          )
        )`;

/** Rows that should count as paid on the Paid chip: explicit paid rows plus settled dues. */
export const PAID_CHIP_SQL = `(payment_status = 'paid' OR payment_status IS NULL OR payment_status = '' OR ${SETTLED_DUE_SQL})`;

/**
 * Rows that actually moved cash.
 *
 * Deliberately stricter than {@link PAID_CHIP_SQL}: a settled due must NOT count
 * here. It stays `payment_status = 'due'` by design, and its cash already moved
 * through the paid child row — counting it again would double the amount.
 *
 * {@link PAID_CHIP_SQL} answers "which rows should the Paid chip show"; this
 * answers "which rows moved money". Do not swap them.
 *
 * This is the rule that feeds every money calculation: account balances, the
 * party balance, the opening-balance plug and the migration sums. Getting it
 * wrong changes real balances, which is why the two names are kept far apart.
 */
export const CASH_PAID_SQL = "(payment_status = 'paid' OR payment_status IS NULL OR payment_status = '')";

/** JS twin of {@link SETTLED_DUE_SQL}. */
export const isSettledDue = (row: DueLike): boolean => {
  const status = row?.payment_status ?? "paid";
  if (status !== "due") return false;
  // Payment children are paid rows, never settled roots.
  if (row?.parent_due_id) return false;
  if (row?.due_settled_at) return true;
  const remaining = row?.due_remaining ?? row?.amount ?? 0;
  return !(Number(remaining) > 0);
};

/** JS twin of {@link PAID_CHIP_SQL}. */
export const isPaidLike = (row: DueLike): boolean => {
  const status = row?.payment_status ?? "paid";
  if (status === "paid" || status === "") return true;
  return isSettledDue(row);
};
