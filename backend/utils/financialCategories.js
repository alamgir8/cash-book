import { Category } from "../models/Category.js";

const INCOME_CATEGORY_TYPES = ["income", "sell", "donation_in", "other_income"];

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
    return {
      ids: [],
      includeUncategorized: Boolean(config?.includeUncategorized),
    };
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

export const resolveCategoryTypeScope = async ({
  adminId,
  organizationId,
  types = [],
  names = [],
}) => {
  const normalizedTypes = Array.isArray(types)
    ? types.filter((type) => typeof type === "string" && type.trim())
    : [];
  const normalizedNames = Array.isArray(names)
    ? names.filter((name) => typeof name === "string" && name.trim())
    : [];

  if (normalizedTypes.length === 0 && normalizedNames.length === 0) {
    return { ids: [], includeUncategorized: false };
  }

  const categories = await Category.find({
    ...(organizationId
      ? { organization: organizationId }
      : { admin: adminId, organization: { $exists: false } }),
    ...(normalizedTypes.length > 0 ? { type: { $in: normalizedTypes } } : {}),
    ...(normalizedNames.length > 0 ? { name: { $in: normalizedNames } } : {}),
    archived: { $ne: true },
  })
    .select("_id")
    .lean();

  return {
    ids: categories.map((category) => category._id),
    includeUncategorized: false,
  };
};
