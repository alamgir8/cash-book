import { Category } from "../models/Category.js";
import { Transaction } from "../models/Transaction.js";

const LOAN_CATEGORY_TYPES = ["loan_in", "loan_out"];

const buildScopeFilter = ({ adminId, organizationId }) =>
  organizationId
    ? { organization: organizationId }
    : { admin: adminId, organization: { $exists: false } };

const getCategoryId = (transaction) =>
  transaction.category_id?._id?.toString?.() ??
  transaction.category_id?.toString?.() ??
  transaction.category?._id?.toString?.() ??
  transaction.category?.toString?.() ??
  "";

const normalizeCounterparty = (value) => String(value ?? "").trim();

export const isLoanTransaction = (transaction) => {
  const category = transaction.category_id ?? transaction.category;
  return (
    Boolean(normalizeCounterparty(transaction.counterparty)) &&
    LOAN_CATEGORY_TYPES.includes(category?.type)
  );
};

export const calculateLoanLedger = ({ transactions, categoryById }) => {
  let owedByMe = 0;
  let owedByThem = 0;
  let totalBorrowed = 0;
  let totalRepaid = 0;
  let totalGiven = 0;
  let totalReceivedBack = 0;

  const timeline = transactions.map((transaction) => {
    const category = categoryById.get(getCategoryId(transaction));
    const categoryName = category?.name ?? transaction.category_id?.name ?? "";
    const categoryType = category?.type ?? transaction.category_id?.type ?? "";
    const amount = Number(transaction.amount ?? 0);

    let entryType;

    if (categoryName === "Loan Received") {
      owedByMe += amount;
      totalBorrowed += amount;
      entryType = "borrow";
    } else if (categoryName === "Loan Repayment Paid") {
      totalRepaid += amount;
      owedByMe = Math.max(0, owedByMe - amount);
      entryType = "repayment";
    } else if (categoryName === "Loan Given") {
      owedByThem += amount;
      totalGiven += amount;
      entryType = "loan_given";
    } else if (categoryName === "Loan Repayment Received") {
      totalReceivedBack += amount;
      owedByThem = Math.max(0, owedByThem - amount);
      entryType = "loan_received_back";
    } else if (categoryType === "loan_in") {
      if (transaction.type === "debit") {
        totalRepaid += amount;
        owedByMe = Math.max(0, owedByMe - amount);
        entryType = "repayment";
      } else {
        owedByMe += amount;
        totalBorrowed += amount;
        entryType = "borrow";
      }
    } else {
      if (transaction.type === "credit") {
        totalReceivedBack += amount;
        owedByThem = Math.max(0, owedByThem - amount);
        entryType = "loan_received_back";
      } else {
        owedByThem += amount;
        totalGiven += amount;
        entryType = "loan_given";
      }
    }

    return {
      ...transaction,
      entry_type: entryType,
      running_balance: owedByThem - owedByMe,
    };
  });

  const outstanding = owedByMe + owedByThem;
  const netOwedByMe = owedByMe - owedByThem;

  return {
    timeline,
    summary: {
      total_borrowed: totalBorrowed,
      total_repaid: totalRepaid,
      total_given: totalGiven,
      total_received_back: totalReceivedBack,
      outstanding,
      net_owed_by_me: netOwedByMe,
      owed_by_me: owedByMe,
      owed_by_them: owedByThem,
      transaction_count: transactions.length,
      is_settled: owedByMe === 0 && owedByThem === 0,
    },
  };
};

export const decorateLoanSummaries = async ({
  transactions,
  adminId,
  organizationId,
}) => {
  if (!transactions?.length) return transactions;

  const loanCounterparties = [
    ...new Set(
      transactions
        .filter(isLoanTransaction)
        .map((transaction) => normalizeCounterparty(transaction.counterparty))
        .filter(Boolean),
    ),
  ];

  if (loanCounterparties.length === 0) return transactions;

  const categoryDocs = await Category.find({
    ...buildScopeFilter({ adminId, organizationId }),
    type: { $in: LOAN_CATEGORY_TYPES },
    archived: { $ne: true },
  })
    .select("_id name type")
    .lean();

  const categoryById = new Map(
    categoryDocs.map((category) => [category._id.toString(), category]),
  );
  const categoryIds = categoryDocs.map((category) => category._id);

  if (categoryIds.length === 0) return transactions;

  const ledgerTransactions = await Transaction.find({
    ...buildScopeFilter({ adminId, organizationId }),
    counterparty: { $in: loanCounterparties },
    category_id: { $in: categoryIds },
    is_deleted: { $ne: true },
  })
    .populate("account", "name kind")
    .populate("category_id", "name type")
    .sort({ counterparty: 1, date: 1, createdAt: 1, _id: 1 })
    .lean();

  const summariesByCounterparty = new Map();
  for (const counterparty of loanCounterparties) {
    const counterpartyTransactions = ledgerTransactions.filter(
      (transaction) =>
        normalizeCounterparty(transaction.counterparty) === counterparty,
    );
    summariesByCounterparty.set(
      counterparty,
      calculateLoanLedger({
        transactions: counterpartyTransactions,
        categoryById,
      }).summary,
    );
  }

  return transactions.map((transaction) => {
    if (!isLoanTransaction(transaction)) return transaction;
    const counterparty = normalizeCounterparty(transaction.counterparty);
    const loanSummary = summariesByCounterparty.get(counterparty);
    return loanSummary
      ? {
          ...transaction,
          loan_summary: loanSummary,
        }
      : transaction;
  });
};

export const getCounterpartyLoanLedger = async ({
  adminId,
  organizationId,
  counterparty,
}) => {
  const normalizedCounterparty = normalizeCounterparty(counterparty);

  const categoryDocs = await Category.find({
    ...buildScopeFilter({ adminId, organizationId }),
    type: { $in: LOAN_CATEGORY_TYPES },
    archived: { $ne: true },
  })
    .select("_id name type")
    .lean();

  const categoryById = new Map(
    categoryDocs.map((category) => [category._id.toString(), category]),
  );
  const categoryIds = categoryDocs.map((category) => category._id);

  const transactions = await Transaction.find({
    ...buildScopeFilter({ adminId, organizationId }),
    counterparty: normalizedCounterparty,
    category_id: { $in: categoryIds },
    is_deleted: { $ne: true },
  })
    .populate("account", "name kind")
    .populate("category_id", "name type")
    .sort({ date: 1, createdAt: 1, _id: 1 })
    .lean();

  return calculateLoanLedger({ transactions, categoryById });
};
