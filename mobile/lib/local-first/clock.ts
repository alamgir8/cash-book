/**
 * Clock skew helpers for sync (Phase 8).
 * Handshake server time is authoritative; clamp local timestamps that are
 * too far ahead so LWW does not permanently win with a wrong device clock.
 */

/** Allow 5 minutes of skew before clamping. */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

/** serverNow - deviceNow (ms). Positive ⇒ device is behind. */
let clockOffsetMs = 0;

export function getClockOffsetMs(): number {
  return clockOffsetMs;
}

export function applyServerTime(serverTimeIso: string): number {
  const serverMs = Date.parse(serverTimeIso);
  if (Number.isNaN(serverMs)) return clockOffsetMs;
  clockOffsetMs = serverMs - Date.now();
  return clockOffsetMs;
}

/** Wall clock adjusted toward last known server time. */
export function nowIsoClamped(): string {
  return new Date(Date.now() + clockOffsetMs).toISOString();
}

/**
 * If `iso` is more than MAX_CLOCK_SKEW_MS ahead of server (or adjusted now),
 * clamp it down to the server/reference instant.
 */
export function clampUpdatedAt(
  iso: string | null | undefined,
  serverTimeIso?: string,
): string {
  const fallback = serverTimeIso
    ? new Date(Date.parse(serverTimeIso) || Date.now()).toISOString()
    : nowIsoClamped();

  if (!iso) return fallback;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return fallback;

  const refMs = serverTimeIso
    ? Date.parse(serverTimeIso)
    : Date.now() + clockOffsetMs;
  if (Number.isNaN(refMs)) return iso;

  if (t - refMs > MAX_CLOCK_SKEW_MS) {
    return new Date(refMs).toISOString();
  }
  return iso;
}

/** Restore a previously persisted offset (or set in tests). */
export function setClockOffsetMs(ms: number) {
  clockOffsetMs = Number.isFinite(ms) ? ms : 0;
}
