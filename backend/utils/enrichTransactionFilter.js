import mongoose from "mongoose";
import { resolveCategoryIdsByName } from "./categoryFilter.js";
import {
  buildAdminTransactionScope,
  buildPartyFieldFilterCondition,
} from "./partyFilter.js";

const setCategoryIdCondition = (filter, ids) => {
  const condition =
    ids.length > 0
      ? { $in: ids }
      : { $in: [new mongoose.Types.ObjectId("000000000000000000000000")] };

  if (filter.category_id) {
    filter.category_id = condition;
    return;
  }

  if (Array.isArray(filter.$and)) {
    const idx = filter.$and.findIndex((clause) => clause.category_id);
    if (idx >= 0) {
      filter.$and[idx] = { category_id: condition };
      return;
    }
  }

  filter.category_id = condition;
};

const pushAndCondition = (filter, condition) => {
  filter.$and = filter.$and ?? [];
  filter.$and.push(condition);
};

/**
 * Expand chip filters (party / for_party / category) to include all records
 * that share the same display name — fixes duplicate Party/Category docs.
 */
export const enrichTransactionFilter = async (
  filter,
  query,
  { adminId, organizationId },
) => {
  const context = { adminId, organizationId };
  const transactionScope = buildAdminTransactionScope(adminId);

  const forPartyName = query.for_party_name?.trim();
  const forPartyId = query.for_party_id ?? query.for_party;
  if (forPartyName || forPartyId) {
    delete filter.for_party;
    const condition = await buildPartyFieldFilterCondition({
      field: "for_party",
      name: forPartyName,
      partyId: forPartyId,
      transactionScope,
      ...context,
    });
    pushAndCondition(filter, condition);
  }

  const partyName = query.party_name?.trim();
  const partyId = query.party_id ?? query.party;
  if (partyName || partyId) {
    delete filter.party;
    const condition = await buildPartyFieldFilterCondition({
      field: "party",
      name: partyName,
      partyId,
      transactionScope,
      ...context,
    });
    pushAndCondition(filter, condition);
  }

  const categoryName = query.category_name?.trim();
  const categoryId = query.categoryId ?? query.category_id;
  if (categoryName || categoryId) {
    const ids = await resolveCategoryIdsByName({
      name: categoryName,
      categoryId,
      ...context,
    });
    setCategoryIdCondition(filter, ids);
  }
};
