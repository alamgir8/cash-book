import mongoose from "mongoose";

const { Schema } = mongoose;

const transferSchema = new Schema(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    from_account: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    to_account: {
      type: Schema.Types.ObjectId,
      ref: "Account",
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
    meta_data: {
      type: Schema.Types.Mixed,
    },
    debit_transaction: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
    },
    credit_transaction: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
    },
    client_request_id: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

transferSchema.index(
  { admin: 1, client_request_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      client_request_id: { $type: "string", $ne: "" },
    },
  }
);

export const Transfer = mongoose.model("Transfer", transferSchema, "transfers");
