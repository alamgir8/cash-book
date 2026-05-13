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
    // Vendor / Seller — who you bought from or sold to (free text)
    vendor: {
      type: String,
      trim: true,
    },
    // payment_status: 'paid' = cash paid immediately; 'due' = recorded but not yet paid
    payment_status: {
      type: String,
      enum: ["paid", "due"],
      default: "paid",
      index: true,
    },
    // Optional due date when payment_status = 'due'
    due_date: {
      type: Date,
    },
    // ── Due / Credit chain linking ─────────────────────────────────────────
    // All transactions in the same due chain share this ID.
    // For the original "due" transaction it equals its own _id.
    // For each payment it equals the parent due transaction's _id.
    due_group_id: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      index: true,
    },
    // Payment transactions point back to the original "due" transaction
    parent_due_id: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      index: true,
    },
    // Remaining unpaid amount on the original "due" transaction (updated with each payment)
    due_remaining: {
      type: Number,
      min: 0,
    },
    // When the due transaction was fully settled (due_remaining reached 0)
    due_settled_at: {
      type: Date,
    },
    // ──────────────────────────────────────────────────────────────────────
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
    // Attachments — receipt/invoice images linked to this transaction
    attachments: [
      {
        url: { type: String, required: true },
        thumbnail_url: { type: String },
        file_name: { type: String, trim: true },
        file_size: { type: Number }, // bytes
        mime_type: { type: String, trim: true },
        storage_key: { type: String, trim: true }, // cloud storage object key
        uploaded_at: { type: Date, default: () => new Date() },
      },
    ],
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
  },
);

transactionSchema.index({ admin: 1, date: -1 });
transactionSchema.index({ admin: 1, account: 1, date: -1 });
transactionSchema.index({ admin: 1, type: 1, date: -1 });
transactionSchema.index({ admin: 1, category_id: 1, date: -1 });
transactionSchema.index({ admin: 1, is_deleted: 1, date: -1 }); // for filtered listing
transactionSchema.index({ admin: 1, counterparty: 1 }); // for counterparty aggregation
transactionSchema.index({ organization: 1, date: -1 });
transactionSchema.index({ organization: 1, account: 1, date: -1 });
transactionSchema.index({ organization: 1, party: 1, date: -1 });
transactionSchema.index({ organization: 1, invoice: 1 });
transactionSchema.index({ organization: 1, is_deleted: 1, date: -1 }); // for org filtered listing
transactionSchema.index({ party: 1, is_deleted: 1, date: -1 }); // for party ledger queries
transactionSchema.index(
  { admin: 1, client_request_id: 1, is_deleted: 1 },
  {
    unique: true,
    partialFilterExpression: {
      is_deleted: false,
      client_request_id: { $type: "string", $ne: "" },
    },
  },
);

transactionSchema.index({ admin: 1, payment_status: 1, date: -1 });
transactionSchema.index({ admin: 1, vendor: 1 });
transactionSchema.index({ admin: 1, due_group_id: 1, date: 1 }); // due chain queries
transactionSchema.index({ admin: 1, parent_due_id: 1 }); // payments by parent
transactionSchema.index({
  keyword: "text",
  description: "text",
  counterparty: "text",
  vendor: "text",
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
  "transactions",
);

export const TRANSACTION_TYPE_OPTIONS = TRANSACTION_TYPES;
export const TRANSACTION_TRANSFER_DIRECTION_OPTIONS = TRANSFER_DIRECTIONS;
