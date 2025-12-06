import { Account } from "../models/Account.js";
import { Category } from "../models/Category.js";
import { Transaction } from "../models/Transaction.js";
import { Transfer } from "../models/Transfer.js";
import { BalanceSnapshot } from "../models/BalanceSnapshot.js";
import mongoose from "mongoose";

/**
 * Export all user data as JSON backup
 */
export const exportBackup = async (req, res, next) => {
  try {
    const adminId = req.user.id;

    // Fetch all collections for this user
    const [accounts, categories, transactions, transfers, balanceSnapshots] =
      await Promise.all([
        Account.find({ admin: adminId }).lean(),
        Category.find({ admin: adminId }).lean(),
        Transaction.find({ admin: adminId }).lean(),
        Transfer.find({ admin: adminId }).lean(),
        BalanceSnapshot.find({ admin: adminId }).lean(),
      ]);

    const backup = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      data: {
        accounts: accounts.map((a) => ({
          ...a,
          _originalId: a._id.toString(),
          _id: undefined,
          admin: undefined,
        })),
        categories: categories.map((c) => ({
          ...c,
          _originalId: c._id.toString(),
          _id: undefined,
          admin: undefined,
        })),
        transactions: transactions.map((t) => ({
          ...t,
          _originalId: t._id.toString(),
          _originalAccountId: t.account_id?.toString(),
          _originalCategoryId: t.category_id?.toString(),
          _id: undefined,
          admin: undefined,
          account_id: undefined,
          category_id: undefined,
        })),
        transfers: transfers.map((tr) => ({
          ...tr,
          _originalId: tr._id.toString(),
          _originalFromAccountId: tr.from_account?.toString(),
          _originalToAccountId: tr.to_account?.toString(),
          _id: undefined,
          admin: undefined,
          from_account: undefined,
          to_account: undefined,
        })),
        balanceSnapshots: balanceSnapshots.map((bs) => ({
          ...bs,
          _originalId: bs._id.toString(),
          _originalAccountId: bs.account?.toString(),
          _id: undefined,
          admin: undefined,
          account: undefined,
        })),
      },
      summary: {
        accountsCount: accounts.length,
        categoriesCount: categories.length,
        transactionsCount: transactions.length,
        transfersCount: transfers.length,
        balanceSnapshotsCount: balanceSnapshots.length,
      },
    };

    res.json(backup);
  } catch (error) {
    next(error);
  }
};

/**
 * Import user data from JSON backup
 */
export const importBackup = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const adminId = req.user.id;
    const { data, version } = req.body;

    if (!data) {
      return res.status(400).json({ message: "No backup data provided" });
    }

    if (!version) {
      return res.status(400).json({ message: "Backup version is required" });
    }

    const { accounts, categories, transactions, transfers, balanceSnapshots } =
      data;

    // Validate required arrays
    if (!Array.isArray(accounts)) {
      return res.status(400).json({ message: "Invalid accounts data" });
    }
    if (!Array.isArray(categories)) {
      return res.status(400).json({ message: "Invalid categories data" });
    }
    if (!Array.isArray(transactions)) {
      return res.status(400).json({ message: "Invalid transactions data" });
    }

    // Maps to track old ID -> new ID relationships
    const accountIdMap = new Map();
    const categoryIdMap = new Map();

    // Import accounts
    const importedAccounts = [];
    for (const account of accounts) {
      const originalId = account._originalId;
      const newAccount = await Account.create(
        [
          {
            admin: adminId,
            name: account.name,
            type: account.type || "cash",
            balance: account.balance || 0,
            color: account.color,
            icon: account.icon,
            description: account.description,
            is_default: false, // Don't import as default
            archived: account.archived || false,
          },
        ],
        { session }
      );
      accountIdMap.set(originalId, newAccount[0]._id);
      importedAccounts.push(newAccount[0]);
    }

    // Import categories
    const importedCategories = [];
    for (const category of categories) {
      const originalId = category._originalId;

      // Check if category with same name and type already exists
      const existing = await Category.findOne({
        admin: adminId,
        name: category.name,
        type: category.type,
      }).session(session);

      if (existing) {
        categoryIdMap.set(originalId, existing._id);
        importedCategories.push(existing);
      } else {
        const newCategory = await Category.create(
          [
            {
              admin: adminId,
              name: category.name,
              type: category.type,
              flow: category.flow,
              color: category.color,
              description: category.description,
              archived: category.archived || false,
            },
          ],
          { session }
        );
        categoryIdMap.set(originalId, newCategory[0]._id);
        importedCategories.push(newCategory[0]);
      }
    }

    // Import transactions
    const importedTransactions = [];
    for (const transaction of transactions) {
      const accountId = accountIdMap.get(transaction._originalAccountId);
      const categoryId = categoryIdMap.get(transaction._originalCategoryId);

      if (!accountId) {
        console.warn(
          `Skipping transaction: account not found for ${transaction._originalAccountId}`
        );
        continue;
      }

      const newTransaction = await Transaction.create(
        [
          {
            admin: adminId,
            account_id: accountId,
            category_id: categoryId,
            amount: transaction.amount,
            flow: transaction.flow,
            date: transaction.date,
            description: transaction.description,
            keyword: transaction.keyword,
            counterparty: transaction.counterparty,
            meta_data: transaction.meta_data,
          },
        ],
        { session }
      );
      importedTransactions.push(newTransaction[0]);
    }

    // Import transfers
    const importedTransfers = [];
    if (Array.isArray(transfers)) {
      for (const transfer of transfers) {
        const fromAccountId = accountIdMap.get(transfer._originalFromAccountId);
        const toAccountId = accountIdMap.get(transfer._originalToAccountId);

        if (!fromAccountId || !toAccountId) {
          console.warn(
            `Skipping transfer: accounts not found for ${transfer._originalFromAccountId} -> ${transfer._originalToAccountId}`
          );
          continue;
        }

        const newTransfer = await Transfer.create(
          [
            {
              admin: adminId,
              from_account: fromAccountId,
              to_account: toAccountId,
              amount: transfer.amount,
              date: transfer.date,
              description: transfer.description,
              keyword: transfer.keyword,
              counterparty: transfer.counterparty,
              meta_data: transfer.meta_data,
            },
          ],
          { session }
        );
        importedTransfers.push(newTransfer[0]);
      }
    }

    // Import balance snapshots
    const importedSnapshots = [];
    if (Array.isArray(balanceSnapshots)) {
      for (const snapshot of balanceSnapshots) {
        const accountId = accountIdMap.get(snapshot._originalAccountId);

        if (!accountId) {
          continue;
        }

        const newSnapshot = await BalanceSnapshot.create(
          [
            {
              admin: adminId,
              account: accountId,
              balance: snapshot.balance,
              date: snapshot.date,
            },
          ],
          { session }
        );
        importedSnapshots.push(newSnapshot[0]);
      }
    }

    await session.commitTransaction();

    res.json({
      message: "Backup imported successfully",
      summary: {
        accountsImported: importedAccounts.length,
        categoriesImported: importedCategories.length,
        transactionsImported: importedTransactions.length,
        transfersImported: importedTransfers.length,
        balanceSnapshotsImported: importedSnapshots.length,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
