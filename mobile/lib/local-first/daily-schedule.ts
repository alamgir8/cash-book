/**
 * Pure schedule helpers for daily cloud sync (no React Native imports).
 *
 * Slots are local-clock hours. Each is attempted at most once per local day;
 * the next calendar day resets. Manual Sync never participates in this ledger.
 */

export const DAILY_SYNC_HOURS = [8, 14, 20] as const;

/**
 * Next scheduled hour that is due now and not yet attempted today.
 * Missed earlier hours (app was closed) become due when the app opens later.
 */
export function nextDueSyncHour(
  now: Date,
  doneHours: number[],
  hours: readonly number[] = DAILY_SYNC_HOURS,
): number | null {
  const h = now.getHours();
  const done = new Set(doneHours);
  for (const slot of hours) {
    if (slot <= h && !done.has(slot)) return slot;
  }
  return null;
}
