import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Immutable audit log for all financial operations.
 * Records are append-only — never updated or deleted.
 * Used for reconciliation, compliance, and debugging balance mismatches.
 */
const auditLogSchema = new Schema(
  {
    // Who performed the action
    actor: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    // What action was performed
    action: {
      type: String,
      required: true,
      enum: [
        "transaction.create",
        "transaction.update",
        "transaction.delete",
        "transaction.restore",
        "transfer.create",
        "transfer.update",
        "transfer.delete",
        "account.create",
        "account.update",
        "account.delete",
        "account.balance_recalculate",
        "balance.reconcile",
        "auth.login",
        "auth.logout",
        "auth.pin_set",
        "auth.pin_login",
      ],
      index: true,
    },
    // Resource type and ID
    resource_type: {
      type: String,
      enum: ["transaction", "transfer", "account", "admin"],
      index: true,
    },
    resource_id: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    // Snapshot of state before and after for reconciliation
    before: {
      type: Schema.Types.Mixed,
    },
    after: {
      type: Schema.Types.Mixed,
    },
    // Change summary for quick inspection
    changes: {
      type: Schema.Types.Mixed,
    },
    // Request metadata
    ip_address: String,
    user_agent: String,
    // Result
    status: {
      type: String,
      enum: ["success", "failure"],
      default: "success",
      index: true,
    },
    error_message: String,
  },
  {
    timestamps: true,
    // Prevent any document updates — audit logs are append-only
    strict: true,
  },
);

auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ organization: 1, createdAt: -1 });
auditLogSchema.index({ resource_type: 1, resource_id: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

// Block updates — audit logs must be immutable
auditLogSchema.pre("findOneAndUpdate", function () {
  throw new Error("AuditLog records are immutable and cannot be updated.");
});
auditLogSchema.pre("updateOne", function () {
  throw new Error("AuditLog records are immutable and cannot be updated.");
});
auditLogSchema.pre("updateMany", function () {
  throw new Error("AuditLog records are immutable and cannot be updated.");
});

export const AuditLog = mongoose.model(
  "AuditLog",
  auditLogSchema,
  "audit_logs",
);
