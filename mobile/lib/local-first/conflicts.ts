/**
 * Last-write-wins conflict policy (Mode B) — pure, testable.
 */

export type ConflictRow = {
  id: string;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
};

export type ConflictDecision =
  | { winner: "incoming"; reason: string }
  | { winner: "existing"; reason: string };

/**
 * Decide whether incoming change should replace existing local/server row.
 */
export function resolveLastWriteWins(
  existing: ConflictRow,
  incoming: ConflictRow,
): ConflictDecision {
  const existingTs = Date.parse(existing.updated_at) || 0;
  const incomingTs = Date.parse(incoming.updated_at) || 0;

  if (incomingTs > existingTs) {
    return { winner: "incoming", reason: "newer_updated_at" };
  }
  if (incomingTs < existingTs) {
    return { winner: "existing", reason: "existing_newer_updated_at" };
  }

  // Equal timestamps: deterministic by device_id
  if (incoming.device_id > existing.device_id) {
    return { winner: "incoming", reason: "equal_ts_higher_device_id" };
  }
  if (incoming.device_id < existing.device_id) {
    return { winner: "existing", reason: "equal_ts_higher_device_id" };
  }

  // Identical device + ts: prefer delete if one side deleted
  if (incoming.deleted_at && !existing.deleted_at) {
    return { winner: "incoming", reason: "equal_prefer_delete" };
  }
  if (existing.deleted_at && !incoming.deleted_at) {
    return { winner: "existing", reason: "equal_prefer_delete" };
  }

  return { winner: "existing", reason: "identical_keep_existing" };
}
