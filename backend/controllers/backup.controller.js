import { Account } from "../models/Account.js";
import { Category } from "../models/Category.js";
import { Transaction } from "../models/Transaction.js";
import { Transfer } from "../models/Transfer.js";
import { BalanceSnapshot } from "../models/BalanceSnapshot.js";
import mongoose from "mongoose";

/**
 * Export all user data as JSON backup - Complete export with all fields
 */
export const exportBackup = async (req, res, next) => {
  try {
    const adminId = req.user.id;

    // Fetch all collections for this user with all fields
    const [accounts, categories, transactions, transfers, balanceSnapshots] =
      await Promise.all([
        Account.find({ admin: adminId }).lean(),
        Category.find({ admin: adminId }).lean(),
        Transaction.find({ admin: adminId }).lean(),
        Transfer.find({ admin: adminId }).lean(),
        BalanceSnapshot.find({ admin: adminId }).lean(),
      ]);

    // Export with original IDs preserved for relationship mapping
    const backup = {
      version: "2.0",
      exportedAt: new Date().toISOString(),
      data: {
        // Accounts - preserve all fields including balance
        accounts: accounts.map((a) => ({
          _originalId: a._id.toString(),
          name: a.name,
          kind: a.kind,
          current_balance: a.current_balance, // Use correct field name
          opening_balance: a.opening_balance,
          currency_code: a.currency_code,
          currency_symbol: a.currency_symbol,
          description: a.description,
          archived: a.archived,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        })),
        // Categories - preserve all fields
        categories: categories.map((c) => ({
          _originalId: c._id.toString(),
          name: c.name,
          type: c.type,
          flow: c.flow,
          color: c.color,
          description: c.description,
          archived: c.archived,
          archived_at: c.archived_at,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
        // Transactions - preserve all fields with relationships
        transactions: transactions.map((t) => ({
          _originalId: t._id.toString(),
          _originalAccountId: t.account?.toString() || null, // Model uses 'account' not 'account_id'
          _originalCategoryId: t.category_id?.toString() || null,
          amount: t.amount,
          type: t.type, // Model uses 'type' not 'flow'
          date: t.date,
          description: t.description,
          keyword: t.keyword,
          counterparty: t.counterparty,
          meta_data: t.meta_data,
          balance_after_transaction: t.balance_after_transaction,
          client_request_id: t.client_request_id,
          transfer_id: t.transfer_id?.toString() || null,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
        // Transfers - preserve all fields with relationships
        transfers: transfers.map((tr) => ({
          _originalId: tr._id.toString(),
          _originalFromAccountId: tr.from_account?.toString() || null,
          _originalToAccountId: tr.to_account?.toString() || null,
          _originalDebitTransactionId: tr.debit_transaction?.toString() || null,
          _originalCreditTransactionId:
            tr.credit_transaction?.toString() || null,
          amount: tr.amount,
          date: tr.date,
          description: tr.description,
          keyword: tr.keyword,
          counterparty: tr.counterparty,
          meta_data: tr.meta_data,
          client_request_id: tr.client_request_id,
          createdAt: tr.createdAt,
          updatedAt: tr.updatedAt,
        })),
        // Balance Snapshots - preserve all fields
        balanceSnapshots: balanceSnapshots.map((bs) => ({
          _originalId: bs._id.toString(),
          _originalAccountId: bs.account?.toString() || null,
          granularity: bs.granularity,
          period_start: bs.period_start,
          debit_total: bs.debit_total,
          credit_total: bs.credit_total,
          closing_balance: bs.closing_balance,
          createdAt: bs.createdAt,
          updatedAt: bs.updatedAt,
        })),
      },
      summary: {
        accountsCount: accounts.length,
        categoriesCount: categories.length,
        transactionsCount: transactions.length,
        transfersCount: transfers.length,
        balanceSnapshotsCount: balanceSnapshots.length,
        totalBalance: accounts.reduce(
          (sum, a) => sum + (a.current_balance || 0),
          0
        ),
      },
    };

    res.json(backup);
  } catch (error) {
    next(error);
  }
};

/**
 * Import user data from JSON backup - Complete restore with exact data
 */
export const importBackup = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const adminId = req.user.id;
    const { data, version } = req.body;

    console.log("Import backup request received:", {
      version,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
    });

    if (!data) {
      return res.status(400).json({ message: "No backup data provided" });
    }

    if (!version) {
      return res.status(400).json({ message: "Backup version is required" });
    }

    const { accounts, categories, transactions, transfers, balanceSnapshots } =
      data;

    console.log("Import data counts:", {
      accounts: accounts?.length || 0,
      categories: categories?.length || 0,
      transactions: transactions?.length || 0,
      transfers: transfers?.length || 0,
      balanceSnapshots: balanceSnapshots?.length || 0,
    });

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

    // Import accounts with exact balances - handle both v1.0 and v2.0 formats
    const importedAccounts = [];
    for (const account of accounts) {
      const originalId = account._originalId;

      // Support both formats: v1.0 uses current_balance directly, v2.0 also uses current_balance
      const balance = account.current_balance ?? account.balance ?? 0;
      const openingBalance = account.opening_balance ?? 0;

      // Create account with exact balance from backup
      const accountDoc = new Account({
        admin: adminId,
        name: account.name,
        kind: account.kind || "cash",
        opening_balance: openingBalance,
        current_balance: balance,
        currency_code: account.currency_code,
        currency_symbol: account.currency_symbol,
        description: account.description,
        archived: account.archived || false,
      });

      // Preserve timestamps if available
      if (account.createdAt) {
        accountDoc.createdAt = new Date(account.createdAt);
      }
      if (account.updatedAt) {
        accountDoc.updatedAt = new Date(account.updatedAt);
      }

      await accountDoc.save({ session, timestamps: false });
      accountIdMap.set(originalId, accountDoc._id);
      importedAccounts.push(accountDoc);

      console.log(`Imported account: ${account.name} with balance: ${balance}`);
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
        // Use existing category ID for relationship mapping
        categoryIdMap.set(originalId, existing._id);
        importedCategories.push({ ...existing.toObject(), skipped: true });
      } else {
        const categoryDoc = new Category({
          admin: adminId,
          name: category.name,
          type: category.type,
          flow: category.flow,
          color: category.color,
          description: category.description,
          archived: category.archived || false,
          archived_at: category.archived_at
            ? new Date(category.archived_at)
            : undefined,
        });

        if (category.createdAt) {
          categoryDoc.createdAt = new Date(category.createdAt);
        }
        if (category.updatedAt) {
          categoryDoc.updatedAt = new Date(category.updatedAt);
        }

        await categoryDoc.save({ session, timestamps: false });
        categoryIdMap.set(originalId, categoryDoc._id);
        importedCategories.push(categoryDoc);
      }
    }

    // Import transactions with exact data - also track original IDs for transfer references
    const importedTransactions = [];
    const transactionIdMap = new Map();
    let skippedTransactions = 0;

    for (const transaction of transactions) {
      const originalId = transaction._originalId;

      // Handle both formats: v1.0 might use account_id, v2.0 uses _originalAccountId
      const originalAccountId =
        transaction._originalAccountId || transaction.account_id;
      const originalCategoryId =
        transaction._originalCategoryId || transaction.category_id;

      const accountId = originalAccountId
        ? accountIdMap.get(originalAccountId)
        : null;
      const categoryId = originalCategoryId
        ? categoryIdMap.get(originalCategoryId)
        : null;

      if (!accountId) {
        console.warn(
          `Skipping transaction ${originalId}: account not found for ${originalAccountId}`
        );
        skippedTransactions++;
        continue;
      }

      // Derive type from flow if type is missing (v1.0 format compatibility)
      let transactionType = transaction.type;
      if (!transactionType && transaction.flow) {
        transactionType = transaction.flow === "credit" ? "credit" : "debit";
      }
      if (!transactionType) {
        console.warn(
          `Skipping transaction ${originalId}: no type or flow field`
        );
        skippedTransactions++;
        continue;
      }

      const transactionDoc = new Transaction({
        admin: adminId,
        account: accountId,
        category_id: categoryId,
        amount: transaction.amount,
        type: transactionType,
        date: new Date(transaction.date),
        description: transaction.description,
        keyword: transaction.keyword,
        counterparty: transaction.counterparty,
        meta_data: transaction.meta_data,
        balance_after_transaction: transaction.balance_after_transaction,
        client_request_id: transaction.client_request_id,
      });

      if (transaction.createdAt) {
        transactionDoc.createdAt = new Date(transaction.createdAt);
      }
      if (transaction.updatedAt) {
        transactionDoc.updatedAt = new Date(transaction.updatedAt);
      }

      await transactionDoc.save({ session, timestamps: false });
      transactionIdMap.set(originalId, transactionDoc._id);
      importedTransactions.push(transactionDoc);
    }

    console.log(
      `Imported ${importedTransactions.length} transactions, skipped ${skippedTransactions}`
    );

    // Import transfers - transfers require recreating the associated transactions
    const importedTransfers = [];
    let skippedTransfers = 0;

    if (Array.isArray(transfers)) {
      for (const transfer of transfers) {
        const originalFromAccountId =
          transfer._originalFromAccountId || transfer.from_account;
        const originalToAccountId =
          transfer._originalToAccountId || transfer.to_account;

        const fromAccountId = originalFromAccountId
          ? accountIdMap.get(originalFromAccountId)
          : null;
        const toAccountId = originalToAccountId
          ? accountIdMap.get(originalToAccountId)
          : null;

        if (!fromAccountId || !toAccountId) {
          console.warn(
            `Skipping transfer: accounts not found for ${originalFromAccountId} -> ${originalToAccountId}`
          );
          skippedTransfers++;
          continue;
        }

        // Try to find existing transaction references from the import
        const debitTransactionId = transfer._originalDebitTransactionId
          ? transactionIdMap.get(transfer._originalDebitTransactionId)
          : null;
        const creditTransactionId = transfer._originalCreditTransactionId
          ? transactionIdMap.get(transfer._originalCreditTransactionId)
          : null;

        // If we don't have transaction references, we need to create the transfer transactions
        let finalDebitTxId = debitTransactionId;
        let finalCreditTxId = creditTransactionId;

        if (!finalDebitTxId || !finalCreditTxId) {
          // Create the debit transaction (outgoing from source account)
          const debitTx = new Transaction({
            admin: adminId,
            account: fromAccountId,
            amount: transfer.amount,
            type: "debit",
            date: new Date(transfer.date),
            description: transfer.description || "Transfer out",
            keyword: transfer.keyword,
            counterparty: transfer.counterparty,
          });
          await debitTx.save({ session, timestamps: false });
          finalDebitTxId = debitTx._id;
          importedTransactions.push(debitTx);

          // Create the credit transaction (incoming to destination account)
          const creditTx = new Transaction({
            admin: adminId,
            account: toAccountId,
            amount: transfer.amount,
            type: "credit",
            date: new Date(transfer.date),
            description: transfer.description || "Transfer in",
            keyword: transfer.keyword,
            counterparty: transfer.counterparty,
          });
          await creditTx.save({ session, timestamps: false });
          finalCreditTxId = creditTx._id;
          importedTransactions.push(creditTx);
        }

        const transferDoc = new Transfer({
          admin: adminId,
          from_account: fromAccountId,
          to_account: toAccountId,
          debit_transaction: finalDebitTxId,
          credit_transaction: finalCreditTxId,
          amount: transfer.amount,
          date: new Date(transfer.date),
          description: transfer.description,
          keyword: transfer.keyword,
          counterparty: transfer.counterparty,
          meta_data: transfer.meta_data,
          client_request_id: transfer.client_request_id || undefined,
        });

        if (transfer.createdAt) {
          transferDoc.createdAt = new Date(transfer.createdAt);
        }
        if (transfer.updatedAt) {
          transferDoc.updatedAt = new Date(transfer.updatedAt);
        }

        await transferDoc.save({ session, timestamps: false });
        importedTransfers.push(transferDoc);
      }
    }

    console.log(
      `Imported ${importedTransfers.length} transfers, skipped ${skippedTransfers}`
    );

    // Import balance snapshots
    const importedSnapshots = [];
    if (Array.isArray(balanceSnapshots)) {
      for (const snapshot of balanceSnapshots) {
        const accountId = accountIdMap.get(snapshot._originalAccountId);

        if (!accountId) {
          console.warn(
            `Skipping balance snapshot: account not found for ${snapshot._originalAccountId}`
          );
          continue;
        }

        const snapshotDoc = new BalanceSnapshot({
          admin: adminId,
          account: accountId,
          granularity: snapshot.granularity,
          period_start: new Date(snapshot.period_start),
          debit_total: snapshot.debit_total || 0,
          credit_total: snapshot.credit_total || 0,
          closing_balance: snapshot.closing_balance || 0,
        });

        if (snapshot.createdAt) {
          snapshotDoc.createdAt = new Date(snapshot.createdAt);
        }
        if (snapshot.updatedAt) {
          snapshotDoc.updatedAt = new Date(snapshot.updatedAt);
        }

        await snapshotDoc.save({ session, timestamps: false });
        importedSnapshots.push(snapshotDoc);
      }
    }

    await session.commitTransaction();

    // Calculate total balance of imported accounts
    const totalImportedBalance = importedAccounts.reduce(
      (sum, a) => sum + (a.current_balance || 0),
      0
    );

    const summary = {
      accountsImported: importedAccounts.length,
      categoriesImported: importedCategories.filter((c) => !c.skipped).length,
      categoriesSkipped: importedCategories.filter((c) => c.skipped).length,
      transactionsImported: importedTransactions.length,
      transactionsSkipped: skippedTransactions,
      transfersImported: importedTransfers.length,
      transfersSkipped: skippedTransfers,
      balanceSnapshotsImported: importedSnapshots.length,
      totalBalance: totalImportedBalance,
    };

    console.log("Import completed successfully:", summary);

    res.json({
      message: "Backup restored successfully",
      summary,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
