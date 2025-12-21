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
        .filter(Boolean)
    )
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
    ])
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
        "view_transactions"
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
        organizationId,
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
      .populate("party", "name code type")
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
        "view_transactions"
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
        "create_transactions"
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
      organization,
    } = req.body;

    // Check organization access if provided
    if (organization) {
      const access = await checkOrgAccess(
        req.user.id,
        organization,
        "create_transactions"
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

    const transaction = await Transaction.findById(transactionId);

    if (!transaction || transaction.is_deleted) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Check access
    if (transaction.organization) {
      const access = await checkOrgAccess(
        req.user.id,
        transaction.organization,
        "edit_transactions"
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

    await adjustAccountBalance({
      account: originalAccount,
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
            const otherAccount = await loadAccount({
              adminId: req.user.id,
              accountId: otherTxn.account,
              organizationId,
            });

            if (otherAccount) {
              // Revert old amount on other account
              await adjustAccountBalance({
                account: otherAccount,
                amount: otherTxn.amount,
                type: otherTxn.type,
                direction: "revert",
              });

              // Update other transaction amount
              otherTxn.amount = amount;

              // Apply new amount on other account
              const otherBalance = await adjustAccountBalance({
                account: otherAccount,
                amount: otherTxn.amount,
                type: otherTxn.type,
                direction: "apply",
              });

              otherTxn.balance_after_transaction = otherBalance;
              await otherTxn.save();
            }
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

    const transaction = await Transaction.findById(transactionId);

    if (!transaction || transaction.is_deleted) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Check access
    if (transaction.organization) {
      const access = await checkOrgAccess(
        req.user.id,
        transaction.organization,
        "delete_transactions"
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
      await adjustAccountBalance({
        account,
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
          const otherAccount = await loadAccount({
            adminId: req.user.id,
            accountId: otherTxn.account,
            organizationId,
          });

          if (otherAccount) {
            await adjustAccountBalance({
              account: otherAccount,
              amount: otherTxn.amount,
              type: otherTxn.type,
              direction: "revert",
            });
          }

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
        "edit_transactions"
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

export const recalculateBalances = async (req, res, next) => {
  try {
    const adminId = req.user.id;

    // Get all accounts for this admin
    const accounts = await Account.find({ admin: adminId })
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

    // Process each account separately
    for (const account of accounts) {
      // Get all non-deleted transactions for this account, sorted chronologically
      const transactions = await Transaction.find({
        admin: adminId,
        account: account._id,
        is_deleted: { $ne: true },
      })
        .sort({ date: 1, createdAt: 1, _id: 1 })
        .select("_id type amount balance_after_transaction")
        .lean();

      if (transactions.length === 0) {
        continue;
      }

      // Start with the account's opening balance
      const accountDoc = await Account.findById(account._id);
      let runningBalance = Number(accountDoc.opening_balance ?? 0);

      // Recalculate balance for each transaction
      const bulkOps = [];
      for (const txn of transactions) {
        // Apply the transaction to the running balance
        if (txn.type === "credit") {
          runningBalance += Number(txn.amount ?? 0);
        } else {
          runningBalance -= Number(txn.amount ?? 0);
        }

        // Only update if the balance has changed
        if (txn.balance_after_transaction !== runningBalance) {
          bulkOps.push({
            updateOne: {
              filter: { _id: txn._id },
              update: { $set: { balance_after_transaction: runningBalance } },
            },
          });
          totalTransactionsUpdated++;
        }
      }

      // Execute bulk updates if there are any
      if (bulkOps.length > 0) {
        await Transaction.bulkWrite(bulkOps);
      }

      // Update account's current balance
      accountDoc.current_balance = runningBalance;
      await accountDoc.save();
    }

    res.json({
      message: "Balance recalculation completed successfully",
      accountsProcessed: accounts.length,
      transactionsUpdated: totalTransactionsUpdated,
    });
  } catch (error) {
    console.error("Balance recalculation error:", error);
    next(error);
  }
};

/**
 * Get all unique counterparties for the authenticated admin
 */
/**
 * Get all unique counterparties for the authenticated admin
 * Supports optional search query parameter
 */
export const listCounterparties = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const searchQuery = req.query.search?.trim().toLowerCase() || "";

    // Get all distinct counterparties
    const counterparties = await Transaction.distinct("counterparty", {
      admin: adminId,
      is_deleted: { $ne: true },
    });

    // Filter out empty/null values
    let filteredCounterparties = counterparties
      .filter((cp) => cp && typeof cp === "string" && cp.trim())
      .map((cp) => cp.trim());

    // Apply search filter if provided
    if (searchQuery) {
      filteredCounterparties = filteredCounterparties.filter((cp) =>
        cp.toLowerCase().includes(searchQuery)
      );
    }

    // Sort alphabetically
    const sortedCounterparties = filteredCounterparties.sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    res.json(sortedCounterparties);
  } catch (error) {
    console.error("List counterparties error:", error);
    next(error);
  }
};
