import mongoose from "mongoose";

const importItemSchema = new mongoose.Schema(
  {
    row_index: { type: Number, required: true },
    date: { type: Date },
    description: { type: String, trim: true },
    counterparty: { type: String, trim: true },
    amount: { type: Number },
    type: { type: String, enum: ["debit", "credit"] },

    // Account name detected from header column (for ledger format)
    account_name: { type: String, trim: true },
    notes: { type: String, trim: true },

    // Resolved references (set after mapping)
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    party: { type: mongoose.Schema.Types.ObjectId, ref: "Party" },

    // Raw parsed values (for display)
    raw_date: { type: String },
    raw_amount: { type: String },
    raw_description: { type: String },
    raw_counterparty: { type: String },
    raw_type: { type: String },
    raw_notes: { type: String },

    // Import status per row
    status: {
      type: String,
      enum: ["pending", "imported", "skipped", "failed"],
      default: "pending",
    },
    error_message: { type: String },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
  },
  { _id: true },
);

const columnMappingSchema = new mongoose.Schema(
  {
    date: { type: String },
    description: { type: String },
    counterparty: { type: String },
    debit: { type: String },
    credit: { type: String },
    amount: { type: String },
    type: { type: String },
    balance: { type: String },
  },
  { _id: false },
);

const importSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    // File metadata
    original_filename: { type: String, required: true },
    file_type: {
      type: String,
      enum: ["pdf", "xlsx", "xls", "csv"],
      required: true,
    },
    file_size: { type: Number },

    // Default account for all items (can be overridden per item)
    default_account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
    },

    // Import mode: 'standard' (one row = one transaction) or 'ledger' (headers = accounts, one row = multiple transactions)
    import_mode: {
      type: String,
      enum: ["standard", "ledger"],
      default: "standard",
    },

    // Column mapping (how file columns map to transaction fields)
    column_mapping: columnMappingSchema,

    // For ledger mode: which columns are account columns (header name → account id)
    account_columns: [
      {
        column_name: { type: String },
        account_id: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
        _id: false,
      },
    ],

    // Detected columns from the file
    detected_columns: [{ type: String }],

    // All parsed rows
    items: [importItemSchema],

    // Overall status
    status: {
      type: String,
      enum: [
        "parsing",
        "parsed",
        "mapping",
        "importing",
        "completed",
        "failed",
        "cancelled",
      ],
      default: "parsing",
    },

    // Stats
    total_rows: { type: Number, default: 0 },
    imported_count: { type: Number, default: 0 },
    skipped_count: { type: Number, default: 0 },
    failed_count: { type: Number, default: 0 },

    // Totals
    total_debit: { type: Number, default: 0 },
    total_credit: { type: Number, default: 0 },

    // Error info
    error_message: { type: String },

    // Parser metadata
    parser_metadata: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
  },
);

// Indexes
importSchema.index({ admin: 1, createdAt: -1 });
importSchema.index({ organization: 1, createdAt: -1 });
importSchema.index({ status: 1 });

export const Import = mongoose.model("Import", importSchema);
