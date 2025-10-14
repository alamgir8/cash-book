import dayjs from "dayjs";
import mongoose from "mongoose";
import { Account } from "../models/Account.js";
import { Category } from "../models/Category.js";
import { Transaction } from "../models/Transaction.js";
import { Transfer } from "../models/Transfer.js";
import { buildTransactionFilters } from "../utils/filters.js";
import { resolveFinancialCategoryScope } from "../utils/financialCategories.js";
import { recomputeDescendingBalances } from "../utils/balance.js";

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
    req.headers.x_idempotency_key ||
    req.body?.client_request_id ||
    null
  );
};

const populateTransfer = ({ filter }) => {
  return Transfer.findOne(filter)
    .populate("from_account", "name kind")
    .populate("to_account", "name kind")
    .populate({
      path: "debit_transaction",
      populate: [
        { path: "account", select: "name kind" },
        { path: "category_id", select: "name type" },
      ],
    })
    .populate({
      path: "credit_transaction",
      populate: [
        { path: "account", select: "name kind" },
        { path: "category_id", select: "name type" },
      ],
    })
    .lean();
};

const applyTransferIdempotency = async ({ adminId, clientRequestId }) => {
  if (!clientRequestId) return null;
  return populateTransfer({
    filter: {
      admin: adminId,
      client_request_id: clientRequestId,
    },
  });
};

const extractAccountBalanceMap = async ({ adminId, transactions }) => {
  const accountIds = Array.from(
    new Set(
      transactions
        .map((txn) => {
          const accountRef = txn.account;
          if (!accountRef) return null;
          if (typeof accountRef === "string") return accountRef;
          if (accountRef instanceof mongoose.Types.ObjectId) {
            return accountRef.toString();
          }
          if (typeof accountRef === "object" && accountRef._id) {
            return accountRef._id.toString();
          }
          return null;
        })
        .filter(Boolean)
    )
  );

  if (accountIds.length === 0) {
    return new Map();
  }

  const accounts = await Account.find({
    admin: adminId,
    _id: { $in: accountIds },
  })
    .select("_id current_balance")
    .lean();

  return new Map(
    accounts.map((account) => [
      account._id.toString(),
      Number(account.current_balance ?? 0),
    ])
  );
};

export const listTransactions = async (req, res, next) => {
  try {
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
      query: req.query,
      categoryScope,
    });

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
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
      const accountBalances = await extractAccountBalanceMap({
        adminId: req.user.id,
        transactions: baseTransactions,
      });
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

    const transactionPayload = {
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
    };

    if (idempotencyKey) {
      transactionPayload.client_request_id = idempotencyKey;
    }

    const transaction = await Transaction.create(transactionPayload);

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

