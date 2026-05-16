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
    const isDueFilter = String(req.query.payment_status ?? "").trim() === "due";
    if (isDueFilter) {
      filter.parent_due_id = { $exists: false };
      filter.due_remaining = { $gt: 0 };
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const skip = (page - 1) * limit;

    // ── SINGLE query with populate — eliminates the double-query pattern ──
    let [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate("account", "name kind")
        .populate("category_id", "name type")
        .populate("party", "name code type")
        .populate(
          "parent_due_id",
          "amount due_remaining due_settled_at date description vendor counterparty payment_status",
        )
        .sort({ date: -1, createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    if (isDueFilter && transactions.length > 0) {
      const rootIds = transactions.map((txn) => txn._id);
      const latestPayments = await Transaction.find({
        ...(organizationId
          ? { organization: new mongoose.Types.ObjectId(organizationId) }
          : {
              admin: new mongoose.Types.ObjectId(req.user.id),
              organization: { $exists: false },
            }),
        parent_due_id: { $in: rootIds },
        is_deleted: false,
      })
        .populate("account", "name kind")
        .populate("category_id", "name type")
        .populate("party", "name code type")
        .populate(
          "parent_due_id",
          "amount due_remaining due_settled_at date description vendor counterparty payment_status",
        )
        .sort({ date: -1, createdAt: -1, _id: -1 })
        .lean();

      const latestByRootId = new Map();
      for (const payment of latestPayments) {
        const rootId = payment.parent_due_id?._id?.toString?.();
        if (rootId && !latestByRootId.has(rootId)) {
          latestByRootId.set(rootId, payment);
        }
      }

      transactions = transactions.map(
        (root) => latestByRootId.get(root._id.toString()) ?? root,
      );
    }

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
      .populate(
        "parent_due_id",
        "amount due_remaining due_settled_at date description vendor counterparty payment_status",
      )
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
      vendor,
      payment_status = "paid",
      due_date,
      parent_due_id, // link this payment to an existing due transaction
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

    // ── Due-chain: validate parent due transaction ──────────────────────
    let parentDue = null;
    if (parent_due_id) {
      parentDue = await Transaction.findById(parent_due_id);
      if (!parentDue || parentDue.is_deleted) {
        return res
          .status(404)
          .json({ message: "Parent due transaction not found" });
      }
      if (parentDue.admin.toString() !== req.user.id) {
        return res
          .status(403)
          .json({ message: "Access denied to parent due transaction" });
      }
      if (parentDue.payment_status !== "due") {
        return res
          .status(400)
          .json({ message: "Parent transaction is not a due transaction" });
      }
      const currentRemaining = parentDue.due_remaining ?? parentDue.amount;
      if (Number(amount) > currentRemaining + 0.001) {
        return res.status(400).json({
          message: `Payment amount (${amount}) exceeds remaining due amount (${currentRemaining})`,
        });
      }
    }
    // ────────────────────────────────────────────────────────────────────

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
      vendor,
      payment_status: parent_due_id ? "paid" : payment_status, // payments against due are always "paid"
      due_date: due_date ? new Date(due_date) : undefined,
      meta_data: metaData,
    };

    // Inherit vendor/counterparty from parent due if not explicitly provided
    if (parentDue) {
      if (!transactionPayload.vendor && parentDue.vendor) {
        transactionPayload.vendor = parentDue.vendor;
      }
      if (!transactionPayload.counterparty && parentDue.counterparty) {
        transactionPayload.counterparty = parentDue.counterparty;
      }
      transactionPayload.parent_due_id = parentDue._id;
      transactionPayload.due_group_id = parentDue.due_group_id ?? parentDue._id;
    }

    if (idempotencyKey) {
      transactionPayload.client_request_id = idempotencyKey;
    }

    const transaction = await Transaction.create(transactionPayload);

    // For new "due" transactions, set due_group_id = own _id and due_remaining = amount
    if (payment_status === "due" && !parent_due_id) {
      transaction.due_group_id = transaction._id;
      transaction.due_remaining = Number(amount);
    }

    // Adjust account balance:
    //  - Due transaction: no cash moved yet
    //  - Payment against a due: cash is paid now, adjust balance
    //  - Regular paid: adjust balance
    const resolvedStatus = transactionPayload.payment_status;
    if (resolvedStatus !== "due") {
      const balanceAfter = await adjustAccountBalanceAtomic({
        accountId: account._id,
        amount,
        type,
        direction: "apply",
      });
      transaction.balance_after_transaction = balanceAfter;
    } else {
      const freshAccount = await Account.findById(account._id);
      transaction.balance_after_transaction =
        freshAccount?.current_balance ?? account.current_balance;
    }
    await transaction.save();

    // ── Update parent due transaction's remaining balance ───────────────
    if (parentDue) {
      const prevRemaining = parentDue.due_remaining ?? parentDue.amount;
      const newRemaining = Math.max(0, prevRemaining - Number(amount));
      parentDue.due_remaining = newRemaining;
      if (newRemaining === 0) {
        parentDue.due_settled_at = txnDate;
      }
      await parentDue.save();
    }
    // ────────────────────────────────────────────────────────────────────

    const populated = await Transaction.findById(transaction._id)
      .populate("account", "name kind")
      .populate("category_id", "name type")
      .populate(
        "parent_due_id",
        "amount due_remaining date description vendor counterparty",
      )
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
      vendor,
      payment_status: newPaymentStatus,
      due_date,
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

    // ── Pre-parse date outside session to catch validation errors early ──
    let parsedDate;
    if (date !== undefined) {
      try {
        parsedDate = parseTransactionDate(date);
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    // ── Snapshot values before mutation for the session ──
    const originalAmount = transaction.amount;
    const originalType = transaction.type;
    const originalAccountId = originalAccount._id;
    const targetAccountId = targetAccount._id;
    const isAccountChange =
      targetAccountId.toString() !== originalAccountId.toString();
    const oldPaymentStatus = transaction.payment_status || "paid";

    // ── Apply all balance mutations + document saves inside a single session ──
    const session = await mongoose.startSession();
    let savedTransaction;
    try {
      await session.withTransaction(async () => {
        // 1. Revert original balance impact (only if previously paid — due had no impact)
        if (oldPaymentStatus !== "due") {
          await adjustAccountBalanceAtomic({
            accountId: originalAccountId,
            amount: originalAmount,
            type: originalType,
            direction: "revert",
            session,
          });
        }

        // 2. Handle Transfer sibling updates
        if (transaction.transfer_id) {
          const transferFilter = organizationId
            ? { _id: transaction.transfer_id, organization: organizationId }
            : { _id: transaction.transfer_id, admin: req.user.id };

          const transfer =
            await Transfer.findOne(transferFilter).session(session);

          if (transfer) {
            let transferUpdated = false;

            const otherTxnId =
              transaction.transfer_direction === "outgoing"
                ? transfer.credit_transaction
                : transfer.debit_transaction;

            const otherTxn =
              await Transaction.findById(otherTxnId).session(session);

            // 2a. Amount change — revert+re-apply sibling atomically
            if (
              amount !== undefined &&
              Number(amount) !== Number(transfer.amount)
            ) {
              transfer.amount = amount;
              transferUpdated = true;

              if (otherTxn) {
                await adjustAccountBalanceAtomic({
                  accountId: otherTxn.account,
                  amount: otherTxn.amount,
                  type: otherTxn.type,
                  direction: "revert",
                  session,
                });
                otherTxn.amount = amount;
                const otherBalance = await adjustAccountBalanceAtomic({
                  accountId: otherTxn.account,
                  amount: otherTxn.amount,
                  type: otherTxn.type,
                  direction: "apply",
                  session,
                });
                otherTxn.balance_after_transaction = otherBalance;
                await otherTxn.save({ session });
              }
            }

            // 2b. Date change — keep sibling in sync
            if (
              parsedDate &&
              parsedDate.getTime() !== new Date(transfer.date).getTime()
            ) {
              transfer.date = parsedDate;
              transferUpdated = true;
              if (otherTxn) {
                otherTxn.date = parsedDate;
                await otherTxn.save({ session });
              }
            }

            // 2c. Account change — update transfer routing
            if (isAccountChange) {
              if (transaction.transfer_direction === "outgoing") {
                transfer.from_account = targetAccountId;
              } else {
                transfer.to_account = targetAccountId;
              }
              transferUpdated = true;
            }

            if (transferUpdated) {
              await transfer.save({ session });
            }
          }
        }

        // 3. Apply field updates to the main transaction
        if (isAccountChange) {
          transaction.account = targetAccountId;
        }
        if (type) transaction.type = type;
        if (amount !== undefined) transaction.amount = amount;
        if (parsedDate !== undefined) transaction.date = parsedDate;
        if (description !== undefined) transaction.description = description;
        if (keyword !== undefined) transaction.keyword = keyword;
        if (counterparty !== undefined) transaction.counterparty = counterparty;
        if (vendor !== undefined) transaction.vendor = vendor;
        if (due_date !== undefined)
          transaction.due_date = due_date ? new Date(due_date) : null;
        if (newPaymentStatus !== undefined)
          transaction.payment_status = newPaymentStatus;
        if (metaData !== undefined) transaction.meta_data = metaData;

        if (req.body.client_request_id) {
          transaction.client_request_id = req.body.client_request_id.trim();
        } else if (
          req.body.client_request_id === null ||
          req.body.client_request_id === ""
        ) {
          transaction.client_request_id = undefined;
        }

        // 4. Apply new balance impact (conditional on payment_status)
        const resolvedPaymentStatus = transaction.payment_status || "paid";
        if (resolvedPaymentStatus !== "due") {
          const balanceAfter = await adjustAccountBalanceAtomic({
            accountId: targetAccountId,
            amount: transaction.amount,
            type: transaction.type,
            direction: "apply",
            session,
          });
          transaction.balance_after_transaction = balanceAfter;
        } else {
          // Due: no cash moved, record current balance without changing it
          const freshAccount =
            await Account.findById(targetAccountId).session(session);
          transaction.balance_after_transaction = freshAccount?.current_balance;
        }
        await transaction.save({ session });
        savedTransaction = transaction._id;
      });
    } finally {
      await session.endSession();
    }

    const populated = await Transaction.findById(savedTransaction)
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

    // ── Wrap all balance mutations + soft-deletes in an atomic session ──
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Only revert balance if the transaction was actually paid (due = no cash moved)
        if (account && (transaction.payment_status || "paid") !== "due") {
          await adjustAccountBalanceAtomic({
            accountId: account._id,
            amount: transaction.amount,
            type: transaction.type,
            direction: "revert",
            session,
          });
        }

        // Handle Transfer deletion — revert sibling leg atomically
        if (transaction.transfer_id) {
          const transferFilter = organizationId
            ? { _id: transaction.transfer_id, organization: organizationId }
            : { _id: transaction.transfer_id, admin: req.user.id };

          const transfer =
            await Transfer.findOne(transferFilter).session(session);

          if (transfer) {
            const otherTxnId =
              transaction.transfer_direction === "outgoing"
                ? transfer.credit_transaction
                : transfer.debit_transaction;

            const otherTxn =
              await Transaction.findById(otherTxnId).session(session);

            if (otherTxn && !otherTxn.is_deleted) {
              await adjustAccountBalanceAtomic({
                accountId: otherTxn.account,
                amount: otherTxn.amount,
                type: otherTxn.type,
                direction: "revert",
                session,
              });
              otherTxn.softDelete();
              await otherTxn.save({ session });
            }

            await Transfer.deleteOne({ _id: transfer._id }).session(session);
          }
        }

        transaction.softDelete();
        await transaction.save({ session });

        // ── If this is a payment against a due transaction, restore its remaining ──
        if (transaction.parent_due_id) {
          const parentDueId =
            typeof transaction.parent_due_id === "object"
              ? transaction.parent_due_id._id
              : transaction.parent_due_id;

          const parentDue =
            await Transaction.findById(parentDueId).session(session);
          if (parentDue && parentDue.payment_status === "due") {
            const currentRemaining =
              parentDue.due_remaining ?? parentDue.amount;
            const restoredRemaining = Math.min(
              currentRemaining + transaction.amount,
              parentDue.amount,
            );
            parentDue.due_remaining = restoredRemaining;
            // Clear settled_at if it's no longer fully paid
            if (restoredRemaining > 0) {
              parentDue.due_settled_at = undefined;
            }
            await parentDue.save({ session });
          }
        }
      });
    } finally {
      await session.endSession();
    }

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

    const session = await mongoose.startSession();
    let savedId;
    try {
      await session.withTransaction(async () => {
        const balanceAfter = await adjustAccountBalanceAtomic({
          accountId: account._id,
          amount: transaction.amount,
          type: transaction.type,
          direction: "apply",
          session,
        });
        transaction.balance_after_transaction = balanceAfter;
        await transaction.save({ session });
        savedId = transaction._id;

        // ── If this is a payment against a due transaction, re-deduct due_remaining ──
        if (transaction.parent_due_id) {
          const parentDueId =
            typeof transaction.parent_due_id === "object"
              ? transaction.parent_due_id._id
              : transaction.parent_due_id;

          const parentDue =
            await Transaction.findById(parentDueId).session(session);
          if (parentDue && parentDue.payment_status === "due") {
            const currentRemaining =
              parentDue.due_remaining ?? parentDue.amount;
            const newRemaining = Math.max(
              0,
              currentRemaining - transaction.amount,
            );
            parentDue.due_remaining = newRemaining;
            if (newRemaining === 0 && !parentDue.due_settled_at) {
              parentDue.due_settled_at = transaction.date;
            }
            await parentDue.save({ session });
          }
        }
      });
    } finally {
      await session.endSession();
    }

    const populated = await Transaction.findById(savedId)
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
      { $match: { counterparty: { $exists: true, $nin: [null, ""] } } },
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

/**
 * Get all unique vendors for the authenticated admin
 */
export const listVendors = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const organizationId = getOrgFromRequest(req);
    const searchQuery = req.query.search?.trim().toLowerCase() || "";

    const distinctFilter = organizationId
      ? {
          organization: new mongoose.Types.ObjectId(organizationId),
          is_deleted: { $ne: true },
        }
      : {
          admin: new mongoose.Types.ObjectId(adminId),
          is_deleted: { $ne: true },
        };

    const pipeline = [
      { $match: distinctFilter },
      { $match: { vendor: { $exists: true, $nin: [null, ""] } } },
      {
        $group: {
          _id: { $toLower: { $trim: { input: "$vendor" } } },
          name: { $first: { $trim: { input: "$vendor" } } },
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
    res.json(results.map((r) => r.name));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /transactions/counterparty-ledger?counterparty=মসজিদ
 *
 * Returns a unified running ledger filtered to ONLY the 4 loan categories:
 *
 *   Loan Received           (credit) → I borrowed from them  → increases what I owe
 *   Loan Repayment Paid     (debit)  → I paid them back      → decreases what I owe
 *   Loan Given              (debit)  → I lent to them        → increases what they owe me
 *   Loan Repayment Received (credit) → they paid me back     → decreases what they owe me
 *
 * Two separate running balances are maintained:
 *   owedByMe   = Loan Received  − Loan Repayment Paid     (I owe the counterparty)
 *   owedByThem = Loan Given     − Loan Repayment Received (they owe me)
 *
 * Combined running_balance = owedByThem − owedByMe  (positive = net they owe me)
 */
export const getCounterpartyLedger = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { counterparty } = req.query;

    if (!counterparty) {
      return res
        .status(400)
        .json({ message: "counterparty query param required" });
    }

    // ── Resolve the 4 loan category IDs that belong to this admin ────────────
    // We look up categories by type so we're not hard-coding IDs.
    const loanCategoryDocs = await Category.find({
      admin: adminId,
      type: { $in: ["loan_in", "loan_out"] },
    })
      .select("_id name type")
      .lean();

    // Build lookup maps
    const loanCategoryIds = loanCategoryDocs.map((c) => c._id);
    const catTypeById = {};
    for (const c of loanCategoryDocs) {
      catTypeById[c._id.toString()] = c.type; // "loan_in" | "loan_out"
    }
    const catNameById = {};
    for (const c of loanCategoryDocs) {
      catNameById[c._id.toString()] = c.name;
    }

    // ── Fetch ONLY loan-category transactions for this counterparty ───────────
    const txns = await Transaction.find({
      admin: adminId,
      counterparty: counterparty,
      category_id: { $in: loanCategoryIds },
      is_deleted: { $ne: true },
    })
      .populate("account", "name kind")
      .populate("category_id", "name type")
      .sort({ date: 1, createdAt: 1 })
      .lean();

    let owedByMe = 0; // I owe the counterparty
    let owedByThem = 0; // Counterparty owes me
    let totalBorrowed = 0; // sum of Loan Received
    let totalRepaid = 0; // sum of Loan Repayment Paid
    let totalGiven = 0; // sum of Loan Given
    let totalReceived = 0; // sum of Loan Repayment Received

    // Calculate running balance oldest→newest
    const timeline = txns.map((t) => {
      const catId =
        t.category_id?._id?.toString() ?? t.category_id?.toString() ?? "";
      const catName = catNameById[catId] ?? "";
      const catType = catTypeById[catId] ?? "";

      let entry_type;

      if (catName === "Loan Received") {
        // I borrowed from counterparty → I owe more
        owedByMe += t.amount;
        totalBorrowed += t.amount;
        entry_type = "borrow"; // label: "Borrowed"
      } else if (catName === "Loan Repayment Paid") {
        // I paid counterparty back → I owe less
        // Track full amount paid (even if it temporarily over-clears) for accurate total display
        totalRepaid += t.amount;
        owedByMe = Math.max(0, owedByMe - t.amount);
        entry_type = "repayment"; // label: "Repaid"
      } else if (catName === "Loan Given") {
        // I lent to counterparty → they owe me more
        owedByThem += t.amount;
        totalGiven += t.amount;
        entry_type = "loan_given"; // label: "Loan Given"
      } else if (catName === "Loan Repayment Received") {
        // Counterparty paid me back → they owe me less
        // Track full amount received for accurate total display
        totalReceived += t.amount;
        owedByThem = Math.max(0, owedByThem - t.amount);
        entry_type = "loan_received_back"; // label: "Repaid to me"
      } else {
        // Fallback by type field (shouldn't normally hit)
        if (catType === "loan_in") {
          owedByMe += t.amount;
          totalBorrowed += t.amount;
          entry_type = "borrow";
        } else {
          owedByThem += t.amount;
          totalGiven += t.amount;
          entry_type = "loan_given";
        }
      }

      // Net running balance: positive = they owe me, negative = I owe them
      const running_balance = owedByThem - owedByMe;

      return {
        ...t,
        entry_type,
        running_balance,
      };
    });

    // Reverse for newest-first display
    timeline.reverse();

    const outstanding = owedByThem + owedByMe; // total unsettled on both sides
    // Net from user's perspective: positive = I owe them, negative = they owe me
    const netOwedByMe = owedByMe - owedByThem;

    res.json({
      counterparty,
      timeline,
      summary: {
        // "Borrowed" side: I took loans from them
        total_borrowed: totalBorrowed,
        total_repaid: totalRepaid,
        // "Given" side: I gave loans to them
        total_given: totalGiven,
        total_received_back: totalReceived,
        // Combined outstanding
        outstanding,
        net_owed_by_me: netOwedByMe, // positive = I owe them, negative = they owe me
        owed_by_me: owedByMe,
        owed_by_them: owedByThem,
        transaction_count: txns.length,
        is_settled: owedByMe === 0 && owedByThem === 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /transactions/:transactionId/due-chain
 *
 * Returns the full chain for a due or payment transaction:
 *   - The original due transaction
 *   - All payment transactions linked to it (sorted by date asc)
 *   - A running balance showing what was remaining after each payment
 */
export const getDueChain = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const adminId = req.user.id;

    // Load the requested transaction
    const txn = await Transaction.findById(transactionId)
      .populate("account", "name kind")
      .populate("category_id", "name type")
      .lean();

    if (!txn || txn.is_deleted) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Access check
    if (txn.admin.toString() !== adminId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Resolve the root id — works whether we're looking at the root or a payment
    // parent_due_id on this txn means it IS a payment; follow up to the root
    const rootId = txn.parent_due_id ? txn.parent_due_id : txn._id;
    const rootIdStr = rootId.toString();

    // Fetch all non-deleted transactions in the chain.
    // Covers three storage layouts:
    //  1) Proper chains: payments have due_group_id = root._id (ObjectId or string)
    //  2) Migrated chains: payments only have parent_due_id = root._id (no due_group_id)
    //  3) Root itself (always included via _id match)
    const chainRaw = await Transaction.find({
      $or: [
        { _id: rootId },
        { due_group_id: rootId },
        { due_group_id: rootIdStr },
        { parent_due_id: rootId },
        { parent_due_id: rootIdStr },
      ],
      is_deleted: { $ne: true },
    })
      .populate("account", "name kind")
      .populate("category_id", "name type")
      .sort({ date: 1, createdAt: 1 })
      .lean();

    // The root/original due transaction
    const root =
      chainRaw.find(
        (t) => t._id.toString() === rootIdStr && t.payment_status === "due",
      ) ??
      chainRaw.find((t) => t._id.toString() === rootIdStr) ??
      chainRaw[0];

    // Payment transactions only (has parent_due_id)
    const payments = chainRaw.filter((t) => t.parent_due_id != null);

    // Build running balance entries
    const originalAmount = root?.amount ?? 0;
    let running = originalAmount;
    const timeline = payments.map((p) => {
      running = Math.max(0, running - p.amount);
      return { ...p, remaining_after: running };
    });

    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(0, originalAmount - totalPaid);

    res.json({
      root,
      payments: timeline,
      summary: {
        original_amount: originalAmount,
        total_paid: totalPaid,
        remaining,
        is_settled: remaining === 0,
        settled_at: root?.due_settled_at ?? null,
        payment_count: payments.length,
      },
    });
  } catch (error) {
    next(error);
  }
};
