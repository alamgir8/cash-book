import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Organization represents a business entity (shop, company, etc.)
 * Multiple users can belong to an organization with different roles
 */

const BUSINESS_TYPES = [
  "retail_shop",
  "wholesale",
  "restaurant",
  "grocery",
  "electronics",
  "clothing",
  "pharmacy",
  "hardware",
  "service",
  "manufacturing",
  "general",
  "other",
];

const addressSchema = new Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postal_code: { type: String, trim: true },
    country: { type: String, trim: true, default: "Bangladesh" },
  },
  { _id: false }
);

const settingsSchema = new Schema(
  {
    currency_code: {
      type: String,
      default: "BDT",
      trim: true,
    },
    currency_symbol: {
      type: String,
      default: "৳",
      trim: true,
    },
    locale: {
      type: String,
      default: "bn-BD",
    },
    date_format: {
      type: String,
      default: "DD/MM/YYYY",
    },
    financial_year_start: {
      type: Number, // Month (1-12)
      default: 1,
      min: 1,
      max: 12,
    },
    invoice_prefix: {
      type: String,
      default: "INV",
      trim: true,
    },
    invoice_next_number: {
      type: Number,
      default: 1,
    },
    allow_negative_balance: {
      type: Boolean,
      default: false,
    },
    require_counterparty: {
      type: Boolean,
      default: false,
    },
    auto_create_ledger: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const organizationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    business_type: {
      type: String,
      enum: BUSINESS_TYPES,
      default: "general",
    },
    description: {
      type: String,
      trim: true,
    },
    logo_url: {
      type: String,
      trim: true,
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
    website: {
      type: String,
      trim: true,
    },
    address: {
      type: addressSchema,
      default: () => ({}),
    },
    settings: {
      type: settingsSchema,
      default: () => ({}),
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "suspended", "archived"],
      default: "active",
      index: true,
    },
    member_count: {
      type: Number,
      default: 1,
    },
    archived_at: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Generate slug from name if not provided
organizationSchema.pre("validate", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 50);
    // Add random suffix to ensure uniqueness
    this.slug += "-" + Math.random().toString(36).substring(2, 8);
  }
  next();
});

// Indexes
organizationSchema.index({ owner: 1, status: 1 });
organizationSchema.index({ name: "text", description: "text" });

export const Organization = mongoose.model(
  "Organization",
  organizationSchema,
  "organizations"
);

export const BUSINESS_TYPE_OPTIONS = BUSINESS_TYPES;