export const createTransfer = async (req, res, next) => {
  try {
    const {
      from_account_id: fromAccountIdAlias,
      fromAccountId,
      to_account_id: toAccountIdAlias,
      toAccountId,
      amount,
      date,
      description,
      keyword,
      counterparty,
      meta_data: metaData,
    } = req.body;

    const idempotencyKey = extractIdempotencyKey(req);
    const existingTransfer = await applyTransferIdempotency({
      adminId: req.user.id,
      clientRequestId: idempotencyKey,
    });
    if (existingTransfer) {
      return res.status(200).json({
        transfer: existingTransfer,
        idempotent: true,
      });
    }

    const sourceAccountId = fromAccountIdAlias ?? fromAccountId;
    const destinationAccountId = toAccountIdAlias ?? toAccountId;

    if (!sourceAccountId || !destinationAccountId) {
      return res.status(400).json({
        message: "Both source and destination accounts are required",
      });
    }

    if (sourceAccountId === destinationAccountId) {
      return res
        .status(400)
        .json({ message: "Source and destination accounts must differ" });
    }

    const [sourceAccount, destinationAccount] = await Promise.all([
      loadAccount({
        adminId: req.user.id,
        accountId: sourceAccountId,
      }),
      loadAccount({
        adminId: req.user.id,
        accountId: destinationAccountId,
      }),
    ]);

    if (!sourceAccount) {
      return res.status(404).json({ message: "Source account not found" });
    }

    if (!destinationAccount) {
      return res.status(404).json({ message: "Destination account not found" });
    }

    let transferDate;
    try {
      transferDate = parseTransactionDate(date);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    const transferId = new mongoose.Types.ObjectId();
    const outgoingDescription =
      description ?? `Transfer to ${destinationAccount.name}`;
    const incomingDescription =
      description ?? `Transfer from ${sourceAccount.name}`;
    const outgoingCounterparty = counterparty ?? destinationAccount.name;
    const incomingCounterparty = counterparty ?? sourceAccount.name;

    const debitTransaction = new Transaction({
      admin: req.user.id,
      account: sourceAccount._id,
      type: "debit",
      amount,
      date: transferDate,
      description: outgoingDescription,
      keyword,
      counterparty: outgoingCounterparty,
      meta_data: metaData,
      transfer_id: transferId,
      transfer_direction: "outgoing",
      client_request_id: `transfer:${transferId.toString()}:outgoing`,
    });

    const creditTransaction = new Transaction({
      admin: req.user.id,
      account: destinationAccount._id,
      type: "credit",
      amount,
      date: transferDate,
      description: incomingDescription,
      keyword,
      counterparty: incomingCounterparty,
      meta_data: metaData,
      transfer_id: transferId,
      transfer_direction: "incoming",
      client_request_id: `transfer:${transferId.toString()}:incoming`,
    });

    let sourceBalanceAdjusted = false;
    let destinationBalanceAdjusted = false;
    let debitTransactionSaved = false;
    let creditTransactionSaved = false;

    try {
      const sourceBalanceAfter = await adjustAccountBalance({
        account: sourceAccount,
        amount,
        type: "debit",
        direction: "apply",
      });
      sourceBalanceAdjusted = true;
      debitTransaction.balance_after_transaction = sourceBalanceAfter;
      await debitTransaction.save();
      debitTransactionSaved = true;

      const destinationBalanceAfter = await adjustAccountBalance({
        account: destinationAccount,
        amount,
        type: "credit",
        direction: "apply",
      });
      destinationBalanceAdjusted = true;
      creditTransaction.balance_after_transaction = destinationBalanceAfter;
      await creditTransaction.save();
      creditTransactionSaved = true;

      const transferDocument = new Transfer({
        _id: transferId,
        admin: req.user.id,
        from_account: sourceAccount._id,
        to_account: destinationAccount._id,
        amount,
        date: transferDate,
        description,
        keyword,
        counterparty,
        meta_data: metaData,
        debit_transaction: debitTransaction._id,
        credit_transaction: creditTransaction._id,
      });

      if (idempotencyKey) {
        transferDocument.client_request_id = idempotencyKey;
      }

      await transferDocument.save();

      const populatedTransfer = await populateTransfer({
        filter: { _id: transferDocument._id },
      });

      return res.status(201).json({ transfer: populatedTransfer });
    } catch (error) {
      if (creditTransactionSaved) {
        await Transaction.deleteOne({ _id: creditTransaction._id });
      }
      if (destinationBalanceAdjusted) {
        await adjustAccountBalance({
          account: destinationAccount,
          amount,
          type: "credit",
          direction: "revert",
        });
      }
      if (debitTransactionSaved) {
        await Transaction.deleteOne({ _id: debitTransaction._id });
      }
      if (sourceBalanceAdjusted) {
        await adjustAccountBalance({
          account: sourceAccount,
          amount,
          type: "debit",
          direction: "revert",
        });
      }
      throw error;
    }
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

    if (req.body.client_request_id) {
      transaction.client_request_id = req.body.client_request_id.trim();
    } else if (
      req.body.client_request_id === null ||
      req.body.client_request_id === ""
    ) {
      transaction.client_request_id = undefined;
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
