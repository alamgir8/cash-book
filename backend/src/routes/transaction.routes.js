import { Router } from "express";
import { z } from "zod";
import {
  listTransactions,
  createTransaction,
  updateTransaction,
} from "../controllers/transaction.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const amountValidator = z.coerce
  .number({
    invalid_type_error: "Amount must be a number",
  })
  .positive("Amount must be greate r than zero");

const dateValidator = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || !Number.isNaN(Date.parse(value)), {
    message: "Provide a valid date or leave blank",
  })
  .optional();

const createSchema = z.object({
  body: z.object({
    accountId: z.string().min(1, "Account is required"),
    type: z.enum(["debit", "credit"]),
    amount: amountValidator,
    date: dateValidator,
    description: z.string().optional(),
    comment: z.string().optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const updateSchema = z.object({
  body: z
    .object({
      accountId: z.string().optional(),
      type: z.enum(["debit", "credit"]).optional(),
      amount: amountValidator.optional(),
      date: dateValidator,
      description: z.string().optional(),
      comment: z.string().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "No update fields provided",
    }),
  params: z.object({
    transactionId: z.string(),
  }),
  query: z.object({}).optional(),
});

router.use(authenticate);

router.get("/", listTransactions);
router.post("/", validate(createSchema), createTransaction);
router.patch("/:transactionId", validate(updateSchema), updateTransaction);

export default router;
