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
  { _id: false },
);

const securitySchema = new mongoose.Schema(
  {
    password_updated_at: {
      type: Date,
    },
    // Hashed 6-digit login PIN
    login_pin_hash: {
      type: String,
    },
    pin_updated_at: {
      type: Date,
    },
    // Brute-force protection for PIN login
    pin_attempts: {
      type: Number,
      default: 0,
    },
    pin_locked_until: {
      type: Date,
    },
  },
  { _id: false },
);

// Trusted device record
const trustedDeviceSchema = new mongoose.Schema(
  {
    device_id: { type: String, required: true }, // stable device fingerprint
    device_name: { type: String, trim: true }, // e.g. "iPhone 15 Pro"
    platform: { type: String, enum: ["ios", "android", "web"] },
    trusted_at: { type: Date, default: () => new Date() },
    last_used_at: { type: Date, default: () => new Date() },
    revoked: { type: Boolean, default: false },
    revoked_at: { type: Date },
  },
  { _id: true },
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
    // Devices that have successfully completed first-login
    trusted_devices: {
      type: [trustedDeviceSchema],
      default: () => [],
    },
  },
  { timestamps: true },
);

adminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password_hash;
  if (obj.security) {
    const hasPin = Boolean(obj.security.login_pin_hash);
    obj.security = {
      has_login_pin: hasPin,
      pin_updated_at: obj.security.pin_updated_at,
      pin_locked_until: obj.security.pin_locked_until,
    };
  }
  // Strip device secrets from general responses
  if (obj.trusted_devices) {
    obj.trusted_devices = obj.trusted_devices.map((d) => ({
      device_id: d.device_id,
      device_name: d.device_name,
      platform: d.platform,
      trusted_at: d.trusted_at,
      last_used_at: d.last_used_at,
      revoked: d.revoked,
    }));
  }
  return obj;
};

export const Admin = mongoose.model("Admin", adminSchema);

export const ADMIN_LANGUAGE_OPTIONS = languageEnum;
export const ADMIN_CURRENCY_OPTIONS = currencyEnum;
export const ADMIN_LOCALE_OPTIONS = localeEnum;
