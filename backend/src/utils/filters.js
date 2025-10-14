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
  allowedCategoryIds,
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

  if (Array.isArray(allowedCategoryIds)) {
    if (allowedCategoryIds.length === 0) {
      filter.category_id = { $in: [] };
    } else if (!filter.category_id) {
      filter.category_id = { $in: asObjectIdArray(allowedCategoryIds) };
    } else if (filter.category_id instanceof mongoose.Types.ObjectId) {
      const matches = allowedCategoryIds.some((id) =>
        id.toString() === filter.category_id.toString()
      );
      if (!matches) {
        filter.category_id = { $in: [] };
      }
    } else if (filter.category_id.$in) {
      const allowedSet = new Set(
        allowedCategoryIds.map((id) => id.toString())
      );
      const intersection = filter.category_id.$in.filter((id) =>
        allowedSet.has(id.toString())
      );
      filter.category_id.$in = intersection;
      if (intersection.length === 0) {
        filter.category_id = { $in: [] };
      }
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
