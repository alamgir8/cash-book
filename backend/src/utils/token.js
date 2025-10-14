import crypto from "crypto";
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_EXPIRES_IN || "15m";

const MIN_REFRESH_TTL_MS = 60 * 60 * 1000; // 1 hour

const resolveRefreshTtl = () => {
  if (process.env.JWT_REFRESH_TTL_MINUTES) {
    const minutes = Number(process.env.JWT_REFRESH_TTL_MINUTES);
    if (Number.isFinite(minutes) && minutes > 0) {
      return Math.max(minutes * 60 * 1000, MIN_REFRESH_TTL_MS);
    }
  }

  const days = Number(process.env.JWT_REFRESH_TTL_DAYS || 30);
  if (Number.isFinite(days) && days > 0) {
    return Math.max(days * 24 * 60 * 60 * 1000, MIN_REFRESH_TTL_MS);
  }

  return MIN_REFRESH_TTL_MS;
};

const REFRESH_TOKEN_TTL_MS = resolveRefreshTtl();
export const getRefreshTokenTtlMs = () => REFRESH_TOKEN_TTL_MS;

const createRefreshExpiryDate = () =>
  new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

export const createAccessToken = (payload, options = {}) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: options.expiresIn ?? ACCESS_TOKEN_TTL,
  });
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

export const generateRefreshToken = () => {
  const rawBytes = crypto.randomBytes(64).toString("base64");
  const token = rawBytes
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const token_hash = hashToken(token);
  const expires_at = createRefreshExpiryDate();

  return {
    token,
    token_hash,
    expires_at,
  };
};

export const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const createAuthToken = createAccessToken;
