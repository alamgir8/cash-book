import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * StockMovement records every inventory change for full audit trail.
 * Created automatically when invoices are created/cancelled,
 * or manually via stock adjustment.
 */

const MOVEMENT_TYPES = [
  "purchase", // stock in — from purchase invoice
  "sale", // stock out — from sale invoice
  "purchase_return", // stock out — purchase return/credit note
  "sale_return", // stock in — sale return
  "adjustment_in", // manual stock increase
  "adjustment_out", // manual stock decrease
  "opening_stock", // initial stock entry
];

const stockMovementSchema = new Schema(
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
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: MOVEMENT_TYPES,
      required: true,
      index: true,
    },
    // Positive = stock in, negative = stock out
    quantity: {
      type: Number,
      required: true,
    },
    unit_cost: {
      type: Number,
      default: 0,
    },
    // Stock level after this movement
    stock_after: {
      type: Number,
      required: true,
    },
    // Reference to invoice or manual note
    invoice: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      index: true,
    },
    party: {
      type: Schema.Types.ObjectId,
      ref: "Party",
    },
    notes: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true },
);

stockMovementSchema.index({ product: 1, date: -1 });
stockMovementSchema.index({ admin: 1, product: 1, date: -1 });
stockMovementSchema.index({ organization: 1, product: 1, date: -1 });
stockMovementSchema.index({ invoice: 1, product: 1 });

export const StockMovement = mongoose.model(
  "StockMovement",
  stockMovementSchema,
  "stock_movements",
);

export const STOCK_MOVEMENT_TYPE_OPTIONS = MOVEMENT_TYPES;
