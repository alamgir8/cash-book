import { Router } from "express";
import { z } from "zod";
import {
  listTransactions,
  getTransaction,
  createTransaction,
  createTransfer,
  updateTransaction,
  deleteTransaction,
  restoreTransaction,
} from "../controllers/transaction.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const amountValidator = z.coerce
  .number({
    invalid_type_error: "Amount must be a number",
  })
  .gt(0, "Amount must be greater than zero");

const dateValidator = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || !Number.isNaN(Date.parse(value)), {
    message: "Provide a valid date or leave blank",
  })
  .optional();

const metaSchema = z
  .record(z.any())
  .optional();

const createSchema = z.object({
  body: z.object({
    accountId: z.string().trim().min(1).optional(),
    account_id: z.string().trim().min(1).optional(),
    type: z.enum(["debit", "credit"]),
    amount: amountValidator,
    date: dateValidator,
    description: z.string().optional(),
    keyword: z.string().optional(),
    counterparty: z.string().optional(),
    categoryId: z.string().optional(),
    category_id: z.string().optional(),
    meta_data: metaSchema,
    client_request_id: z.string().trim().max(128).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const transferSchema = z.object({
  body: z
    .object({
      fromAccountId: z.string().trim().min(1).optional(),
      from_account_id: z.string().trim().min(1).optional(),
      toAccountId: z.string().trim().min(1).optional(),
      to_account_id: z.string().trim().min(1).optional(),
      amount: amountValidator,
      date: dateValidator,
      description: z.string().optional(),
      keyword: z.string().optional(),
      counterparty: z.string().optional(),
      meta_data: metaSchema,
      client_request_id: z.string().trim().max(128).optional(),
    })
    .superRefine((data, ctx) => {
      const source = data.fromAccountId ?? data.from_account_id;
      const destination = data.toAccountId ?? data.to_account_id;

      if (!source) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Source account is required",
          path: ["body", "fromAccountId"],
        });
      }

      if (!destination) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Destination account is required",
          path: ["body", "toAccountId"],
        });
      }

      if (source && destination && source === destination) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Source and destination accounts must differ",
          path: ["body", "toAccountId"],
        });
      }
    }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const updateSchema = z.object({
  body: z
    .object({
      accountId: z.string().optional(),
      account_id: z.string().optional(),
      type: z.enum(["debit", "credit"]).optional(),
      amount: amountValidator.optional(),
      date: dateValidator,
      description: z.string().optional(),
      keyword: z.string().optional(),
      counterparty: z.string().optional(),
      categoryId: z.string().optional(),
      category_id: z.string().optional(),
      meta_data: metaSchema,
    })
    .superRefine((data, ctx) => {
      if (
        data.accountId === undefined &&
        data.account_id === undefined &&
        data.type === undefined &&
        data.amount === undefined &&
        data.date === undefined &&
        data.description === undefined &&
        data.keyword === undefined &&
        data.counterparty === undefined &&
        data.categoryId === undefined &&
        data.category_id === undefined &&
        data.meta_data === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "No update fields provided",
          path: ["body"],
        });
      }
    }),
  params: z.object({
    transactionId: z.string(),
  }),
  query: z.object({}).optional(),
});

const listQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    range: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
    type: z.enum(["debit", "credit"]).optional(),
    accountId: z.string().optional(),
    account_id: z.string().optional(),
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
    includeDeleted: z.string().optional(),
    include_deleted: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

const transactionIdParams = z.object({
  body: z.object({}).optional(),
  params: z.object({
    transactionId: z.string(),
  }),
  query: z.object({}).optional(),
});

router.use(authenticate);

router.get("/", validate(listQuerySchema), listTransactions);
router.get("/:transactionId", validate(transactionIdParams), getTransaction);
router.post("/", validate(createSchema), createTransaction);
router.post("/transfer", validate(transferSchema), createTransfer);
router.put("/:transactionId", validate(updateSchema), updateTransaction);
router.patch("/:transactionId", validate(updateSchema), updateTransaction);
router.delete("/:transactionId", validate(transactionIdParams), deleteTransaction);
router.post(
  "/:transactionId/restore",
  validate(transactionIdParams),
  restoreTransaction
);

export default router;
