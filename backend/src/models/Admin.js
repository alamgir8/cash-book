import mongoose from "mongoose";

const localeEnum = [
  "en-US",
  "en-GB",
  "bn-BD",
  "hi-IN",
  "ar-SA",
  "ar-AE",
  "fr-FR",
  "es-ES",
  "de-DE",
  "it-IT",
  "pt-PT",
  "ru-RU",
  "ja-JP",
  "zh-CN",
];

const languageEnum = [
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
];

const currencyEnum = [
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
];

const profileSettingsSchema = new mongoose.Schema(
  {
    language: {
      type: String,
      enum: languageEnum,
      default: "en",
    },
    currency_code: {
      type: String,
      enum: currencyEnum,
      default: "USD",
    },
    currency_symbol: {
      type: String,
      default: "$",
    },
    locale: {
      type: String,
      enum: localeEnum,
      default: "en-US",
    },
    date_format: {
      type: String,
      default: "YYYY-MM-DD",
    },
    time_format: {
      type: String,
      enum: ["HH:mm", "hh:mm A"],
      default: "HH:mm",
    },
    week_starts_on: {
      type: Number,
      min: 0,
      max: 6,
      default: 1,
    },
  },
  { _id: false }
);

const securitySchema = new mongoose.Schema(
  {
    password_updated_at: {
      type: Date,
    },
  },
  { _id: false }
);

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
      index: true,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "disabled", "invited"],
      default: "active",
      index: true,
    },
    last_login_at: {
      type: Date,
    },
    profile_settings: {
      type: profileSettingsSchema,
      default: () => ({}),
    },
    security: {
      type: securitySchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

adminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password_hash;
  return obj;
};

export const Admin = mongoose.model("Admin", adminSchema);

export const ADMIN_LANGUAGE_OPTIONS = languageEnum;
export const ADMIN_CURRENCY_OPTIONS = currencyEnum;
export const ADMIN_LOCALE_OPTIONS = localeEnum;
