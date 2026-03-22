import { Router } from "express";
import { z } from "zod";
import express from "express";
import rateLimit from "express-rate-limit";
import {
  exportBackup,
  importBackup,
} from "../controllers/backup.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

// Rate limit backup operations — expensive endpoints
const backupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 backup operations per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many backup operations. Try again later." },
});

// Minimal validation - just check structure exists, let controller handle the rest
const importSchema = z.object({
  body: z
    .object({
      version: z.string(),
      data: z
        .object({
          accounts: z.array(z.record(z.any())).max(10000),
          categories: z.array(z.record(z.any())).max(10000),
          transactions: z.array(z.record(z.any())).max(100000),
          transfers: z
            .array(z.record(z.any()))
            .max(100000)
            .optional()
            .default([]),
          balanceSnapshots: z
            .array(z.record(z.any()))
            .max(100000)
            .optional()
            .default([]),
        })
        .passthrough(),
    })
    .passthrough(),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

router.use(authenticate);

router.get("/export", backupLimiter, exportBackup);
// Allow larger body size for backup import — up to 50MB
router.post(
  "/import",
  backupLimiter,
  express.json({ limit: "50mb" }),
  validate(importSchema),
  importBackup,
);

export default router;
