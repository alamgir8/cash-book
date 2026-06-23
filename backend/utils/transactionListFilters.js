import { Category } from "../models/Category.js";

const buildCategoryScope = ({ adminId, organizationId }) =>
  organizationId
    ? { organization: organizationId }
    : { admin: adminId, organization: { $exists: false } };

/** Exclude loan categories from the Due quick-filter (dues only, not loans). */
export const excludeLoanCategoriesFromDueFilter = async (
  filter,
  { adminId, organizationId },
) => {
  const scope = buildCategoryScope({ adminId, organizationId });
  const loanCategories = await Category.find({
    ...scope,
    type: { $in: ["loan_in", "loan_out"] },
    archived: { $ne: true },
  })
    .select("_id")
    .lean();

  if (loanCategories.length === 0) return;

  filter.$and = filter.$and ?? [];
  filter.$and.push({
    category_id: { $nin: loanCategories.map((category) => category._id) },
  });
};

/** Keep only unsettled root loan transactions for loan_given / loan_received filters. */
export const filterTransactionsForLoanList = (transactions, loanFilter) => {
  if (loanFilter !== "loan_given" && loanFilter !== "loan_received") {
    return transactions;
  }

  return transactions.filter((transaction) => {
    const summary = transaction.loan_summary;
    if (!summary || summary.is_settled) return false;

    if (loanFilter === "loan_given") {
      return (summary.owed_by_them ?? 0) > 0;
    }

    return (summary.owed_by_me ?? 0) > 0;
  });
};
