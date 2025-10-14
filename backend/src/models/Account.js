import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // type: {
    //   type: String,
    //   enum: ["debit", "credit"],
    //   required: true,
    // },
    description: {
      type: String,
      trim: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

accountSchema.index({ admin: 1, name: 1 }, { unique: true });

export const Account = mongoose.model("Account", accountSchema);
