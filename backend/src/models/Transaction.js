import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    type: {
      type: String,
      enum: ["debit", "credit"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    comment: {
      type: String,
      trim: true,
    },

    balance_after_transaction: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ admin: 1, account: 1, date: -1 });

export const Transaction = mongoose.model("Transaction", transactionSchema);
