import { Router } from "express";
import { z } from "zod";
import {
  exportBackup,
  importBackup,
} from "../controllers/backup.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

// Minimal validation - just check structure exists, let controller handle the rest
const importSchema = z.object({
  body: z
    .object({
      version: z.string(),
      data: z
        .object({
          accounts: z.array(z.record(z.any())),
          categories: z.array(z.record(z.any())),
          transactions: z.array(z.record(z.any())),
          transfers: z.array(z.record(z.any())).optional().default([]),
          balanceSnapshots: z.array(z.record(z.any())).optional().default([]),
        })
        .passthrough(),
    })
    .passthrough(),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

router.use(authenticate);

router.get("/export", exportBackup);
router.post("/import", validate(importSchema), importBackup);

export default router;
