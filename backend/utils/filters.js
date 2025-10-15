import dayjs from "dayjs";
import mongoose from "mongoose";

const rangeConfig = {
  daily: () => ({
    start: dayjs().startOf("day"),
    end: dayjs().endOf("day"),
  }),
  weekly: () => ({
    start: dayjs().startOf("week"),
    end: dayjs().endOf("week"),
  }),
  monthly: () => ({
    start: dayjs().startOf("month"),
    end: dayjs().endOf("month"),
  }),
  yearly: () => ({
    start: dayjs().startOf("year"),
    end: dayjs().endOf("year"),
  }),
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
};

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const asObjectIdArray = (ids = []) =>
  ids.map((id) =>
    id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
  );

export const buildTransactionFilters = ({
  adminId,
  query,
  categoryScope,
}) => {
  const filter = {
    admin: new mongoose.Types.ObjectId(adminId),
    is_deleted: false,
  };

  if (query.accountId || query.account_id) {
    const accountId = query.accountId ?? query.account_id;
    if (accountId && mongoose.isValidObjectId(accountId)) {
      filter.account = new mongoose.Types.ObjectId(accountId);
    }
  }

  if (query.categoryId || query.category_id) {
    const categoryId = query.categoryId ?? query.category_id;
    if (categoryId && mongoose.isValidObjectId(categoryId)) {
      filter.category_id = new mongoose.Types.ObjectId(categoryId);
    }
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.counterparty) {
    const normalized = String(query.counterparty).trim();
    if (normalized.length > 0) {
      filter.counterparty = {
        $regex: `^${escapeRegex(normalized)}$`,
        $options: "i",
      };
    }
  }

  if (categoryScope) {
    const allowedObjectIds = asObjectIdArray(categoryScope.ids ?? []);
    const allowUncategorized = Boolean(categoryScope.includeUncategorized);

    const scopeClauses = [];
    if (allowedObjectIds.length > 0) {
      scopeClauses.push({ category_id: { $in: allowedObjectIds } });
    }
    if (allowUncategorized) {
      scopeClauses.push({ category_id: { $exists: false } });
      scopeClauses.push({ category_id: null });
    }
    if (scopeClauses.length === 0) {
      scopeClauses.push({ category_id: { $in: [] } });
    }

    const scopeCondition = scopeClauses.length === 1
      ? scopeClauses[0]
      : { $or: scopeClauses };

    const userCategoryCondition = filter.category_id;
    if (userCategoryCondition) {
      delete filter.category_id;
      filter.$and = filter.$and ?? [];
      filter.$and.push({ category_id: userCategoryCondition });
      filter.$and.push(scopeCondition);
    } else {
      filter.$and = filter.$and ?? [];
      filter.$and.push(scopeCondition);
    }
  }

  const searchTerm = query.q ?? query.search;
  if (searchTerm) {
    filter.$text = { $search: searchTerm };
  }

  let from = parseDate(query.from ?? query.startDate);
  let to = parseDate(query.to ?? query.endDate);

  if (!from && !to && query.range && rangeConfig[query.range]) {
    const { start, end } = rangeConfig[query.range]();
    from = start;
    to = end;
  }

  if (from || to) {
    filter.date = {};
    if (from) {
      filter.date.$gte = from.startOf("day").toDate();
    }
    if (to) {
      filter.date.$lte = to.endOf("day").toDate();
    }
  }

  const minAmount = query.minAmount ?? query.min_amount;
  const maxAmount = query.maxAmount ?? query.max_amount;

  if (minAmount !== undefined || maxAmount !== undefined) {
    filter.amount = {};
    if (minAmount !== undefined) {
      filter.amount.$gte = Number(minAmount);
    }
    if (maxAmount !== undefined) {
      filter.amount.$lte = Number(maxAmount);
    }
  }

  if (query.includeDeleted === "true" || query.include_deleted === "true") {
    delete filter.is_deleted;
  }

  return filter;
};
