import {
  isCloudSyncEnabled,
  isLocalFirstEnabled,
} from "./flags";
import { computeUseLocalPersonalLedger } from "./ledger-scope-pure";

export { computeUseLocalPersonalLedger };

/**
 * Offline-first ledger when local-first is enabled (personal or organization).
 * Cloud sync only pushes/pulls in the background — it never owns the UI read path.
 */
export function shouldUseLocalPersonalLedger(
  organizationId?: string | null,
): boolean {
  return computeUseLocalPersonalLedger(
    isLocalFirstEnabled(),
    isCloudSyncEnabled(),
    organizationId,
  );
}

/** @deprecated org books are stored locally too — no warning needed */
export function shouldWarnOrgCloudUnavailable(
  _organizationId?: string | null,
): boolean {
  return false;
}
