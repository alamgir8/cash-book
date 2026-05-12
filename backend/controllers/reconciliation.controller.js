import { Account } from "../models/Account.js";
import { Transaction } from "../models/Transaction.js";
import { Transfer } from "../models/Transfer.js";
import { recordAudit } from "../utils/audit.js";
import { getOrgFromRequest } from "../utils/organization.js";
import { checkOrgAccess } from "../utils/organization.js";

/**
 * Verify account balances against transaction history without making changes.
 * Returns a full reconciliation report.
 */
export const verifyBalances = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const organizationId = getOrgFromRequest(req);

    if (organizationId) {
      const access = await checkOrgAccess(
        adminId,
        organizationId,
        "view_transactions",
      );
      if (!access.hasAccess)
        return res.status(403).json({ message: access.error });
    }

    const accountFilter = organizationId
      ? { organization: organizationId }
      : { admin: adminId, organization: { $exists: false } };

    const accounts = await Account.find(accountFilter)
      .select("_id name opening_balance current_balance")
      .lean();

    const report = {
      verified_at: new Date(),
      accounts_checked: accounts.length,
      discrepancies: [],
      transfers_checked: 0,
      orphaned_transfer_legs: [],
      is_consistent: true,
    };

    for (const account of accounts) {
      const txnFilter = organizationId
        ? {
            organization: organizationId,
            account: account._id,
            is_deleted: { $ne: true },
          }
        : { admin: adminId, account: account._id, is_deleted: { $ne: true } };

      const [agg] = await Transaction.aggregate([
        { $match: txnFilter },
        {
          $group: {
            _id: null,
            total_credit: {
              $sum: { $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0] },
            },
            total_debit: {
              $sum: { $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0] },
            },
          },
        },
      ]);

      const openingBalance = Number(account.opening_balance ?? 0);
      const totalCredit = Number(agg?.total_credit ?? 0);
      const totalDebit = Number(agg?.total_debit ?? 0);
      const computedBalance = openingBalance + totalCredit - totalDebit;
      const storedBalance = Number(account.current_balance ?? 0);

      // Use epsilon comparison for floating-point safety
      const discrepancy = Math.abs(computedBalance - storedBalance);
      if (discrepancy > 0.001) {
        report.discrepancies.push({
          account_id: account._id,
          account_name: account.name,
          stored_balance: storedBalance,
          computed_balance: computedBalance,
          difference: computedBalance - storedBalance,
          opening_balance: openingBalance,
          total_credit: totalCredit,
          total_debit: totalDebit,
        });
        report.is_consistent = false;
      }
    }

    // Check for orphaned transfer legs (one side deleted, other not)
    const transferFilter = organizationId
      ? { organization: organizationId }
      : { admin: adminId };

    const transfers = await Transfer.find(transferFilter)
      .select("_id debit_transaction credit_transaction amount")
      .lean();

    report.transfers_checked = transfers.length;

    for (const transfer of transfers) {
      const [debitTxn, creditTxn] = await Promise.all([
        Transaction.findById(transfer.debit_transaction)
          .select("_id is_deleted amount")
          .lean(),
        Transaction.findById(transfer.credit_transaction)
          .select("_id is_deleted amount")
          .lean(),
      ]);

      const debitDeleted = !debitTxn || debitTxn.is_deleted;
      const creditDeleted = !creditTxn || creditTxn.is_deleted;

      if (debitDeleted !== creditDeleted) {
        report.orphaned_transfer_legs.push({
          transfer_id: transfer._id,
          debit_transaction_id: transfer.debit_transaction,
          credit_transaction_id: transfer.credit_transaction,
          debit_deleted: debitDeleted,
          credit_deleted: creditDeleted,
          amount: transfer.amount,
        });
        report.is_consistent = false;
      }
    }

    res.json(report);
  } catch (error) {
    next(error);
  }
};

/**
 * Full balance recalculation — recomputes from transaction history and corrects
 * stored current_balance and balance_after_transaction for all accounts.
 * Returns detailed reconciliation results.
 */
export const reconcileBalances = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const organizationId = getOrgFromRequest(req);

    if (organizationId) {
      const access = await checkOrgAccess(
        adminId,
        organizationId,
        "edit_transactions",
      );
      if (!access.hasAccess)
        return res.status(403).json({ message: access.error });
    }

    const accountFilter = organizationId
      ? { organization: organizationId }
      : { admin: adminId, organization: { $exists: false } };

    const accounts = await Account.find(accountFilter)
      .select("_id name opening_balance current_balance")
      .lean();

    if (accounts.length === 0) {
      return res.status(200).json({
        message: "No accounts found",
        accounts_processed: 0,
        transactions_updated: 0,
        corrections: [],
      });
    }

    const corrections = [];
    let totalTransactionsUpdated = 0;
    const BATCH_SIZE = 500;

    for (const account of accounts) {
      const txnFilter = organizationId
        ? {
            organization: organizationId,
            account: account._id,
            is_deleted: { $ne: true },
          }
        : { admin: adminId, account: account._id, is_deleted: { $ne: true } };

      let runningBalance = Number(account.opening_balance ?? 0);
      let skip = 0;
      let hasMore = true;
      let txnsUpdatedForAccount = 0;

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

          // Round to 2 decimal places to prevent floating-point drift
          runningBalance = Math.round(runningBalance * 100) / 100;

          if (
            Math.abs((txn.balance_after_transaction ?? NaN) - runningBalance) >
            0.001
          ) {
            bulkOps.push({
              updateOne: {
                filter: { _id: txn._id },
                update: { $set: { balance_after_transaction: runningBalance } },
              },
            });
            txnsUpdatedForAccount++;
            totalTransactionsUpdated++;
          }
        }

        if (bulkOps.length > 0) {
          await Transaction.bulkWrite(bulkOps, { ordered: false });
        }

        skip += BATCH_SIZE;
        if (transactions.length < BATCH_SIZE) hasMore = false;
      }

      const previousBalance = Number(account.current_balance ?? 0);
      const balanceDiff = runningBalance - previousBalance;

      if (Math.abs(balanceDiff) > 0.001) {
        corrections.push({
          account_id: account._id,
          account_name: account.name,
          previous_balance: previousBalance,
          corrected_balance: runningBalance,
          difference: balanceDiff,
          transactions_updated: txnsUpdatedForAccount,
        });
      }

      await Account.findByIdAndUpdate(account._id, {
        $set: { current_balance: runningBalance },
      });
    }

    // Audit the reconciliation
    recordAudit({
      actor: adminId,
      organization: organizationId,
      action: "balance.reconcile",
      resource_type: "account",
      after: {
        accounts_processed: accounts.length,
        corrections_count: corrections.length,
      },
    });

    res.json({
      message: "Balance reconciliation completed successfully",
      accounts_processed: accounts.length,
      transactions_updated: totalTransactionsUpdated,
      corrections_made: corrections.length,
      corrections,
      is_fully_consistent: corrections.length === 0,
    });
  } catch (error) {
    next(error);
  }
};
