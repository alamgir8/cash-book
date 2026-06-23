import mongoose from "mongoose";
import { Party } from "../models/Party.js";
import { Transaction } from "../models/Transaction.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Normalize party names for comparison — handles case, whitespace, NFC,
 * and Bengali vowel-sign variants (e.g. নুরনবী vs নূরনবী).
 */
export const loosePartyNameKey = (name = "") =>
  String(name)
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\u09BE-\u09CC\u09D7]/g, "")
    .replace(/\u09BC/g, "");

export const buildPartyScope = ({ adminId, organizationId }) => {
  const base = {
    admin: new mongoose.Types.ObjectId(adminId),
    archived: false,
  };
  if (organizationId) {
    return {
      ...base,
      organization: new mongoose.Types.ObjectId(organizationId),
    };
  }
  return base;
};

export const buildTransactionScope = ({ adminId, organizationId }) =>
  organizationId
    ? {
        organization: new mongoose.Types.ObjectId(organizationId),
        is_deleted: false,
      }
    : {
        admin: new mongoose.Types.ObjectId(adminId),
        organization: { $exists: false },
        is_deleted: false,
      };

/**
 * Fallback: find party IDs already referenced on transactions (handles org
 * parties when organization context was missing from the Party lookup).
 */
export const resolvePartyIdsFromTransactions = async ({
  name,
  field,
  transactionScope,
}) => {
  const searchName = name?.trim();
  if (!searchName) return [];

  const targetKey = loosePartyNameKey(searchName);
  const txs = await Transaction.find({
    ...transactionScope,
    [field]: { $exists: true, $ne: null },
  })
    .select(field)
    .populate(field, "name")
    .lean();

  const ids = new Set();
  for (const txn of txs) {
    const ref = txn[field];
    if (!ref) continue;
    const partyName = typeof ref === "object" ? ref.name : null;
    const partyId =
      typeof ref === "object" ? ref._id : ref;
    if (
      partyName &&
      partyId &&
      loosePartyNameKey(partyName) === targetKey
    ) {
      ids.add(
        partyId instanceof mongoose.Types.ObjectId
          ? partyId
          : new mongoose.Types.ObjectId(String(partyId)),
      );
    }
  }

  return [...ids];
};

/**
 * Resolve all Party IDs that match a display name (loose) or expand a single ID
 * to every duplicate record with the same loose name.
 */
export const resolvePartyIdsByName = async ({
  name,
  partyId,
  adminId,
  organizationId,
  transactionScope,
  partyField = "for_party",
}) => {
  const scope = buildPartyScope({ adminId, organizationId });
  let searchName = name?.trim();

  if (
    !searchName &&
    partyId &&
    mongoose.isValidObjectId(String(partyId))
  ) {
    const doc = await Party.findOne({
      _id: new mongoose.Types.ObjectId(String(partyId)),
      admin: scope.admin,
    })
      .select("name")
      .lean();
    searchName = doc?.name?.trim();
  }

  if (!searchName) {
    if (partyId && mongoose.isValidObjectId(String(partyId))) {
      return [new mongoose.Types.ObjectId(String(partyId))];
    }
    return [];
  }

  const targetKey = loosePartyNameKey(searchName);
  const dashParts = searchName.split(/\s*-\s*/);
  const suffixPart =
    dashParts.length > 1 ? dashParts.slice(1).join("-").trim() : "";

  const candidateQuery = { ...scope };
  if (suffixPart.length > 0) {
    candidateQuery.name = {
      $regex: escapeRegex(suffixPart),
      $options: "i",
    };
  } else {
    const firstToken = searchName.split(/\s+/)[0];
    candidateQuery.name = {
      $regex: escapeRegex(firstToken),
      $options: "i",
    };
  }

  let candidates = await Party.find(candidateQuery).select("_id name").lean();

  let matched = candidates.filter(
    (party) => loosePartyNameKey(party.name) === targetKey,
  );

  if (matched.length === 0) {
    candidates = await Party.find(scope).select("_id name").lean();
    matched = candidates.filter(
      (party) => loosePartyNameKey(party.name) === targetKey,
    );
  }

  if (matched.length > 0) {
    return matched.map((party) => party._id);
  }

  if (transactionScope) {
    const fromTxns = await resolvePartyIdsFromTransactions({
      name: searchName,
      field: partyField,
      transactionScope,
    });
    if (fromTxns.length > 0) return fromTxns;
  }

  if (partyId && mongoose.isValidObjectId(String(partyId))) {
    return [new mongoose.Types.ObjectId(String(partyId))];
  }

  return [];
};
