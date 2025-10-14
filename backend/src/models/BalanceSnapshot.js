import mongoose from "mongoose";

const { Schema } = mongoose;

const GRANULARITY_OPTIONS = ["day", "month"];

const balanceSnapshotSchema = new Schema(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    account: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    granularity: {
      type: String,
      enum: GRANULARITY_OPTIONS,
      required: true,
    },
    period_start: {
      type: Date,
      required: true,
    },
    debit_total: {
      type: Number,
      default: 0,
    },
    credit_total: {
      type: Number,
      default: 0,
    },
    closing_balance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

balanceSnapshotSchema.index(
  { admin: 1, account: 1, granularity: 1, period_start: 1 },
  { unique: true }
);

export const BalanceSnapshot = mongoose.model(
  "BalanceSnapshot",
  balanceSnapshotSchema,
  "balance_snapshots"
);
export const BALANCE_GRANULARITY_OPTIONS = GRANULARITY_OPTIONS;
