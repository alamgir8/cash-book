import mongoose from "mongoose";
import { Account } from "../models/Account.js";
import { Admin } from "../models/Admin.js";
import { Transaction } from "../models/Transaction.js";
import { buildTransactionFilters } from "../utils/filters.js";

const pickAccountUpdateFields = (payload) => {
  const allowed = [
    "name",
    "description",
    "kind",
    "currency_code",
    "currency_symbol",
  ];
  return allowed.reduce((acc, field) => {
    if (payload[field] !== undefined) {
      acc[field] = payload[field];
    }
    return acc;
  }, {});
};

const computeAccountSummary = async ({ adminId, accountId }) => {
  const [aggregates] = await Transaction.aggregate([
    {
      $match: {
        admin: new mongoose.Types.ObjectId(adminId),
        account: new mongoose.Types.ObjectId(accountId),
        is_deleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: "$account",
        total_transactions: { $sum: 1 },
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
        last_transaction_date: { $max: "$date" },
      },
    },
  ]);

  return aggregates
    ? {
        total_transactions: aggregates.total_transactions,
        total_debit: aggregates.total_debit ?? 0,
        total_credit: aggregates.total_credit ?? 0,
        net: (aggregates.total_credit ?? 0) - (aggregates.total_debit ?? 0),
        last_transaction_date: aggregates.last_transaction_date,
      }
    : {
        total_transactions: 0,
        total_debit: 0,
        total_credit: 0,
        net: 0,
        last_transaction_date: null,
      };
};

const decorateWithSummary = async ({ adminId, accounts }) => {
  if (accounts.length === 0) {
    return [];
  }

  const accountIds = accounts.map((account) => account._id);
  const aggregates = await Transaction.aggregate([
    {
      $match: {
        admin: new mongoose.Types.ObjectId(adminId),
        account: { $in: accountIds },
        is_deleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: "$account",
        total_transactions: { $sum: 1 },
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
        last_transaction_date: { $max: "$date" },
      },
    },
  ]);

  const summaries = new Map(
    aggregates.map((item) => [
      item._id.toString(),
      {
        total_transactions: item.total_transactions,
        total_debit: item.total_debit ?? 0,
        total_credit: item.total_credit ?? 0,
        net: (item.total_credit ?? 0) - (item.total_debit ?? 0),
        last_transaction_date: item.last_transaction_date,
      },
    ])
  );

  return accounts.map((account) => ({
    ...account,
    summary:
      summaries.get(account._id.toString()) ?? {
        total_transactions: 0,
        total_debit: 0,
        total_credit: 0,
        net: 0,
        last_transaction_date: null,
      },
  }));
};

export const listAccounts = async (req, res, next) => {
  try {
    const includeArchived =
      req.query.include_archived === "true" ||
      req.query.includeArchived === "true";

    const filter = {
      admin: req.user.id,
      ...(includeArchived ? {} : { archived: false }),
    };

    const accounts = await Account.find(filter).sort({ name: 1 }).lean();
    const withSummary = await decorateWithSummary({
      adminId: req.user.id,
      accounts,
    });

    res.json({ accounts: withSummary });
  } catch (error) {
    next(error);
  }
};

export const createAccount = async (req, res, next) => {
  try {
    const {
      name,
      description,
      kind,
      opening_balance: openingBalance,
      currency_code,
      currency_symbol,
    } = req.body;

    let finalCurrencyCode = currency_code;
    let finalCurrencySymbol = currency_symbol;

    if (!finalCurrencyCode || !finalCurrencySymbol) {
      const admin = await Admin.findById(req.user.id).lean();
      if (admin?.profile_settings) {
        finalCurrencyCode = finalCurrencyCode ?? admin.profile_settings.currency_code;
        finalCurrencySymbol =
          finalCurrencySymbol ?? admin.profile_settings.currency_symbol;
      }
    }

    const opening = Number(openingBalance ?? 0);

    const account = await Account.create({
      admin: req.user.id,
      name,
      description,
      kind,
      opening_balance: opening,
      current_balance: opening,
      currency_code: finalCurrencyCode,
      currency_symbol: finalCurrencySymbol,
    });

    res.status(201).json({ account });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this name already exists for this admin",
      });
    }
    next(error);
  }
};

export const updateAccount = async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const update = pickAccountUpdateFields(req.body);

    const account = await Account.findOneAndUpdate(
      { _id: accountId, admin: req.user.id },
      update,
      { new: true, runValidators: true }
    );

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    res.json({ account });
  } catch (error) {
    next(error);
  }
};

export const archiveAccount = async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { archived } = req.body;

    const account = await Account.findOne({
      _id: accountId,
      admin: req.user.id,
    });

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const nextArchivedState = Boolean(archived);
    account.archived = nextArchivedState;
    account.archived_at = nextArchivedState ? new Date() : undefined;
    await account.save();

    res.json({
      account,
    });
  } catch (error) {
    next(error);
  }
};

export const getAccountSummary = async (req, res, next) => {
  try {
    const { accountId } = req.params;

    const account = await Account.findOne({
      _id: accountId,
      admin: req.user.id,
    }).lean();

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const summary = await computeAccountSummary({
      adminId: req.user.id,
      accountId,
    });

    res.json({
      account,
      summary: {
        ...summary,
        current_balance: account.current_balance,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAccountDetail = async (req, res, next) => {
  try {
    const { accountId } = req.params;

    const account = await Account.findOne({
      _id: accountId,
      admin: req.user.id,
    }).lean();

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const summary = await computeAccountSummary({
      adminId: req.user.id,
      accountId,
    });

    const recentTransactions = await Transaction.find({
      admin: req.user.id,
      account: account._id,
      is_deleted: { $ne: true },
    })
      .populate("category_id", "name type")
      .sort({ date: -1 })
      .limit(5)
      .lean();

    res.json({
      account,
      summary: {
        ...summary,
        current_balance: account.current_balance,
      },
      recent_transactions: recentTransactions,
    });
  } catch (error) {
    next(error);
  }
};

export const getAccountTransactions = async (req, res, next) => {
  try {
    const { accountId } = req.params;

    const account = await Account.findOne({
      _id: accountId,
      admin: req.user.id,
    });
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const filter = buildTransactionFilters({
      adminId: req.user.id,
      query: {
        ...req.query,
        accountId,
      },
    });

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate("account", "name kind")
        .populate("category_id", "name type")
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      account: account.toObject(),
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    next(error);
  }
};
