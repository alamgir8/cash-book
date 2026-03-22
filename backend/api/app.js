import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import routes from "../routes/index.js";
import { errorHandler, notFoundHandler } from "../middleware/errorHandler.js";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Allowed origins for CORS — restrict in production.
 * Set CORS_ORIGINS as a comma-separated list of allowed origins,
 * e.g. "https://app.example.com,https://admin.example.com"
 */
const buildCorsOrigins = () => {
  const envOrigins = process.env.CORS_ORIGINS;
  if (envOrigins) {
    const list = envOrigins
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    return list.length > 0 ? list : true; // true = reflect request origin
  }
  // In development, allow all origins
  return isProduction ? false : true;
};

export const createApp = () => {
  const app = express();

  // Trust proxy (required for rate-limit behind load balancers / Vercel)
  app.set("trust proxy", 1);

  // ── Security ──────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: false, // API-only, no HTML to protect
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: buildCorsOrigins(),
      credentials: true,
      maxAge: 86400, // Cache preflight for 24 hours
    }),
  );

  // ── Body parsing with size limits ─────────────────────────
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  // ── Compression ───────────────────────────────────────────
  app.use(compression());

  // ── Logging ───────────────────────────────────────────────
  app.use(morgan(isProduction ? "combined" : "dev"));

  // ── Global rate limiter ───────────────────────────────────
  const globalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: isProduction ? 200 : 1000, // requests per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
  });
  app.use(globalLimiter);

  // ── Health check (no auth, no rate-limit) ─────────────────
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get("/", (_req, res) => {
    res.json({ status: "ok", version: "2.0" });
  });

  // ── API routes ────────────────────────────────────────────
  app.use("/api", routes);

  // ── Error handling ────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
