import { Router } from "express";
import { z } from "zod";
import {
  getSummaryReport,
  getSeriesReport,
  getAccountBalancesReport,
  getTopCategoriesReport,
} from "../controllers/report.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const baseReportQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  range: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
  accountId: z.string().optional(),
  account_id: z.string().optional(),
  categoryId: z.string().optional(),
  category_id: z.string().optional(),
});

const summarySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: baseReportQuery.extend({
    type: z.enum(["debit", "credit"]).optional(),
  }),
});

const seriesSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: baseReportQuery.extend({
    granularity: z.enum(["day", "month"]).optional(),
  }),
});

const accountBalanceSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    on: z.string().optional(),
  }),
});

const topCategoriesSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: baseReportQuery.extend({
    type: z
      .enum([
        "income",
        "expense",
        "loan_in",
        "loan_out",
        "donation",
        "purchase",
        "sell",
        "salary",
        "other",
      ])
      .optional(),
    limit: z.string().optional(),
  }),
});

router.use(authenticate);

router.get("/summary", validate(summarySchema), getSummaryReport);
router.get("/series", validate(seriesSchema), getSeriesReport);
router.get(
  "/accounts-balances",
  validate(accountBalanceSchema),
  getAccountBalancesReport
);
router.get(
  "/top-categories",
  validate(topCategoriesSchema),
  getTopCategoriesReport
);

export default router;
