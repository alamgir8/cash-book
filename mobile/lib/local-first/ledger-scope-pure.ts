/**
 * When local-first is on, UI always reads SQLite (personal or org scope)
 * — never Mongo. Cloud sync only runs in the background.
 */
export function computeUseLocalPersonalLedger(
  localFirst: boolean,
  _cloudSync: boolean,
  _organizationId?: string | null,
): boolean {
  return localFirst;
}
