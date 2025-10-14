import crypto from "crypto";
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_TOKEN_TTL_DAYS = Number(
  process.env.JWT_REFRESH_TTL_DAYS || 30
);

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
  const token = rawBytes.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const token_hash = hashToken(token);
  const expires_at = new Date(
    Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  );

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
