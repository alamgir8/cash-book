import mongoose from "mongoose";

const { Schema } = mongoose;

const TRANSACTION_TYPES = ["debit", "credit"];
const TRANSFER_DIRECTIONS = ["outgoing", "incoming"];

const transactionSchema = new Schema(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
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
    category_id: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      index: true,
    },
    // Link to party (customer/supplier) ledger
    party: {
      type: Schema.Types.ObjectId,
      ref: "Party",
      index: true,
    },
    // Link to invoice if this transaction is a payment
    invoice: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      index: true,
    },
    type: {
      type: String,
      enum: TRANSACTION_TYPES,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    keyword: {
      type: String,
      trim: true,
    },
    counterparty: {
      type: String,
      trim: true,
    },
    meta_data: {
      type: Schema.Types.Mixed,
    },
    balance_after_transaction: {
      type: Number,
    },
    // Party balance after this transaction (for ledger)
    party_balance_after: {
      type: Number,
    },
    client_request_id: {
      type: String,
      trim: true,
    },
    transfer_id: {
      type: Schema.Types.ObjectId,
      ref: "Transfer",
      index: true,
    },
    transfer_direction: {
      type: String,
      enum: TRANSFER_DIRECTIONS,
      index: true,
    },
    // Who created this transaction
    created_by: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    is_deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deleted_at: {
      type: Date,
    },
    restored_at: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ admin: 1, date: -1 });
transactionSchema.index({ admin: 1, account: 1, date: -1 });
transactionSchema.index({ admin: 1, type: 1, date: -1 });
transactionSchema.index({ admin: 1, category_id: 1, date: -1 });
transactionSchema.index({ organization: 1, date: -1 });
transactionSchema.index({ organization: 1, account: 1, date: -1 });
transactionSchema.index({ organization: 1, party: 1, date: -1 });
transactionSchema.index({ organization: 1, invoice: 1 });
transactionSchema.index(
  { admin: 1, client_request_id: 1, is_deleted: 1 },
  {
    unique: true,
    partialFilterExpression: {
      is_deleted: false,
      client_request_id: { $type: "string", $ne: "" },
    },
  }
);

transactionSchema.index({
  keyword: "text",
  description: "text",
  counterparty: "text",
});

transactionSchema.methods.softDelete = function () {
  this.is_deleted = true;
  this.deleted_at = new Date();
};

transactionSchema.methods.restore = function () {
  this.is_deleted = false;
  this.restored_at = new Date();
  this.deleted_at = undefined;
};

export const Transaction = mongoose.model(
  "Transaction",
  transactionSchema,
  "transactions"
);

export const TRANSACTION_TYPE_OPTIONS = TRANSACTION_TYPES;
export const TRANSACTION_TRANSFER_DIRECTION_OPTIONS = TRANSFER_DIRECTIONS;
