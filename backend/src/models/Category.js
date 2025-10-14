import mongoose from "mongoose";

const { Schema } = mongoose;

const CATEGORY_TYPES = [
  "income",
  "expense",
  "loan_in",
  "loan_out",
  "donation",
  "purchase",
  "sell",
  "salary",
  "other",
];

const categorySchema = new Schema(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: CATEGORY_TYPES,
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
    color: {
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
  { timestamps: true }
);

categorySchema.index(
  { admin: 1, type: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

export const Category = mongoose.model("Category", categorySchema, "categories");
export const CATEGORY_TYPE_OPTIONS = CATEGORY_TYPES;
