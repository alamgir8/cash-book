import dayjs from "dayjs";
import mongoose from "mongoose";
import { Account } from "../models/Account.js";
import { Category } from "../models/Category.js";
import { Transaction } from "../models/Transaction.js";
import { buildTransactionFilters } from "../utils/filters.js";
import { resolveFinancialCategoryScope } from "../utils/financialCategories.js";
import { checkOrgAccess, getOrgFromRequest } from "../utils/organization.js";

const buildScopedFilter = async ({ req, extraQuery = {} }) => {
  const organizationId = getOrgFromRequest(req);
  const financialScope =
    req.query.financialScope ?? req.query.financial_scope ?? null;

  let categoryScope = null;
  if (financialScope) {
    categoryScope = await resolveFinancialCategoryScope({
      adminId: req.user.id,
      scope: financialScope,
    });
  }

  return buildTransactionFilters({
    adminId: req.user.id,
    organizationId,
    query: { ...req.query, ...extraQuery },
    categoryScope,
  });
};

const parseBoundaryDate = (value, fallback = new Date()) => {
  if (!value) return fallback;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.toDate() : fallback;
};

export const getSummaryReport = async (req, res, next) => {
  try {
    const organizationId = getOrgFromRequest(req);

    // Check organization access if provided
    if (organizationId) {
      const access = await checkOrgAccess(
        req.user.id,
        organizationId,
        "view_reports"
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    }

    const filter = await buildScopedFilter({ req });

    const results = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = results.reduce(
      (acc, item) => {
        if (item._id === "debit") {
          acc.total_debit = item.total;
          acc.debit_count = item.count;
        } else if (item._id === "credit") {
          acc.total_credit = item.total;
          acc.credit_count = item.count;
        }
        return acc;
      },
      {
        total_debit: 0,
        total_credit: 0,
        debit_count: 0,
        credit_count: 0,
      }
    );

    summary.net = summary.total_credit - summary.total_debit;

    res.json({
      summary,
    });
  } catch (error) {
    next(error);
  }
};

export const getSeriesReport = async (req, res, next) => {
  try {
    const organizationId = getOrgFromRequest(req);

    // Check organization access if provided
    if (organizationId) {
      const access = await checkOrgAccess(
        req.user.id,
        organizationId,
        "view_reports"
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    }

    const granularity = req.query.granularity === "month" ? "month" : "day";

    const filter = await buildScopedFilter({ req });

    const dateFormat = granularity === "month" ? "%Y-%m-01" : "%Y-%m-%d";

    const series = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            period: {
              $dateToString: {
                format: dateFormat,
                date: "$date",
              },
            },
          },
          total_debit: {
            $sum: {
              $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0],
            },
          },
          total_credit: {
            $sum: {
              $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          period_start: "$_id.period",
          total_debit: 1,
          total_credit: 1,
          net: { $subtract: ["$total_credit", "$total_debit"] },
        },
      },
      { $sort: { period_start: 1 } },
    ]);

    res.json({
      granularity,
      series,
    });
  } catch (error) {
    next(error);
  }
};

export const getAccountBalancesReport = async (req, res, next) => {
  try {
    const organizationId = getOrgFromRequest(req);

    // Check organization access if provided
    if (organizationId) {
      const access = await checkOrgAccess(
        req.user.id,
        organizationId,
        "view_reports"
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    }

    const onDate = parseBoundaryDate(req.query.on);

    const accountFilter = organizationId
      ? { organization: organizationId }
      : { admin: req.user.id };

    const accounts = await Account.find(accountFilter).lean().sort({ name: 1 });

    if (accounts.length === 0) {
      return res.json({ accounts: [] });
    }

    const txnMatchFilter = organizationId
      ? {
          organization: new mongoose.Types.ObjectId(organizationId),
          account: { $in: accounts.map((account) => account._id) },
          date: { $lte: onDate },
          is_deleted: { $ne: true },
        }
      : {
          admin: new mongoose.Types.ObjectId(req.user.id),
          account: { $in: accounts.map((account) => account._id) },
          date: { $lte: onDate },
          is_deleted: { $ne: true },
        };

    const aggregates = await Transaction.aggregate([
      { $match: txnMatchFilter },
      {
        $group: {
          _id: "$account",
          total_debit: {
            $sum: {
              $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0],
            },
          },
          total_credit: {
            $sum: {
              $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    const aggregateMap = new Map(
      aggregates.map((item) => [
        item._id.toString(),
        {
          total_debit: item.total_debit ?? 0,
          total_credit: item.total_credit ?? 0,
        },
      ])
    );

    const balances = accounts.map((account) => {
      const movements = aggregateMap.get(account._id.toString()) ?? {
        total_debit: 0,
        total_credit: 0,
      };
      const closing_balance =
        (account.opening_balance ?? 0) +
        movements.total_credit -
        movements.total_debit;
      return {
        account_id: account._id,
        name: account.name,
        kind: account.kind,
        currency_code: account.currency_code,
        currency_symbol: account.currency_symbol,
        opening_balance: account.opening_balance,
        closing_balance,
        total_debit: movements.total_debit,
        total_credit: movements.total_credit,
      };
    });

    res.json({
      as_of: onDate.toISOString(),
      accounts: balances,
    });
  } catch (error) {
    next(error);
  }
};

export const getTopCategoriesReport = async (req, res, next) => {
  try {
    const organizationId = getOrgFromRequest(req);

    // Check organization access if provided
    if (organizationId) {
      const access = await checkOrgAccess(
        req.user.id,
        organizationId,
        "view_reports"
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    }

    const filter = await buildScopedFilter({ req });

    if (req.query.type) {
      const categoryQueryFilter = organizationId
        ? { organization: organizationId, type: req.query.type }
        : { admin: req.user.id, type: req.query.type };

      const categoryFilter = await Category.find(categoryQueryFilter).select(
        "_id"
      );

      filter.category_id = {
        $in: categoryFilter.map((category) => category._id),
      };
    }

    const limit = Math.min(Number(req.query.limit) || 5, 20);

    const categories = await Transaction.aggregate([
      { $match: { ...filter, category_id: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$category_id",
          total_amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total_amount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $project: {
          _id: 0,
          category_id: "$category._id",
          name: "$category.name",
          type: "$category.type",
          total_amount: 1,
          count: 1,
        },
      },
    ]);

    res.json({
      categories,
    });
  } catch (error) {
    next(error);
  }
};
