import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Product represents an item in a shop's catalog.
 * Tracks purchase price, sale price, current stock, and attachments.
 */

const PRODUCT_UNITS = [
  "pcs",
  "kg",
  "g",
  "mg",
  "liter",
  "ml",
  "meter",
  "cm",
  "mm",
  "box",
  "pack",
  "dozen",
  "pair",
  "set",
  "bag",
  "roll",
  "sheet",
  "bottle",
  "can",
  "carton",
  "ft",
  "inch",
  "yard",
];

const productSchema = new Schema(
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Stock Keeping Unit — unique per org/admin scope
    sku: {
      type: String,
      trim: true,
      uppercase: true,
    },
    // Barcode (EAN-13, QR, custom, etc.)
    barcode: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category_id: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      index: true,
    },
    unit: {
      type: String,
      enum: PRODUCT_UNITS,
      default: "pcs",
    },
    // Pricing
    purchase_price: {
      type: Number,
      default: 0,
      min: 0,
    },
    sale_price: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Tax rate applied on sale (percent)
    tax_rate: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Inventory
    current_stock: {
      type: Number,
      default: 0,
    },
    opening_stock: {
      type: Number,
      default: 0,
    },
    low_stock_threshold: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Product images
    images: [
      {
        url: { type: String, required: true },
        thumbnail_url: { type: String },
        file_name: { type: String, trim: true },
        storage_key: { type: String, trim: true },
        is_primary: { type: Boolean, default: false },
        uploaded_at: { type: Date, default: () => new Date() },
      },
    ],
    // Additional custom fields
    meta_data: {
      type: Schema.Types.Mixed,
    },
    // Flags
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    track_inventory: {
      type: Boolean,
      default: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deleted_at: { type: Date },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    updated_by: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    // Aggregated stats (updated on stock movement)
    total_sold: { type: Number, default: 0 },
    total_purchased: { type: Number, default: 0 },
    last_purchase_date: { type: Date },
    last_sale_date: { type: Date },
  },
  { timestamps: true },
);

// ── Indexes ────────────────────────────────────────────────────────────────
productSchema.index({ admin: 1, is_deleted: 1, is_active: 1 });
productSchema.index({ organization: 1, is_deleted: 1, is_active: 1 });
productSchema.index({ admin: 1, sku: 1 }, { sparse: true });
productSchema.index({ organization: 1, sku: 1 }, { sparse: true });
productSchema.index({ barcode: 1 }, { sparse: true });
productSchema.index({
  name: "text",
  sku: "text",
  barcode: "text",
  description: "text",
});

// Unique SKU within scope
productSchema.index(
  { admin: 1, sku: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      sku: { $type: "string", $ne: "" },
      organization: { $exists: false },
    },
  },
);
productSchema.index(
  { organization: 1, sku: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { sku: { $type: "string", $ne: "" } },
  },
);

// ── Virtuals ───────────────────────────────────────────────────────────────
productSchema.virtual("is_low_stock").get(function () {
  return (
    this.track_inventory &&
    this.low_stock_threshold > 0 &&
    this.current_stock <= this.low_stock_threshold
  );
});

productSchema.virtual("profit_margin").get(function () {
  if (!this.sale_price || this.sale_price === 0) return 0;
  return (
    ((this.sale_price - this.purchase_price) / this.sale_price) *
    100
  ).toFixed(2);
});

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

// ── Pre-save: auto-generate SKU ────────────────────────────────────────────
productSchema.pre("validate", function (next) {
  if (!this.sku && this.name) {
    const namePart = this.name
      .substring(0, 4)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "X");
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.sku = `${namePart}${randomPart}`;
  }
  // Set opening stock to current_stock on new doc
  if (this.isNew && this.opening_stock === 0 && this.current_stock !== 0) {
    this.opening_stock = this.current_stock;
  }
  next();
});

export const Product = mongoose.model("Product", productSchema, "products");
export const PRODUCT_UNIT_OPTIONS = PRODUCT_UNITS;
