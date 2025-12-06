import { Router } from "express";
import { z } from "zod";
import {
  exportBackup,
  importBackup,
} from "../controllers/backup.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const importSchema = z.object({
  body: z.object({
    version: z.string(),
    data: z.object({
      accounts: z.array(
        z.object({
          _originalId: z.string(),
          name: z.string(),
          type: z.string().optional(),
          balance: z.number().optional(),
          color: z.string().optional(),
          icon: z.string().optional(),
          description: z.string().optional(),
          archived: z.boolean().optional(),
        })
      ),
      categories: z.array(
        z.object({
          _originalId: z.string(),
          name: z.string(),
          type: z.string(),
          flow: z.enum(["credit", "debit"]).optional(),
          color: z.string().optional(),
          description: z.string().optional(),
          archived: z.boolean().optional(),
        })
      ),
      transactions: z.array(
        z.object({
          _originalId: z.string().optional(),
          _originalAccountId: z.string(),
          _originalCategoryId: z.string().optional(),
          amount: z.number(),
          flow: z.enum(["credit", "debit"]),
          date: z.string(),
          description: z.string().optional(),
          keyword: z.string().optional(),
          counterparty: z.string().optional(),
          meta_data: z.any().optional(),
        })
      ),
      transfers: z
        .array(
          z.object({
            _originalId: z.string().optional(),
            _originalFromAccountId: z.string(),
            _originalToAccountId: z.string(),
            amount: z.number(),
            date: z.string(),
            description: z.string().optional(),
            keyword: z.string().optional(),
            counterparty: z.string().optional(),
            meta_data: z.any().optional(),
          })
        )
        .optional(),
      balanceSnapshots: z
        .array(
          z.object({
            _originalId: z.string().optional(),
            _originalAccountId: z.string(),
            balance: z.number(),
            date: z.string(),
          })
        )
        .optional(),
    }),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

router.use(authenticate);

router.get("/export", exportBackup);
router.post("/import", validate(importSchema), importBackup);

export default router;
