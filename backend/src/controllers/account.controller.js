import { Account } from '../models/Account.js';
import { Transaction } from '../models/Transaction.js';

export const listAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.find({ admin: req.user.id }).sort({ name: 1 });
    res.json({ accounts });
  } catch (error) {
    next(error);
  }
};

export const createAccount = async (req, res, next) => {
  try {
    const { name, type, description, createdViaVoice } = req.body;
    const account = await Account.create({
      admin: req.user.id,
      name,
      type,
      description,
      createdViaVoice: Boolean(createdViaVoice)
    });
    res.status(201).json({ account });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'An account with this name already exists for this admin'
      });
    }
    next(error);
  }
};

export const updateAccount = async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const update = req.body;

    const account = await Account.findOneAndUpdate(
      { _id: accountId, admin: req.user.id },
      update,
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    res.json({ account });
  } catch (error) {
    next(error);
  }
};

export const getAccountSummary = async (req, res, next) => {
  try {
    const { accountId } = req.params;

    const account = await Account.findOne({ _id: accountId, admin: req.user.id });
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    const totals = await Transaction.aggregate([
      {
        $match: {
          admin: account.admin,
          account: account._id
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' }
        }
      }
    ]);

    const summary = totals.reduce(
      (acc, item) => {
        acc[item._id] = item.total;
        return acc;
      },
      { debit: 0, credit: 0 }
    );

    res.json({
      account,
      summary
    });
  } catch (error) {
    next(error);
  }
};
