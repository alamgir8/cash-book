import mongoose from "mongoose";

const { Schema } = mongoose;

const CATEGORY_DEFINITIONS = {
  income: "credit",
  sell: "credit",
  loan_in: "credit",
  donation_in: "credit",
  other_income: "credit",
  expense: "debit",
  purchase: "debit",
  loan_out: "debit",
  donation_out: "debit",
  salary: "debit",
  other_expense: "debit",
};

const CATEGORY_TYPES = Object.keys(CATEGORY_DEFINITIONS);
const CATEGORY_FLOW = ["credit", "debit"];

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
    flow: {
      type: String,
      enum: CATEGORY_FLOW,
      required: true,
      default: function () {
        return CATEGORY_DEFINITIONS[this.type];
      },
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

categorySchema.pre("validate", function (next) {
  if (this.type) {
    const expectedFlow = CATEGORY_DEFINITIONS[this.type];
    if (!expectedFlow) {
      return next(
        new Error(`Unsupported category type provided: ${this.type}`)
      );
    }
    this.flow = expectedFlow;
  }
  return next();
});

export const Category = mongoose.model("Category", categorySchema, "categories");
export const CATEGORY_TYPE_OPTIONS = CATEGORY_TYPES;
export const CATEGORY_FLOW_OPTIONS = CATEGORY_FLOW;
export const CATEGORY_FLOW_MAP = CATEGORY_DEFINITIONS;
