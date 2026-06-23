import type { Transaction } from "@/services/transactions";
import { getPartyRefId } from "@/lib/transaction-filters";

export const isLoanCategoryType = (type?: string) =>
  type === "loan_in" || type === "loan_out";

export const isLoanGivenRoot = (transaction: Transaction) =>
  transaction.category?.type === "loan_out" &&
  transaction.type === "debit" &&
  (transaction.category?.name === "Loan Given" ||
    !transaction.category?.name?.toLowerCase().includes("repayment"));

export const isLoanReceivedRoot = (transaction: Transaction) =>
  transaction.category?.type === "loan_in" &&
  transaction.type === "credit" &&
  (transaction.category?.name === "Loan Received" ||
    !transaction.category?.name?.toLowerCase().includes("repayment"));

export const getLoanReturnRemaining = (transaction: Transaction) => {
  const summary = transaction.loan_summary;
  if (!summary) return 0;
  if (isLoanGivenRoot(transaction)) return summary.owed_by_them ?? 0;
  if (isLoanReceivedRoot(transaction)) return summary.owed_by_me ?? 0;
  return summary.outstanding ?? 0;
};

export const getLoanRepaymentConfig = (transaction: Transaction) => {
  if (isLoanGivenRoot(transaction)) {
    return {
      categoryName: "Loan Repayment Received",
      type: "credit" as const,
      remaining: getLoanReturnRemaining(transaction),
    };
  }
  if (isLoanReceivedRoot(transaction)) {
    return {
      categoryName: "Loan Repayment Paid",
      type: "debit" as const,
      remaining: getLoanReturnRemaining(transaction),
    };
  }
  return null;
};

export const getLoanPartyPayload = (transaction: Transaction) => ({
  party: getPartyRefId(transaction.party),
  for_party: getPartyRefId(transaction.for_party),
});
