import dayjs from 'dayjs';
import { Account } from '../models/Account.js';
import { Transaction } from '../models/Transaction.js';
import { buildTransactionFilters } from '../utils/filters.js';

const applyBalanceDelta = async ({ account, amount, type }) => {
  const delta = type === 'credit' ? amount : -amount;
  account.balance = (account.balance || 0) + delta;
  await account.save();
  return account.balance;
};

export const listTransactions = async (req, res, next) => {
  try {
    const filter = buildTransactionFilters({
      adminId: req.user.id,
      query: req.query
    });

    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    if (req.query.accountName) {
      const accounts = await Account.find({
        admin: req.user.id,
        name: { $regex: req.query.accountName, $options: 'i' }
      }).select('_id');

      if (accounts.length === 0) {
        return res.json({
          transactions: [],
          pagination: { page, limit, total: 0, pages: 0 }
        });
      }

      filter.account = { $in: accounts.map((item) => item._id) };
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate('account', 'name type')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments(filter)
    ]);

    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

export const createTransaction = async (req, res, next) => {
  try {
    const {
      accountId,
      type,
      amount,
      date,
      description,
      comment,
      createdViaVoice
    } = req.body;

    const account = await Account.findOne({ _id: accountId, admin: req.user.id });
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    let txnDate = new Date();
    if (typeof date === 'string' && date.trim().length > 0) {
      const parsed = dayjs(date.trim());
      if (!parsed.isValid()) {
        return res.status(400).json({ message: 'Invalid transaction date' });
      }
      txnDate = parsed.toDate();
    }

    const transaction = await Transaction.create({
      admin: req.user.id,
      account: account._id,
      type,
      amount,
      date: txnDate,
      description,
      comment,
      createdViaVoice: Boolean(createdViaVoice)
    });

    const balanceAfter = await applyBalanceDelta({ account, amount, type });
    transaction.balanceAfterTransaction = balanceAfter;
    await transaction.save();

    res.status(201).json({ transaction });
  } catch (error) {
    next(error);
  }
};

export const updateTransaction = async (req, res, next) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      admin: req.user.id
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const account = await Account.findOne({ _id: transaction.account, admin: req.user.id });
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // revert previous balance impact
    await applyBalanceDelta({
      account,
      amount: transaction.amount,
      type: transaction.type === 'credit' ? 'debit' : 'credit'
    });

    const {
      accountId,
      type,
      amount,
      date,
      description,
      comment
    } = req.body;

    if (accountId && accountId !== account._id.toString()) {
      const newAccount = await Account.findOne({ _id: accountId, admin: req.user.id });
      if (!newAccount) {
        return res.status(404).json({ message: 'Target account not found' });
      }
      transaction.account = newAccount._id;
    }

    if (type) {
      transaction.type = type;
    }

    if (amount !== undefined) {
      transaction.amount = amount;
    }

    if (typeof date === 'string') {
      const trimmed = date.trim();
      if (trimmed.length > 0) {
        const parsed = dayjs(trimmed);
        if (!parsed.isValid()) {
          return res.status(400).json({ message: 'Invalid transaction date' });
        }
        transaction.date = parsed.toDate();
      }
    }

    if (description !== undefined) {
      transaction.description = description;
    }

    if (comment !== undefined) {
      transaction.comment = comment;
    }

    const updatedAccount = await Account.findOne({ _id: transaction.account, admin: req.user.id });
    const balanceAfter = await applyBalanceDelta({
      account: updatedAccount,
      amount: transaction.amount,
      type: transaction.type
    });

    transaction.balanceAfterTransaction = balanceAfter;
    await transaction.save();

    res.json({ transaction });
  } catch (error) {
    next(error);
  }
};
