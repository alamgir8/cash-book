import { AuditLog } from "../models/AuditLog.js";

/**
 * Record a financial audit log entry (fire-and-forget, non-blocking).
 * Never throws — audit failures must never break the main operation.
 */
export const recordAudit = ({
  actor,
  organization,
  action,
  resource_type,
  resource_id,
  before,
  after,
  changes,
  ip_address,
  user_agent,
  status = "success",
  error_message,
}) => {
  // Fire and forget — do not await
  AuditLog.create({
    actor,
    organization,
    action,
    resource_type,
    resource_id,
    before,
    after,
    changes,
    ip_address,
    user_agent,
    status,
    error_message,
  }).catch((err) => {
    console.error("[AuditLog] Failed to write audit entry:", err.message);
  });
};

/**
 * Extract a concise diff between before/after objects for audit.changes field.
 */
export const computeChanges = (before, after) => {
  if (!before || !after) return null;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = {};
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { from: before[key], to: after[key] };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
};
