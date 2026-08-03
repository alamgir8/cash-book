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
    id instanceof mongoose.Types.ObjectId
      ? id
      : new mongoose.Types.ObjectId(id),
  );

/** Personal / pre-org rows: field missing OR explicitly null. */
export const personalOrganizationClause = () => ({
  $or: [{ organization: { $exists: false } }, { organization: null }],
});

/**
 * Build the org/personal base scope.
 *
 * When `orphanAccountIds` is provided with an organization, also include the
 * admin's unscoped (null/missing org) transactions that sit on those accounts.
 * That recovers ~29 legacy rows that live in backup/export but were invisible
 * to org-scoped `/transactions` (1175 vs ~1204).
 */
export const buildOrganizationScope = ({
  adminId,
  organizationId,
  orphanAccountIds = [],
}) => {
  if (!organizationId) {
    return {
      admin: new mongoose.Types.ObjectId(adminId),
      ...personalOrganizationClause(),
    };
  }

  const orgObjectId = new mongoose.Types.ObjectId(organizationId);
  if (!orphanAccountIds.length) {
    return { organization: orgObjectId };
  }

  return {
    $or: [
      { organization: orgObjectId },
      {
        admin: new mongoose.Types.ObjectId(adminId),
        account: { $in: asObjectIdArray(orphanAccountIds) },
        ...personalOrganizationClause(),
      },
    ],
  };
};

export const buildTransactionFilters = ({
  adminId,
  organizationId,
  query,
  categoryScope,
  orphanAccountIds = [],
}) => {
  const filter = {
    is_deleted: false,
    ...buildOrganizationScope({
      adminId,
      organizationId,
      orphanAccountIds,
    }),
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

  // Primary: party ObjectId ref (post-migration)
  if (query.party || query.party_id) {
    const partyValue = query.party ?? query.party_id;
    if (partyValue && mongoose.isValidObjectId(partyValue)) {
      filter.party = new mongoose.Types.ObjectId(partyValue);
    }
  }

  if (query.for_party || query.for_party_id) {
    const forPartyValue = query.for_party ?? query.for_party_id;
    if (forPartyValue && mongoose.isValidObjectId(forPartyValue)) {
      filter.for_party = new mongoose.Types.ObjectId(forPartyValue);
    }
  }

  // Legacy fallback: counterparty/vendor string filters (pre-migration data)
  if (query.counterparty) {
    const normalized = String(query.counterparty).trim();
    if (normalized.length > 0) {
      filter.counterparty = {
        $regex: `^${escapeRegex(normalized)}$`,
        $options: "i",
      };
    }
  }

  if (query.vendor) {
    const normalized = String(query.vendor).trim();
    if (normalized.length > 0) {
      filter.vendor = {
        $regex: `^${escapeRegex(normalized)}$`,
        $options: "i",
      };
    }
  }

  if (query.payment_status) {
    const status = String(query.payment_status).trim();
    if (status === "due") {
      filter.payment_status = "due";
    } else if (status === "paid") {
      // Treat missing/null field as "paid" (legacy transactions have no payment_status).
      // Use $and so we don't clobber the org-scope $or used for orphan inclusion.
      filter.$and = filter.$and ?? [];
      filter.$and.push({
        $or: [
          { payment_status: "paid" },
          { payment_status: { $exists: false } },
          { payment_status: null },
        ],
      });
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

    const scopeCondition =
      scopeClauses.length === 1 ? scopeClauses[0] : { $or: scopeClauses };

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
