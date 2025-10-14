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

const FINANCIAL_SCOPE_CONFIG = {
  actual: {
    types: [...INCOME_CATEGORY_TYPES, ...EXPENSE_CATEGORY_TYPES],
    includeUncategorized: true,
  },
  income: {
    types: INCOME_CATEGORY_TYPES,
    includeUncategorized: false,
  },
  expense: {
    types: EXPENSE_CATEGORY_TYPES,
    includeUncategorized: false,
  },
  both: {
    types: [...INCOME_CATEGORY_TYPES, ...EXPENSE_CATEGORY_TYPES],
    includeUncategorized: false,
  },
};

const normalizeScopeKey = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.toLowerCase().trim();
  return FINANCIAL_SCOPE_CONFIG[trimmed] ? trimmed : null;
};

export const resolveFinancialCategoryScope = async ({ adminId, scope }) => {
  const key = normalizeScopeKey(scope);
  if (!key) return null;

  const config = FINANCIAL_SCOPE_CONFIG[key];
  if (!config?.types?.length) {
    return { ids: [], includeUncategorized: Boolean(config?.includeUncategorized) };
  }

  const categories = await Category.find({
    admin: adminId,
    type: { $in: config.types },
    archived: { $ne: true },
  })
    .select("_id")
    .lean();

  return {
    ids: categories.map((category) => category._id),
    includeUncategorized: Boolean(config.includeUncategorized),
  };
};
