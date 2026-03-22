import dayjs from "dayjs";
import mongoose from "mongoose";
import { Account } from "../models/Account.js";
import { Category } from "../models/Category.js";
import { Transaction } from "../models/Transaction.js";
import { Transfer } from "../models/Transfer.js";
import { buildTransactionFilters } from "../utils/filters.js";
import { resolveFinancialCategoryScope } from "../utils/financialCategories.js";
import { recomputeDescendingBalances } from "../utils/balance.js";
import { checkOrgAccess, getOrgFromRequest } from "../utils/organization.js";

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

/**
 * Atomic balance update using findOneAndUpdate + $inc to prevent race conditions.
 * Returns the *new* balance after the update.
 */
const adjustAccountBalanceAtomic = async ({
  accountId,
  amount,
  type,
  direction = "apply",
  session = null,
}) => {
  const delta = type === "credit" ? amount : -amount;
  const finalDelta = direction === "revert" ? -delta : delta;
  const opts = { new: true, ...(session ? { session } : {}) };
  const updated = await Account.findByIdAndUpdate(
    accountId,
    { $inc: { current_balance: finalDelta } },
    opts,
  );
  if (!updated) {
    throw Object.assign(new Error("Account not found for balance update"), {
      statusCode: 404,
    });
  }
  return updated.current_balance;
};

const loadAccount = async ({ adminId, accountId, organizationId }) => {
  if (organizationId) {
    return Account.findOne({
      _id: accountId,
      organization: organizationId,
    });
  }
  return Account.findOne({
    _id: accountId,
    admin: adminId,
  });
};

const loadCategory = async ({ adminId, categoryId, organizationId }) => {
  if (!categoryId) return null;
  if (organizationId) {
    return Category.findOne({
      _id: categoryId,
      organization: organizationId,
      archived: { $ne: true },
    });
  }
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

const extractAccountBalanceMap = async ({
  adminId,
  organizationId,
  transactions,
}) => {
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
        .filter(Boolean),
    ),
  );

  if (accountIds.length === 0) {
    return new Map();
  }

  const filter = organizationId
    ? { organization: organizationId, _id: { $in: accountIds } }
    : { admin: adminId, _id: { $in: accountIds } };

  const accounts = await Account.find(filter)
    .select("_id current_balance")
    .lean();

  return new Map(
    accounts.map((account) => [
      account._id.toString(),
      Number(account.current_balance ?? 0),
    ]),
  );
};

