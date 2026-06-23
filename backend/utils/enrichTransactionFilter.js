import mongoose from "mongoose";
import { resolvePartyIdsByName } from "./partyFilter.js";
import { buildTransactionScope } from "./partyFilter.js";
import { resolveCategoryIdsByName } from "./categoryFilter.js";

const emptyObjectId = () =>
  new mongoose.Types.ObjectId("000000000000000000000000");

const setCategoryIdCondition = (filter, ids) => {
  const condition =
    ids.length > 0 ? { $in: ids } : { $in: [emptyObjectId()] };

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

/**
 * Expand chip filters (party / for_party / category) to include all records
 * that share the same display name — fixes duplicate Party/Category docs.
 */
export const enrichTransactionFilter = async (
  filter,
  query,
  { adminId, organizationId, transactionOrganizationId },
) => {
  const context = { adminId, organizationId };
  const transactionScope = buildTransactionScope({
    adminId,
    organizationId: transactionOrganizationId ?? null,
  });

  const forPartyName = query.for_party_name?.trim();
  const forPartyId = query.for_party_id ?? query.for_party;
  if (forPartyName || forPartyId) {
    const ids = await resolvePartyIdsByName({
      name: forPartyName,
      partyId: forPartyId,
      transactionScope,
      partyField: "for_party",
      ...context,
    });
    delete filter.for_party;
    filter.for_party =
      ids.length > 0 ? { $in: ids } : { $in: [emptyObjectId()] };
  }

  const partyName = query.party_name?.trim();
  const partyId = query.party_id ?? query.party;
  if (partyName || partyId) {
    const ids = await resolvePartyIdsByName({
      name: partyName,
      partyId,
      transactionScope,
      partyField: "party",
      ...context,
    });
    delete filter.party;
    filter.party = ids.length > 0 ? { $in: ids } : { $in: [emptyObjectId()] };
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
