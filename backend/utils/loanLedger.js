import mongoose from "mongoose";
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

const getPartyId = (transaction) => {
  const p = transaction.party;
  if (!p) return null;
  return p._id?.toString?.() ?? p.toString();
};

const getForPartyId = (transaction) => {
  const p = transaction.for_party;
  if (!p) return null;
  return p._id?.toString?.() ?? p.toString();
};

// Canonical key for a (party, for_party) pair — order-independent
const pairKey = (a, b) => [a, b].sort().join("|");

export const isLoanTransaction = (transaction) => {
  const category = transaction.category_id ?? transaction.category;
  const hasParty =
    Boolean(getPartyId(transaction)) ||
    Boolean(normalizeCounterparty(transaction.counterparty));
  return hasParty && LOAN_CATEGORY_TYPES.includes(category?.type);
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

  const loanTransactions = transactions.filter(isLoanTransaction);
  if (loanTransactions.length === 0) return transactions;

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

  // Collect all unique party IDs (from both party and for_party) for a batch fetch
  const allPartyIds = [
    ...new Set(
      loanTransactions
        .flatMap((t) => [getPartyId(t), getForPartyId(t)])
        .filter(Boolean),
    ),
  ];
  const legacyCounterparties = [
    ...new Set(
      loanTransactions
        .filter((t) => !getPartyId(t))
        .map((t) => normalizeCounterparty(t.counterparty))
        .filter(Boolean),
    ),
  ];

  if (allPartyIds.length === 0 && legacyCounterparties.length === 0)
    return transactions;

  const orClauses = [];
  if (allPartyIds.length > 0) {
    const oids = allPartyIds.map((id) => new mongoose.Types.ObjectId(id));
    orClauses.push({ party: { $in: oids } });
    orClauses.push({ for_party: { $in: oids } });
  }
  if (legacyCounterparties.length > 0) {
    orClauses.push({ counterparty: { $in: legacyCounterparties } });
  }

  const ledgerTransactions = await Transaction.find({
    ...buildScopeFilter({ adminId, organizationId }),
    $or: orClauses,
    category_id: { $in: categoryIds },
    is_deleted: { $ne: true },
  })
    .populate("account", "name kind")
    .populate("category_id", "name type")
    .sort({ date: 1, createdAt: 1, _id: 1 })
    .lean();

  // Build summaries keyed by pair or solo party or legacy string
  const summariesByKey = new Map();

  const ensurePairSummary = (pid, fpid) => {
    const key = pairKey(pid, fpid);
    if (summariesByKey.has(key)) return;
    const pairTxns = ledgerTransactions.filter((lt) => {
      const lp = getPartyId(lt);
      const lfp = getForPartyId(lt);
      return (lp === pid && lfp === fpid) || (lp === fpid && lfp === pid);
    });
    summariesByKey.set(
      key,
      calculateLoanLedger({ transactions: pairTxns, categoryById }).summary,
    );
  };

  const ensureSoloSummary = (pid) => {
    if (summariesByKey.has(pid)) return;
    const soloTxns = ledgerTransactions.filter(
      (lt) => getPartyId(lt) === pid && !getForPartyId(lt),
    );
    summariesByKey.set(
      pid,
      calculateLoanLedger({ transactions: soloTxns, categoryById }).summary,
    );
  };

  const ensureLegacySummary = (cp) => {
    if (summariesByKey.has(cp)) return;
    const legacyTxns = ledgerTransactions.filter(
      (lt) => !getPartyId(lt) && normalizeCounterparty(lt.counterparty) === cp,
    );
    summariesByKey.set(
      cp,
      calculateLoanLedger({ transactions: legacyTxns, categoryById }).summary,
    );
  };

  for (const t of loanTransactions) {
    const pid = getPartyId(t);
    const fpid = getForPartyId(t);
    if (pid && fpid) {
      ensurePairSummary(pid, fpid);
    } else if (pid) {
      ensureSoloSummary(pid);
    } else {
      const cp = normalizeCounterparty(t.counterparty);
      if (cp) ensureLegacySummary(cp);
    }
  }

  return transactions.map((transaction) => {
    if (!isLoanTransaction(transaction)) return transaction;
    const pid = getPartyId(transaction);
    const fpid = getForPartyId(transaction);
    let key;
    if (pid && fpid) {
      key = pairKey(pid, fpid);
    } else if (pid) {
      key = pid;
    } else {
      key = normalizeCounterparty(transaction.counterparty);
    }
    const loanSummary = summariesByKey.get(key);
    return loanSummary
      ? { ...transaction, loan_summary: loanSummary }
      : transaction;
  });
};

export const getCounterpartyLoanLedger = async ({
  adminId,
  organizationId,
  partyId,
  forPartyId,
  counterparty,
}) => {
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

  // Build party filter:
  //  - When both partyId + forPartyId are provided → pair query (only transactions
  //    between these two specific parties, in either direction).
  //  - When only partyId → any transaction involving that party.
  //  - Legacy string fallback.
  let partyFilter;
  if (partyId && forPartyId) {
    const oidA = new mongoose.Types.ObjectId(partyId);
    const oidB = new mongoose.Types.ObjectId(forPartyId);
    partyFilter = {
      $or: [
        { party: oidA, for_party: oidB },
        { party: oidB, for_party: oidA },
      ],
    };
  } else if (partyId) {
    partyFilter = {
      $or: [
        { party: new mongoose.Types.ObjectId(partyId) },
        { for_party: new mongoose.Types.ObjectId(partyId) },
      ],
    };
  } else {
    partyFilter = { counterparty: normalizeCounterparty(counterparty) };
  }

  const transactions = await Transaction.find({
    ...buildScopeFilter({ adminId, organizationId }),
    ...partyFilter,
    category_id: { $in: categoryIds },
    is_deleted: { $ne: true },
  })
    .populate("account", "name kind")
    .populate("category_id", "name type")
    .sort({ date: 1, createdAt: 1, _id: 1 })
    .lean();

  return calculateLoanLedger({ transactions, categoryById });
};
