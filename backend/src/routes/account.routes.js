import { Router } from "express";
import { z } from "zod";
import {
  listAccounts,
  createAccount,
  updateAccount,
  archiveAccount,
  getAccountSummary,
  getAccountDetail,
  getAccountTransactions,
} from "../controllers/account.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { ACCOUNT_KIND_OPTIONS } from "../models/Account.js";

const router = Router();

const listQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    include_archived: z.string().optional(),
    includeArchived: z.string().optional(),
  }),
});

const createSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    description: z.string().trim().max(512).optional(),
    kind: z.enum(ACCOUNT_KIND_OPTIONS).optional(),
    opening_balance: z.coerce.number().optional(),
    currency_code: z.string().trim().max(8).optional(),
    currency_symbol: z.string().trim().max(4).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const updateSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).optional(),
      description: z.string().trim().max(512).optional(),
      kind: z.enum(ACCOUNT_KIND_OPTIONS).optional(),
      currency_code: z.string().trim().max(8).optional(),
      currency_symbol: z.string().trim().max(4).optional(),
    })
    .superRefine((data, ctx) => {
      if (
        data.name === undefined &&
        data.description === undefined &&
        data.kind === undefined &&
        data.currency_code === undefined &&
        data.currency_symbol === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one field must be provided",
          path: ["body"],
        });
      }
    }),
  params: z.object({
    accountId: z.string(),
  }),
  query: z.object({}).optional(),
});

const archiveSchema = z.object({
  body: z.object({
    archived: z.boolean(),
  }),
  params: z.object({
    accountId: z.string(),
  }),
  query: z.object({}).optional(),
});

const accountParamsSchema = z.object({
  params: z.object({
    accountId: z.string(),
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});

const transactionQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  range: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
  type: z.enum(["debit", "credit"]).optional(),
  categoryId: z.string().optional(),
  category_id: z.string().optional(),
  counterparty: z.string().optional(),
  financialScope: z.string().optional(),
  financial_scope: z.string().optional(),
  q: z.string().optional(),
  search: z.string().optional(),
  minAmount: z.string().optional(),
  maxAmount: z.string().optional(),
  min_amount: z.string().optional(),
  max_amount: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

const accountTransactionsSchema = z.object({
  params: z.object({
    accountId: z.string(),
  }),
  body: z.object({}).optional(),
  query: transactionQuerySchema,
});

router.use(authenticate);

router.get("/", validate(listQuerySchema), listAccounts);
router.get("/overview", validate(listQuerySchema), listAccounts);
router.post("/", validate(createSchema), createAccount);
router.put("/:accountId", validate(updateSchema), updateAccount);
router.patch("/:accountId", validate(updateSchema), updateAccount);
router.patch("/:accountId/archive", validate(archiveSchema), archiveAccount);
router.get(
  "/:accountId/detail",
  validate(accountParamsSchema),
  getAccountDetail
);
router.get("/:accountId", validate(accountParamsSchema), getAccountDetail);
router.get(
  "/:accountId/summary",
  validate(accountParamsSchema),
  getAccountSummary
);
router.get(
  "/:accountId/transactions",
  validate(accountTransactionsSchema),
  getAccountTransactions
);

export default router;
