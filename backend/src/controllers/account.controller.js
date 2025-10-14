import mongoose from "mongoose";
import { Account } from "../models/Account.js";
import { Transaction } from "../models/Transaction.js";
import { buildTransactionFilters } from "../utils/filters.js";

export const listAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.find({ admin: req.user.id }).sort({
      name: 1,
    });
    res.json({ accounts });
  } catch (error) {
    next(error);
  }
};

export const createAccount = async (req, res, next) => {
  try {
    const { name, type, description } = req.body;
    const account = await Account.create({
      admin: req.user.id,
      name,
      type,
      description,
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
    const update = req.body;

    const account = await Account.findOneAndUpdate(
      { _id: accountId, admin: req.user.id },
      update,
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    res.json({ account });
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
    });
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const totals = await Transaction.aggregate([
      {
        $match: {
          admin: account.admin,
          account: account._id,
        },
      },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
        },
      },
    ]);

    const summary = totals.reduce(
      (acc, item) => {
        acc[item._id] = item.total;
        return acc;
      },
      { debit: 0, credit: 0 }
    );

    res.json({
      account,
      summary,
    });
  } catch (error) {
    next(error);
  }
};

export const listAccountsWithSummary = async (req, res, next) => {
  try {
    const accounts = await Account.find({ admin: req.user.id })
      .sort({ name: 1 })
      .lean();

    if (accounts.length === 0) {
      return res.json({ accounts: [] });
    }

    const accountIds = accounts.map((account) => account._id);
    const aggregates = await Transaction.aggregate([
      {
        $match: {
          admin: new mongoose.Types.ObjectId(req.user.id),
          account: { $in: accountIds },
        },
      },
      {
        $group: {
          _id: "$account",
          totalTransactions: { $sum: 1 },
          totalDebit: {
            $sum: {
              $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0],
            },
          },
          totalCredit: {
            $sum: {
              $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0],
            },
          },
          lastTransactionDate: { $max: "$date" },
        },
      },
    ]);

    const aggregateMap = new Map(
      aggregates.map((item) => [
        item._id.toString(),
        {
          totalTransactions: item.totalTransactions,
          totalDebit: item.totalDebit,
          totalCredit: item.totalCredit,
          lastTransactionDate: item.lastTransactionDate,
        },
      ])
    );

    const enriched = accounts.map((account) => {
      const summary = aggregateMap.get(account._id.toString()) ?? {
        totalTransactions: 0,
        totalDebit: 0,
        totalCredit: 0,
        lastTransactionDate: null,
      };
      return {
        ...account,
        summary,
      };
    });

    res.json({ accounts: enriched });
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

    const [aggregate] = await Transaction.aggregate([
      {
        $match: {
          admin: new mongoose.Types.ObjectId(req.user.id),
          account: new mongoose.Types.ObjectId(accountId),
        },
      },
      {
        $group: {
          _id: "$account",
          totalTransactions: { $sum: 1 },
          totalDebit: {
            $sum: {
              $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0],
            },
          },
          totalCredit: {
            $sum: {
              $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0],
            },
          },
          lastTransactionDate: { $max: "$date" },
        },
      },
    ]);

    const summary = aggregate ?? {
      totalTransactions: 0,
      totalDebit: 0,
      totalCredit: 0,
      lastTransactionDate: null,
    };

    const recentTransactions = await Transaction.find({
      admin: req.user.id,
      account: account._id,
    })
      .sort({ date: -1 })
      .limit(5)
      .lean();

    res.json({
      account,
      summary: {
        totalTransactions: summary.totalTransactions,
        totalDebit: summary.totalDebit ?? 0,
        totalCredit: summary.totalCredit ?? 0,
        lastTransactionDate: summary.lastTransactionDate,
      },
      recentTransactions,
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
    filter.account = account._id;

    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate("account", "name type")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      account: account.toObject(),
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};
