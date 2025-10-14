import { Category } from "../models/Category.js";

const INCOME_CATEGORY_TYPES = [
  "income",
  "sell",
  "donation_in",
  "other_income",
];

const EXPENSE_CATEGORY_TYPES = [
  "expense",
  "donation_out",
  "salary",
  "other_expense",
];

const FINANCIAL_SCOPE_MAP = {
  actual: [...INCOME_CATEGORY_TYPES, ...EXPENSE_CATEGORY_TYPES],
  income: INCOME_CATEGORY_TYPES,
  expense: EXPENSE_CATEGORY_TYPES,
  actual_income: INCOME_CATEGORY_TYPES,
  actual_expense: EXPENSE_CATEGORY_TYPES,
};

const normalizeScopeKey = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.toLowerCase().trim();
  return FINANCIAL_SCOPE_MAP[trimmed] ? trimmed : null;
};

export const resolveFinancialCategoryIds = async ({ adminId, scope }) => {
  const key = normalizeScopeKey(scope);
  if (!key) return null;

  const types = FINANCIAL_SCOPE_MAP[key];
  if (!types || types.length === 0) {
    return [];
  }

  const categories = await Category.find({
    admin: adminId,
    type: { $in: types },
    archived: { $ne: true },
  })
    .select("_id")
    .lean();

  return categories.map((category) => category._id);
};