export const listTransactions = async (req, res, next) => {
  try {
    const organizationId = getOrgFromRequest(req);

    // Check organization access if provided
    if (organizationId) {
      const access = await checkOrgAccess(
        req.user.id,
        organizationId,
        "view_transactions",
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
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
      organizationId,
      query: req.query,
      categoryScope,
    });

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const skip = (page - 1) * limit;

    // ── SINGLE query with populate — eliminates the double-query pattern ──
    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate("account", "name kind")
        .populate("category_id", "name type")
        .populate("party", "name code type")
        .sort({ date: -1, createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    // Compute running balances only for the current page
    if (transactions.length > 0) {
      const accountBalances = await extractAccountBalanceMap({
        adminId: req.user.id,
        organizationId,
        transactions,
      });

      // We need all transactions from page 1 to current page to compute balances
      // but for performance, fetch only minimal fields for balance computation
      if (skip > 0) {
        const priorTransactions = await Transaction.find(filter)
          .sort({ date: -1, createdAt: -1, _id: -1 })
          .limit(skip)
          .select("_id account amount type")
          .lean();

        // Apply prior transactions to account balances first
        recomputeDescendingBalances({
          transactions: priorTransactions,
          accountBalances,
        });

        // Now compute balances for current page starting from adjusted balances
        const adjustedBalances = new Map();
        priorTransactions.forEach((txn) => {
          const accountId =
            typeof txn.account === "object" && txn.account?._id
              ? txn.account._id.toString()
              : txn.account?.toString();
          if (accountId && typeof txn.balance_after_transaction === "number") {
            // The last balance in the prior set is the starting point
          }
        });

        // Reconstruct running balances after prior deductions
        for (const [accId, bal] of accountBalances) {
          adjustedBalances.set(accId, bal);
        }

        // Recompute through prior transactions to find where each account's balance is
        const priorRunning = new Map();
        for (const txn of priorTransactions) {
          const accountId =
            typeof txn.account === "string"
              ? txn.account
              : txn.account?.toString();
          if (!accountId) continue;

          let currentBal = priorRunning.get(accountId);
          if (currentBal === undefined) {
            currentBal = accountBalances.get(accountId) ?? 0;
          }

          // After this txn, the balance changes
          if (txn.type === "credit") {
            currentBal -= Number(txn.amount ?? 0);
          } else {
            currentBal += Number(txn.amount ?? 0);
          }
          priorRunning.set(accountId, currentBal);
        }

        // Use the end-of-prior-page balances as starting point for current page
        const currentPageBalances =
          priorRunning.size > 0 ? priorRunning : accountBalances;

        recomputeDescendingBalances({
          transactions,
          accountBalances: currentPageBalances,
        });
      } else {
        recomputeDescendingBalances({ transactions, accountBalances });
      }
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

    const transaction = await Transaction.findById(transactionId)
      .populate("account", "name kind")
      .populate("category_id", "name type")
      .populate("party", "name code type")
      .lean();

    if (!transaction || transaction.is_deleted) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Check access
    if (transaction.organization) {
      const access = await checkOrgAccess(
        req.user.id,
        transaction.organization,
        "view_transactions",
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    } else if (transaction.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
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
      organization,
      party,
    } = req.body;

    // Check organization access if provided
    if (organization) {
      const access = await checkOrgAccess(
        req.user.id,
        organization,
        "create_transactions",
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    }

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
      organizationId: organization,
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
        organizationId: organization,
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
      organization,
      account: account._id,
      category_id: categoryDocument?._id,
      party,
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

    const balanceAfter = await adjustAccountBalanceAtomic({
      accountId: account._id,
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
      organization,
    } = req.body;

    // Check organization access if provided
    if (organization) {
      const access = await checkOrgAccess(
        req.user.id,
        organization,
        "create_transactions",
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    }

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
        organizationId: organization,
      }),
      loadAccount({
        adminId: req.user.id,
        accountId: destinationAccountId,
        organizationId: organization,
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

    // ── Atomic transfer using MongoDB session ───────────────
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const debitTransaction = new Transaction({
          admin: req.user.id,
          organization,
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
          organization,
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

        // Atomic balance updates
        const sourceBalanceAfter = await adjustAccountBalanceAtomic({
          accountId: sourceAccount._id,
          amount,
          type: "debit",
          direction: "apply",
          session,
        });
        debitTransaction.balance_after_transaction = sourceBalanceAfter;
        await debitTransaction.save({ session });

        const destinationBalanceAfter = await adjustAccountBalanceAtomic({
          accountId: destinationAccount._id,
          amount,
          type: "credit",
          direction: "apply",
          session,
        });
        creditTransaction.balance_after_transaction = destinationBalanceAfter;
        await creditTransaction.save({ session });

        const transferDocument = new Transfer({
          _id: transferId,
          admin: req.user.id,
          organization,
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

        await transferDocument.save({ session });
      });
    } finally {
      await session.endSession();
    }

    const populatedTransfer = await populateTransfer({
      filter: { _id: transferId },
    });

    return res.status(201).json({ transfer: populatedTransfer });
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

    const transaction = await Transaction.findById(transactionId);

    if (!transaction || transaction.is_deleted) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Check access
    if (transaction.organization) {
      const access = await checkOrgAccess(
        req.user.id,
        transaction.organization,
        "edit_transactions",
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    } else if (transaction.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const organizationId = transaction.organization;

    const originalAccount = await loadAccount({
      adminId: req.user.id,
      accountId: transaction.account,
      organizationId,
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
        organizationId,
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
          organizationId,
        });
        if (!categoryDoc) {
          return res.status(404).json({ message: "Category not found" });
        }
        transaction.category_id = categoryDoc._id;
      }
    }

    await adjustAccountBalanceAtomic({
      accountId: originalAccount._id,
      amount: transaction.amount,
      type: transaction.type,
      direction: "revert",
    });

    if (targetAccount._id.toString() !== originalAccount._id.toString()) {
      transaction.account = targetAccount._id;
    }

    // Handle Transfer updates if this transaction is part of a transfer
    if (transaction.transfer_id) {
      const transferFilter = organizationId
        ? { _id: transaction.transfer_id, organization: organizationId }
        : { _id: transaction.transfer_id, admin: req.user.id };

      const transfer = await Transfer.findOne(transferFilter);

      if (transfer) {
        let transferUpdated = false;

        // 1. Handle Amount Change
        if (
          amount !== undefined &&
          Number(amount) !== Number(transfer.amount)
        ) {
          transfer.amount = amount;
          transferUpdated = true;

          // Update the OTHER transaction in the pair
          const otherTxnId =
            transaction.transfer_direction === "outgoing"
              ? transfer.credit_transaction
              : transfer.debit_transaction;

          const otherTxn = await Transaction.findById(otherTxnId);
          if (otherTxn) {
            // Revert old amount on other account atomically
            await adjustAccountBalanceAtomic({
              accountId: otherTxn.account,
              amount: otherTxn.amount,
              type: otherTxn.type,
              direction: "revert",
            });

            // Update other transaction amount
            otherTxn.amount = amount;

            // Apply new amount on other account atomically
            const otherBalance = await adjustAccountBalanceAtomic({
              accountId: otherTxn.account,
              amount: otherTxn.amount,
              type: otherTxn.type,
              direction: "apply",
            });

            otherTxn.balance_after_transaction = otherBalance;
            await otherTxn.save();
          }
        }

        // 2. Handle Date Change
        if (date !== undefined) {
          let newDate;
          try {
            newDate = parseTransactionDate(date);
          } catch (e) {
            // Ignore error here, will be caught later
          }

          if (
            newDate &&
            newDate.getTime() !== new Date(transfer.date).getTime()
          ) {
            transfer.date = newDate;
            transferUpdated = true;

            const otherTxnId =
              transaction.transfer_direction === "outgoing"
                ? transfer.credit_transaction
                : transfer.debit_transaction;

            await Transaction.updateOne({ _id: otherTxnId }, { date: newDate });
          }
        }

        // 3. Handle Account Change
        if (targetAccount._id.toString() !== originalAccount._id.toString()) {
          if (transaction.transfer_direction === "outgoing") {
            transfer.from_account = targetAccount._id;
          } else {
            transfer.to_account = targetAccount._id;
          }
          transferUpdated = true;
        }

        if (transferUpdated) {
          await transfer.save();
        }
      }
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

    const balanceAfter = await adjustAccountBalanceAtomic({
      accountId: targetAccount._id,
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

    const transaction = await Transaction.findById(transactionId);

    if (!transaction || transaction.is_deleted) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Check access
    if (transaction.organization) {
      const access = await checkOrgAccess(
        req.user.id,
        transaction.organization,
        "delete_transactions",
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    } else if (transaction.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const organizationId = transaction.organization;

    const account = await loadAccount({
      adminId: req.user.id,
      accountId: transaction.account,
      organizationId,
    });

    if (account) {
      await adjustAccountBalanceAtomic({
        accountId: account._id,
        amount: transaction.amount,
        type: transaction.type,
        direction: "revert",
      });
    }

    // Handle Transfer deletion if this transaction is part of a transfer
    if (transaction.transfer_id) {
      const transferFilter = organizationId
        ? { _id: transaction.transfer_id, organization: organizationId }
        : { _id: transaction.transfer_id, admin: req.user.id };

      const transfer = await Transfer.findOne(transferFilter);

      if (transfer) {
        const otherTxnId =
          transaction.transfer_direction === "outgoing"
            ? transfer.credit_transaction
            : transfer.debit_transaction;

        const otherTxn = await Transaction.findById(otherTxnId);

        if (otherTxn && !otherTxn.is_deleted) {
          await adjustAccountBalanceAtomic({
            accountId: otherTxn.account,
            amount: otherTxn.amount,
            type: otherTxn.type,
            direction: "revert",
          });

          otherTxn.softDelete();
          await otherTxn.save();
        }

        // Delete the transfer record as the transactions are deleted
        await Transfer.deleteOne({ _id: transfer._id });
      }
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
      is_deleted: true,
    });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Check access
    if (transaction.organization) {
      const access = await checkOrgAccess(
        req.user.id,
        transaction.organization,
        "edit_transactions",
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    } else if (transaction.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const organizationId = transaction.organization;

    const account = await loadAccount({
      adminId: req.user.id,
      accountId: transaction.account,
      organizationId,
    });

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    transaction.restore();

    const balanceAfter = await adjustAccountBalanceAtomic({
      accountId: account._id,
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

export const recalculateBalances = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const organizationId = getOrgFromRequest(req);

    // Build account filter for org or personal context
    const accountFilter = organizationId
      ? { organization: organizationId }
      : { admin: adminId, organization: { $exists: false } };

    const accounts = await Account.find(accountFilter)
      .select("_id name opening_balance")
      .lean();

    if (accounts.length === 0) {
      return res.status(200).json({
        message: "No accounts found",
        accountsProcessed: 0,
        transactionsUpdated: 0,
      });
    }

    let totalTransactionsUpdated = 0;
    const BATCH_SIZE = 500;

    // Process each account separately
    for (const account of accounts) {
      const txnFilter = organizationId
        ? {
            organization: organizationId,
            account: account._id,
            is_deleted: { $ne: true },
          }
        : {
            admin: adminId,
            account: account._id,
            is_deleted: { $ne: true },
          };

      // Stream transactions in batches to avoid OOM
      let runningBalance = Number(account.opening_balance ?? 0);
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        const transactions = await Transaction.find(txnFilter)
          .sort({ date: 1, createdAt: 1, _id: 1 })
          .skip(skip)
          .limit(BATCH_SIZE)
          .select("_id type amount balance_after_transaction")
          .lean();

        if (transactions.length === 0) {
          hasMore = false;
          break;
        }

        const bulkOps = [];
        for (const txn of transactions) {
          if (txn.type === "credit") {
            runningBalance += Number(txn.amount ?? 0);
          } else {
            runningBalance -= Number(txn.amount ?? 0);
          }

          if (txn.balance_after_transaction !== runningBalance) {
            bulkOps.push({
              updateOne: {
                filter: { _id: txn._id },
                update: {
                  $set: { balance_after_transaction: runningBalance },
                },
              },
            });
            totalTransactionsUpdated++;
          }
        }

        if (bulkOps.length > 0) {
          await Transaction.bulkWrite(bulkOps, { ordered: false });
        }

        skip += BATCH_SIZE;
        if (transactions.length < BATCH_SIZE) {
          hasMore = false;
        }
      }

      // Update account's current balance atomically
      await Account.findByIdAndUpdate(account._id, {
        $set: { current_balance: runningBalance },
      });
    }

    res.json({
      message: "Balance recalculation completed successfully",
      accountsProcessed: accounts.length,
      transactionsUpdated: totalTransactionsUpdated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all unique counterparties for the authenticated admin
 * Supports optional search query parameter and organization context
 */
export const listCounterparties = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const organizationId = getOrgFromRequest(req);
    const searchQuery = req.query.search?.trim().toLowerCase() || "";

    // Build filter for org or personal context
    const distinctFilter = organizationId
      ? {
          organization: new mongoose.Types.ObjectId(organizationId),
          is_deleted: { $ne: true },
        }
      : {
          admin: new mongoose.Types.ObjectId(adminId),
          is_deleted: { $ne: true },
        };

    // Use aggregation pipeline for better performance on large datasets
    const pipeline = [
      { $match: distinctFilter },
      { $match: { counterparty: { $exists: true, $ne: null, $ne: "" } } },
      {
        $group: {
          _id: { $toLower: { $trim: { input: "$counterparty" } } },
          name: { $first: { $trim: { input: "$counterparty" } } },
        },
      },
      ...(searchQuery
        ? [
            {
              $match: {
                _id: {
                  $regex: searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                  $options: "i",
                },
              },
            },
          ]
        : []),
      { $sort: { _id: 1 } },
      { $limit: 200 },
      { $project: { _id: 0, name: 1 } },
    ];

    const results = await Transaction.aggregate(pipeline);
    const sortedCounterparties = results.map((r) => r.name);

    res.json(sortedCounterparties);
  } catch (error) {
    next(error);
  }
};
