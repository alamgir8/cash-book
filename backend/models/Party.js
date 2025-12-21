import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Party represents a customer or supplier with their ledger balance
 * This is the unified model for both customers and suppliers
 */

const PARTY_TYPES = ["customer", "supplier", "both"];

const addressSchema = new Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postal_code: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false }
);

const partySchema = new Schema(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
      index: true,
    },
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: PARTY_TYPES,
      required: true,
      default: "customer",
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    address: {
      type: addressSchema,
      default: () => ({}),
    },
    // Opening balance - positive means they owe us (receivable), negative means we owe them (payable)
    opening_balance: {
      type: Number,
      default: 0,
    },
    // Current balance - updated with each transaction
    // For customers: positive = receivable (they owe us), negative = advance payment
    // For suppliers: positive = we owe them (payable), negative = advance payment to them
    current_balance: {
      type: Number,
      default: 0,
    },
    // Credit limit for this party
    credit_limit: {
      type: Number,
      default: 0,
    },
    // Payment terms in days
    payment_terms_days: {
      type: Number,
      default: 0,
    },
    // Tax identification number
    tax_id: {
      type: String,
      trim: true,
    },
    // Additional notes
    notes: {
      type: String,
      trim: true,
    },
    // Tags for categorization
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    // Metadata for custom fields
    meta_data: {
      type: Schema.Types.Mixed,
    },
    // Statistics
    total_transactions: {
      type: Number,
      default: 0,
    },
    total_invoices: {
      type: Number,
      default: 0,
    },
    last_transaction_at: {
      type: Date,
    },
    // Status
    archived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archived_at: {
      type: Date,
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
partySchema.index({ organization: 1, type: 1, archived: 1 });
partySchema.index({ organization: 1, name: 1 });
// partySchema.index({ organization: 1, code: 1 }, { sparse: true }); // Removed duplicate index
partySchema.index({ organization: 1, phone: 1 }, { sparse: true });
partySchema.index({ name: "text", phone: "text", email: "text", code: "text" });

// Unique constraint for code within organization
partySchema.index(
  { organization: 1, code: 1 },
  {
    unique: true,
    partialFilterExpression: { code: { $type: "string", $ne: "" } },
  }
);

// Virtual for display balance with direction
partySchema.virtual("balance_display").get(function () {
  if (this.type === "customer") {
    if (this.current_balance > 0) {
      return {
        amount: this.current_balance,
        direction: "receivable",
        label: "To Receive",
      };
    } else if (this.current_balance < 0) {
      return {
        amount: Math.abs(this.current_balance),
        direction: "advance",
        label: "Advance Paid",
      };
    }
  } else if (this.type === "supplier") {
    if (this.current_balance > 0) {
      return {
        amount: this.current_balance,
        direction: "payable",
        label: "To Pay",
      };
    } else if (this.current_balance < 0) {
      return {
        amount: Math.abs(this.current_balance),
        direction: "advance",
        label: "Advance Received",
      };
    }
  }
  return { amount: 0, direction: "settled", label: "Settled" };
});

// Ensure virtuals are included in JSON
partySchema.set("toJSON", { virtuals: true });
partySchema.set("toObject", { virtuals: true });

// Generate code if not provided
partySchema.pre("validate", function (next) {
  if (!this.code && this.name) {
    const prefix =
      this.type === "customer" ? "C" : this.type === "supplier" ? "S" : "P";
    const namePart = this.name
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z]/g, "X");
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.code = `${prefix}${namePart}${randomPart}`;
  }
  next();
});

// Initialize current_balance from opening_balance for new documents
partySchema.pre("save", function (next) {
  if (this.isNew && this.opening_balance !== 0 && this.current_balance === 0) {
    this.current_balance = this.opening_balance;
  }
  next();
});

export const Party = mongoose.model("Party", partySchema, "parties");

export const PARTY_TYPE_OPTIONS = PARTY_TYPES;
