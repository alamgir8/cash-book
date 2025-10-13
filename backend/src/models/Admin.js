import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    settings: {
      currency: {
        type: String,
        enum: [
          "USD",
          "EUR",
          "GBP",
          "JPY",
          "CAD",
          "AUD",
          "CHF",
          "CNY",
          "INR",
          "BDT",
          "SAR",
          "AED",
        ],
        default: "USD",
      },
      language: {
        type: String,
        enum: [
          "en",
          "es",
          "fr",
          "de",
          "it",
          "pt",
          "ru",
          "zh",
          "ja",
          "ar",
          "hi",
          "bn",
        ],
        default: "en",
      },
      weekStartsOn: {
        type: Number,
        default: 1,
      },
    },
  },
  { timestamps: true }
);

adminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

export const Admin = mongoose.model("Admin", adminSchema);
