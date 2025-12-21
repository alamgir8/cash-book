import mongoose from "mongoose";
import { Account } from "../models/Account.js";
import { Admin } from "../models/Admin.js";
import { Transaction } from "../models/Transaction.js";
import { Organization } from "../models/Organization.js";
import { buildTransactionFilters } from "../utils/filters.js";
import { resolveFinancialCategoryScope } from "../utils/financialCategories.js";
import { recomputeDescendingBalances } from "../utils/balance.js";
import {
  checkOrgAccess,
  buildOrgFilter,
  getOrgFromRequest,
} from "../utils/organization.js";

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

const computeAccountSummary = async ({
  adminId,
  accountId,
  organizationId,
}) => {
  const matchFilter = organizationId
    ? {
        organization: new mongoose.Types.ObjectId(organizationId),
        account: new mongoose.Types.ObjectId(accountId),
        is_deleted: { $ne: true },
      }
    : {
        admin: new mongoose.Types.ObjectId(adminId),
        account: new mongoose.Types.ObjectId(accountId),
        is_deleted: { $ne: true },
      };

  const [aggregates] = await Transaction.aggregate([
    { $match: matchFilter },
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

const decorateWithSummary = async ({ adminId, accounts, organizationId }) => {
  if (accounts.length === 0) {
    return [];
  }

  const accountIds = accounts.map((account) => account._id);

  const matchFilter = organizationId
    ? {
        organization: new mongoose.Types.ObjectId(organizationId),
        account: { $in: accountIds },
        is_deleted: { $ne: true },
      }
    : {
        admin: new mongoose.Types.ObjectId(adminId),
        account: { $in: accountIds },
        is_deleted: { $ne: true },
      };

  const aggregates = await Transaction.aggregate([
    { $match: matchFilter },
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
    summary: summaries.get(account._id.toString()) ?? {
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
    const organizationId = getOrgFromRequest(req);

    // Check organization access if provided
    if (organizationId) {
      const access = await checkOrgAccess(
        req.user.id,
        organizationId,
        "view_transactions"
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    }

    const includeArchived =
      req.query.include_archived === "true" ||
      req.query.includeArchived === "true";

    const filter = buildOrgFilter(req.user.id, organizationId, {
      ...(includeArchived ? {} : { archived: false }),
    });

    const accounts = await Account.find(filter).sort({ name: 1 }).lean();
    const withSummary = await decorateWithSummary({
      adminId: req.user.id,
      accounts,
      organizationId,
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
      organization,
    } = req.body;

    // Check organization access if provided
    if (organization) {
      const access = await checkOrgAccess(
        req.user.id,
        organization,
        "manage_accounts"
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    }

    let finalCurrencyCode = currency_code;
    let finalCurrencySymbol = currency_symbol;

    if (!finalCurrencyCode || !finalCurrencySymbol) {
      // Try organization settings first
      if (organization) {
        const org = await Organization.findById(organization).lean();
        if (org?.settings) {
          finalCurrencyCode = finalCurrencyCode ?? org.settings.currency;
          finalCurrencySymbol = finalCurrencySymbol ?? org.settings.currency;
        }
      } else {
        // Fall back to admin settings
        const admin = await Admin.findById(req.user.id).lean();
        if (admin?.profile_settings) {
          finalCurrencyCode =
            finalCurrencyCode ?? admin.profile_settings.currency_code;
          finalCurrencySymbol =
            finalCurrencySymbol ?? admin.profile_settings.currency_symbol;
        }
      }
    }

    const opening = Number(openingBalance ?? 0);

    const account = await Account.create({
      admin: req.user.id,
      organization,
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
        message: "An account with this name already exists",
      });
    }
    next(error);
  }
};

export const updateAccount = async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const update = pickAccountUpdateFields(req.body);

    // First find the account to check access
    const existingAccount = await Account.findById(accountId);
    if (!existingAccount) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Check access
    if (existingAccount.organization) {
      const access = await checkOrgAccess(
        req.user.id,
        existingAccount.organization,
        "manage_accounts"
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    } else if (existingAccount.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const account = await Account.findByIdAndUpdate(accountId, update, {
      new: true,
      runValidators: true,
    });

    res.json({ account });
  } catch (error) {
    next(error);
  }
};

export const archiveAccount = async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { archived } = req.body;

    const account = await Account.findById(accountId);

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Check access
    if (account.organization) {
      const access = await checkOrgAccess(
        req.user.id,
        account.organization,
        "manage_accounts"
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    } else if (account.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
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

    const account = await Account.findById(accountId).lean();

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Check access
    if (account.organization) {
      const access = await checkOrgAccess(
        req.user.id,
        account.organization,
        "view_transactions"
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    } else if (account.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const summary = await computeAccountSummary({
      adminId: req.user.id,
      accountId,
      organizationId: account.organization,
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

    const account = await Account.findById(accountId).lean();

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Check access
    if (account.organization) {
      const access = await checkOrgAccess(
        req.user.id,
        account.organization,
        "view_transactions"
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    } else if (account.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const summary = await computeAccountSummary({
      adminId: req.user.id,
      accountId,
      organizationId: account.organization,
    });

    const txnFilter = account.organization
      ? {
          organization: account.organization,
          account: account._id,
          is_deleted: { $ne: true },
        }
      : {
          admin: req.user.id,
          account: account._id,
          is_deleted: { $ne: true },
        };

    const recentTransactions = await Transaction.find(txnFilter)
      .populate("category_id", "name type")
      .sort({ date: -1 })
      .limit(5)
      .lean();

    if (recentTransactions.length > 0) {
      const accountBalances = new Map([
        [account._id.toString(), Number(account.current_balance ?? 0)],
      ]);
      recomputeDescendingBalances({
        transactions: recentTransactions,
        accountBalances,
      });
    }

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

    const account = await Account.findById(accountId);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Check access
    if (account.organization) {
      const access = await checkOrgAccess(
        req.user.id,
        account.organization,
        "view_transactions"
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    } else if (account.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const financialScope =
      req.query.financialScope ?? req.query.financial_scope ?? null;

    let categoryScope = null;
    if (financialScope) {
      categoryScope = await resolveFinancialCategoryScope({
        adminId: req.user.id,
        scope: financialScope,
      });
    }

    const filter = buildTransactionFilters({
      adminId: req.user.id,
      organizationId: account.organization,
      query: {
        ...req.query,
        accountId,
      },
      categoryScope,
    });

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const upperLimit = skip + limit;

    const [baseTransactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ date: -1, createdAt: -1, _id: -1 })
        .limit(upperLimit)
        .select("_id account amount type createdAt")
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    const balanceMap = new Map();

    if (baseTransactions.length > 0) {
      const accountBalances = new Map([
        [account._id.toString(), Number(account.current_balance ?? 0)],
      ]);
      recomputeDescendingBalances({
        transactions: baseTransactions,
        accountBalances,
      });
      baseTransactions.forEach((txn) => {
        balanceMap.set(txn._id.toString(), txn.balance_after_transaction);
      });
    }

    const transactions = await Transaction.find(filter)
      .populate("account", "name kind")
      .populate("category_id", "name type")
      .sort({ date: -1, createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    if (transactions.length > 0 && balanceMap.size > 0) {
      transactions.forEach((txn) => {
        const computed = balanceMap.get(txn._id.toString());
        if (typeof computed === "number") {
          txn.balance_after_transaction = computed;
        }
      });
    }

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
