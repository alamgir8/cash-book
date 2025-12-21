import mongoose from "mongoose";

const ACCOUNT_KINDS = ["cash", "bank", "wallet", "mobile_wallet", "other"];

const accountSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    kind: {
      type: String,
      enum: ACCOUNT_KINDS,
      default: "cash",
    },
    opening_balance: {
      type: Number,
      default: 0,
    },
    current_balance: {
      type: Number,
      default: 0,
    },
    currency_code: {
      type: String,
      trim: true,
    },
    currency_symbol: {
      type: String,
      trim: true,
    },
    archived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archived_at: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Updated index to support both personal and organization accounts
accountSchema.index(
  { admin: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { organization: { $exists: false } },
  }
);
accountSchema.index(
  { organization: 1, name: 1 },
  { unique: true, partialFilterExpression: { organization: { $exists: true } } }
);
accountSchema.index({ organization: 1, admin: 1 });

export const Account = mongoose.model("Account", accountSchema, "accounts");
export const ACCOUNT_KIND_OPTIONS = ACCOUNT_KINDS;
