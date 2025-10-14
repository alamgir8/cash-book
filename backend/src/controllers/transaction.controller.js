import dayjs from "dayjs";
import { Account } from "../models/Account.js";
import { Category } from "../models/Category.js";
import { Transaction } from "../models/Transaction.js";
import { buildTransactionFilters } from "../utils/filters.js";

const parseTransactionDate = (value) => {
  if (!value) {
    return new Date();
  }
  if (typeof value === "string" && value.trim().length === 0) {
    return new Date();
  }
  if (value instanceof Date) {
    return value;
  }
  const parsed = dayjs(value);
  if (!parsed.isValid()) {
    throw new Error("Invalid transaction date");
  }
  return parsed.toDate();
};

const adjustAccountBalance = async ({
  account,
  amount,
  type,
  direction = "apply",
}) => {
  const delta = type === "credit" ? amount : -amount;
  const nextDelta = direction === "revert" ? -delta : delta;
  account.current_balance = (account.current_balance ?? 0) + nextDelta;
  await account.save();
  return account.current_balance;
};

const loadAccount = async ({ adminId, accountId }) => {
  return Account.findOne({
    _id: accountId,
    admin: adminId,
  });
};

const loadCategory = async ({ adminId, categoryId }) => {
  if (!categoryId) return null;
  return Category.findOne({
    _id: categoryId,
    admin: adminId,
    archived: { $ne: true },
  });
};

const applyIdempotency = async ({ adminId, clientRequestId }) => {
  if (!clientRequestId) return null;
  return Transaction.findOne({
    admin: adminId,
    client_request_id: clientRequestId,
  })
    .populate("account", "name kind")
    .populate("category_id", "name type")
    .lean();
};

const extractIdempotencyKey = (req) => {
  return (
    req.headers["x-idempotency-key"] ||
    req.headers["x_idempotency_key"] ||
    req.body?.client_request_id ||
    null
  );
};

export const listTransactions = async (req, res, next) => {
  try {
    const filter = buildTransactionFilters({
      adminId: req.user.id,
      query: req.query,
    });

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
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

export const getTransaction = async (req, res, next) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      admin: req.user.id,
    })
      .populate("account", "name kind")
      .populate("category_id", "name type")
      .lean();

    if (!transaction || transaction.is_deleted) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json({ transaction });
  } catch (error) {
    next(error);
  }
};

