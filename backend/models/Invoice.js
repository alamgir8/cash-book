import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Invoice represents sales or purchase invoices
 */

const INVOICE_TYPES = ["sale", "purchase"];
const INVOICE_STATUSES = [
  "draft",
  "pending",
  "partial",
  "paid",
  "overdue",
  "cancelled",
];

const invoiceItemSchema = new Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },
    unit: {
      type: String,
      trim: true,
      default: "pcs",
    },
    unit_price: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount_type: {
      type: String,
      enum: ["fixed", "percent"],
      default: "fixed",
    },
    tax_rate: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Calculated fields
    subtotal: {
      type: Number,
      default: 0,
    },
    discount_amount: {
      type: Number,
      default: 0,
    },
    tax_amount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    // Optional category for the item
    category_id: {
      type: Schema.Types.ObjectId,
      ref: "Category",
    },
    // Optional notes
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

// Calculate item totals before save
invoiceItemSchema.pre("validate", function (next) {
  this.subtotal = this.quantity * this.unit_price;

  if (this.discount_type === "percent") {
    this.discount_amount = (this.subtotal * this.discount) / 100;
  } else {
    this.discount_amount = this.discount;
  }

  const afterDiscount = this.subtotal - this.discount_amount;
  this.tax_amount = (afterDiscount * this.tax_rate) / 100;
  this.total = afterDiscount + this.tax_amount;

  next();
});

const paymentSchema = new Schema(
  {
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    method: {
      type: String,
      enum: ["cash", "bank", "mobile_wallet", "cheque", "other"],
      default: "cash",
    },
    account: {
      type: Schema.Types.ObjectId,
      ref: "Account",
    },
    transaction: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
    },
    reference: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    recorded_by: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { _id: true, timestamps: true }
);

const invoiceSchema = new Schema(
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
    // Invoice identification
    invoice_number: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: INVOICE_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: INVOICE_STATUSES,
      default: "draft",
      index: true,
    },
    // Party (customer/supplier)
    party: {
      type: Schema.Types.ObjectId,
      ref: "Party",
      index: true,
    },
    // For non-registered parties
    party_name: {
      type: String,
      trim: true,
    },
    party_phone: {
      type: String,
      trim: true,
    },
    party_address: {
      type: String,
      trim: true,
    },
    // Dates
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    due_date: {
      type: Date,
      index: true,
    },
    // Items
    items: [invoiceItemSchema],
    // Totals
    subtotal: {
      type: Number,
      default: 0,
    },
    total_discount: {
      type: Number,
      default: 0,
    },
    total_tax: {
      type: Number,
      default: 0,
    },
    // Additional charges/discounts at invoice level
    shipping_charge: {
      type: Number,
      default: 0,
    },
    adjustment: {
      type: Number,
      default: 0, // Can be positive or negative
    },
    adjustment_description: {
      type: String,
      trim: true,
    },
    // Final totals
    grand_total: {
      type: Number,
      default: 0,
    },
    amount_paid: {
      type: Number,
      default: 0,
    },
    balance_due: {
      type: Number,
      default: 0,
    },
    // Payments
    payments: [paymentSchema],
    // Notes
    notes: {
      type: String,
      trim: true,
    },
    terms: {
      type: String,
      trim: true,
    },
    // Internal notes (not shown on invoice)
    internal_notes: {
      type: String,
      trim: true,
    },
    // Metadata
    meta_data: {
      type: Schema.Types.Mixed,
    },
    // Linked transactions (for accounting)
    linked_transactions: [
      {
        type: Schema.Types.ObjectId,
        ref: "Transaction",
      },
    ],
    // Audit trail
    created_by: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    updated_by: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    cancelled_at: {
      type: Date,
    },
    cancelled_by: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    cancellation_reason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
invoiceSchema.index({ organization: 1, invoice_number: 1 }, { unique: true });
invoiceSchema.index({ organization: 1, type: 1, date: -1 });
invoiceSchema.index({ organization: 1, party: 1, date: -1 });
invoiceSchema.index({ organization: 1, status: 1, due_date: 1 });
invoiceSchema.index({ invoice_number: "text", party_name: "text" });

// Calculate totals before save
invoiceSchema.pre("save", function (next) {
  // Calculate from items
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  for (const item of this.items) {
    subtotal += item.subtotal || 0;
    totalDiscount += item.discount_amount || 0;
    totalTax += item.tax_amount || 0;
  }

  this.subtotal = subtotal;
  this.total_discount = totalDiscount;
  this.total_tax = totalTax;

  // Calculate grand total
  this.grand_total =
    subtotal -
    totalDiscount +
    totalTax +
    (this.shipping_charge || 0) +
    (this.adjustment || 0);

  // Calculate amount paid from payments
  this.amount_paid = this.payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Calculate balance due
  this.balance_due = this.grand_total - this.amount_paid;

  // Update status based on payment
  if (this.status !== "cancelled" && this.status !== "draft") {
    if (this.balance_due <= 0) {
      this.status = "paid";
    } else if (this.amount_paid > 0) {
      this.status = "partial";
    } else if (this.due_date && new Date(this.due_date) < new Date()) {
      this.status = "overdue";
    } else {
      this.status = "pending";
    }
  }

  next();
});

// Instance method to add payment
invoiceSchema.methods.addPayment = function (paymentData) {
  this.payments.push(paymentData);
  return this;
};

// Instance method to cancel invoice
invoiceSchema.methods.cancel = function (userId, reason) {
  this.status = "cancelled";
  this.cancelled_at = new Date();
  this.cancelled_by = userId;
  this.cancellation_reason = reason;
  return this;
};

// Static method to generate next invoice number
invoiceSchema.statics.generateInvoiceNumber = async function (
  organizationId,
  type
) {
  const Organization = mongoose.model("Organization");
  const org = await Organization.findById(organizationId);

  if (!org) {
    throw new Error("Organization not found");
  }

  const prefix = type === "sale" ? org.settings.invoice_prefix || "INV" : "PO";
  const nextNumber = org.settings.invoice_next_number || 1;
  const paddedNumber = String(nextNumber).padStart(6, "0");

  // Update the counter
  await Organization.findByIdAndUpdate(organizationId, {
    $inc: { "settings.invoice_next_number": 1 },
  });

  return `${prefix}-${paddedNumber}`;
};

export const Invoice = mongoose.model("Invoice", invoiceSchema, "invoices");

export const INVOICE_TYPE_OPTIONS = INVOICE_TYPES;
export const INVOICE_STATUS_OPTIONS = INVOICE_STATUSES;
