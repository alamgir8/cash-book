import mongoose from "mongoose";

const toObjectIdString = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === "object" && value._id) {
    return toObjectIdString(value._id);
  }
  return null;
};

export const recomputeDescendingBalances = ({
  transactions,
  accountBalances,
}) => {
  if (!transactions || transactions.length === 0) return;
  const running = new Map();

  transactions.forEach((txn) => {
    const accountId = toObjectIdString(txn.account);
    if (!accountId) return;

    let currentBalance = running.get(accountId);

    if (currentBalance === undefined) {
      if (accountBalances?.has(accountId)) {
        currentBalance = accountBalances.get(accountId);
      } else if (typeof txn.balance_after_transaction === "number") {
        currentBalance = txn.balance_after_transaction;
      } else {
        currentBalance = 0;
      }
    }

    txn.balance_after_transaction = currentBalance;

    if (txn.type === "credit") {
      currentBalance -= Number(txn.amount ?? 0);
    } else {
      currentBalance += Number(txn.amount ?? 0);
    }

    running.set(accountId, currentBalance);
  });
};