export const createTransaction = async (req, res, next) => {
  try {
    const {
      account_id: accountIdAlias,
      accountId,
      type,
      amount,
      date,
      description,
      keyword,
      counterparty,
      category_id: categoryIdAlias,
      categoryId,
      meta_data: metaData,
    } = req.body;

    const idempotencyKey = extractIdempotencyKey(req);
    const existing = await applyIdempotency({
      adminId: req.user.id,
      clientRequestId: idempotencyKey,
    });
    if (existing) {
      return res.status(200).json({
        transaction: existing,
        idempotent: true,
      });
    }

    const accountIdentifier = accountIdAlias ?? accountId;
    if (!accountIdentifier) {
      return res.status(400).json({ message: "Account is required" });
    }
    const account = await loadAccount({
      adminId: req.user.id,
      accountId: accountIdentifier,
    });

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const categoryIdentifier = categoryIdAlias ?? categoryId;
    let categoryDocument = null;
    if (categoryIdentifier) {
      categoryDocument = await loadCategory({
        adminId: req.user.id,
        categoryId: categoryIdentifier,
      });
      if (!categoryDocument) {
        return res.status(404).json({ message: "Category not found" });
      }
    }

    let txnDate;
    try {
      txnDate = parseTransactionDate(date);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    const transaction = await Transaction.create({
      admin: req.user.id,
      account: account._id,
      category_id: categoryDocument?._id,
      type,
      amount,
      date: txnDate,
      description,
      keyword,
      counterparty,
      meta_data: metaData,
      client_request_id: idempotencyKey ?? undefined,
    });

    const balanceAfter = await adjustAccountBalance({
      account,
      amount,
      type,
      direction: "apply",
    });

    transaction.balance_after_transaction = balanceAfter;
    await transaction.save();

    const populated = await Transaction.findById(transaction._id)
      .populate("account", "name kind")
      .populate("category_id", "name type")
      .lean();

    res.status(201).json({ transaction: populated });
  } catch (error) {
    next(error);
  }
};

export const updateTransaction = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const {
      account_id: incomingAccountId,
      accountId,
      category_id: incomingCategoryId,
      categoryId,
      type,
      amount,
      date,
      description,
      keyword,
      counterparty,
      meta_data: metaData,
    } = req.body;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      admin: req.user.id,
      is_deleted: { $ne: true },
    });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const originalAccount = await loadAccount({
      adminId: req.user.id,
      accountId: transaction.account,
    });
    if (!originalAccount) {
      return res.status(404).json({ message: "Account not found" });
    }

    let targetAccount = originalAccount;
    const nextAccountId = incomingAccountId ?? accountId;
    if (nextAccountId && nextAccountId !== transaction.account.toString()) {
      targetAccount = await loadAccount({
        adminId: req.user.id,
        accountId: nextAccountId,
      });
      if (!targetAccount) {
        return res.status(404).json({ message: "Target account not found" });
      }
    }

    const nextCategoryId = incomingCategoryId ?? categoryId;
    if (nextCategoryId !== undefined) {
      if (!nextCategoryId) {
        transaction.category_id = undefined;
      } else {
        const categoryDoc = await loadCategory({
          adminId: req.user.id,
          categoryId: nextCategoryId,
        });
        if (!categoryDoc) {
          return res.status(404).json({ message: "Category not found" });
        }
        transaction.category_id = categoryDoc._id;
      }
    }

    await adjustAccountBalance({
      account: originalAccount,
      amount: transaction.amount,
      type: transaction.type,
      direction: "revert",
    });

    if (targetAccount._id.toString() !== originalAccount._id.toString()) {
      transaction.account = targetAccount._id;
    }

    if (type) {
      transaction.type = type;
    }
    if (amount !== undefined) {
      transaction.amount = amount;
    }
    if (date !== undefined) {
      try {
        transaction.date = parseTransactionDate(date);
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }
    if (description !== undefined) {
      transaction.description = description;
    }
    if (keyword !== undefined) {
      transaction.keyword = keyword;
    }
    if (counterparty !== undefined) {
      transaction.counterparty = counterparty;
    }
    if (metaData !== undefined) {
      transaction.meta_data = metaData;
    }

    const balanceAfter = await adjustAccountBalance({
      account: targetAccount,
      amount: transaction.amount,
      type: transaction.type,
      direction: "apply",
    });

    transaction.balance_after_transaction = balanceAfter;
    await transaction.save();

    const populated = await Transaction.findById(transaction._id)
      .populate("account", "name kind")
      .populate("category_id", "name type")
      .lean();

    res.json({ transaction: populated });
  } catch (error) {
    next(error);
  }
};

export const deleteTransaction = async (req, res, next) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      admin: req.user.id,
      is_deleted: { $ne: true },
    });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const account = await loadAccount({
      adminId: req.user.id,
      accountId: transaction.account,
    });

    if (account) {
      await adjustAccountBalance({
        account,
        amount: transaction.amount,
        type: transaction.type,
        direction: "revert",
      });
    }

    transaction.softDelete();
    await transaction.save();

    res.status(200).json({ message: "Transaction deleted" });
  } catch (error) {
    next(error);
  }
};

export const restoreTransaction = async (req, res, next) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      admin: req.user.id,
      is_deleted: true,
    });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const account = await loadAccount({
      adminId: req.user.id,
      accountId: transaction.account,
    });

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    transaction.restore();

    const balanceAfter = await adjustAccountBalance({
      account,
      amount: transaction.amount,
      type: transaction.type,
      direction: "apply",
    });

    transaction.balance_after_transaction = balanceAfter;
    await transaction.save();

    const populated = await Transaction.findById(transaction._id)
      .populate("account", "name kind")
      .populate("category_id", "name type")
      .lean();

    res.json({ transaction: populated });
  } catch (error) {
    next(error);
  }
};
