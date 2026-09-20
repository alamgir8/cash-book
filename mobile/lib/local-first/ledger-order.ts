/**
 * Canonical SQL ordering for ledger rows (`transactions`, and party ledgers).
 *
 * WHY THIS EXISTS
 * ---------------
 * The `date` column holds a **local calendar day** as `YYYY-MM-DD` — both date
 * pickers in the app are `mode="date"`, so there is no time-of-day to store.
 *
 * Ordering on that raw column was wrong in two ways:
 *
 *  1. Mixed formats. `createLocalTransfer` used to rewrite a date-only value to
 *     `YYYY-MM-DDT23:59:59.000Z` (an attempt to keep transfer legs off the bottom
 *     of a `DESC` page). Since these are plain string comparisons, that made a
 *     transfer sort as a *later* instant than every other row on the same day:
 *     it landed last in the chronological (`ASC`) running-balance trail, so its
 *     "Balance after" was computed after transactions the user entered later, and
 *     could read negative even though the transfer happened first.
 *
 *  2. No day-level ordering. `ORDER BY date` compared full strings, so a
 *     timestamped row could interleave with or jump ahead of the plain same-day
 *     rows it belongs with, and there was no stable tie-breaker to fall back on.
 *
 * THE RULE
 * --------
 * Order by **calendar day first** (`substr(date, 1, 10)`, which normalises both
 * `YYYY-MM-DD` and a full ISO timestamp without any timezone maths), then by
 * `created_at` — the order rows were actually entered — then by `id` so paging
 * with LIMIT/OFFSET can never duplicate or skip a row.
 *
 * ASC and DESC are exact mirrors of each other, and the two MUST stay that way:
 * `data/parties.local.ts` walks back through a DESC page to derive a running
 * balance, so a mismatch between the page order and the trail order silently
 * produces wrong balances.
 */

/** Calendar-day key of a `date` value. Handles `YYYY-MM-DD` and full ISO. */
export const SQL_LEDGER_DAY = "substr(date, 1, 10)";

/**
 * JS twin of {@link SQL_LEDGER_DAY}, for sorting rows already in memory.
 *
 * Exists so the PDF export and any in-memory walk group days exactly the way
 * SQLite does. Comparing full timestamps instead is what made a legacy
 * `2026-09-20T23:59:59.000Z` transfer sort behind its own same-day rows in the
 * exported PDF, the same way it did in the ledger.
 */
export const ledgerDayOf = (value?: string | null): string =>
  (value ?? "").slice(0, 10);

/** Newest day first, then most recently entered first. */
export const ORDER_LEDGER_NEWEST_FIRST =
  "ORDER BY substr(date, 1, 10) DESC, created_at DESC, id DESC";

/** Oldest day first, then entry order — the running-balance trail order. */
export const ORDER_LEDGER_OLDEST_FIRST =
  "ORDER BY substr(date, 1, 10) ASC, created_at ASC, id ASC";

/**
 * Normalise a user- or sync-supplied date to the canonical `YYYY-MM-DD` day.
 *
 * Takes the first 10 characters, which both drops a legacy
 * `T23:59:59.000Z`-style suffix and leaves an already-canonical day untouched.
 * Falls back to `todayLocalDay()` when the value is absent.
 */
export function toLedgerDay(
  value: string | null | undefined,
  todayLocalDay: () => string,
): string {
  const raw = value?.trim();
  if (!raw) return todayLocalDay();
  const day = raw.slice(0, 10);
  // Guard against garbage input (`"yesterday"`, `""`, partial dates).
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : todayLocalDay();
}
