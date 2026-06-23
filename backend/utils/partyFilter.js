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

/** All transactions for an admin (personal + org-linked). */
export const buildAdminTransactionScope = (adminId) => ({
  admin: new mongoose.Types.ObjectId(adminId),
  is_deleted: false,
});

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

const collectLegacyNameVariants = async (searchName, transactionScope) => {
  const targetKey = loosePartyNameKey(searchName);
  const firstToken = searchName.split(/\s+/)[0];
  const legacyTxns = await Transaction.find({
    ...transactionScope,
    $or: [
      { vendor: { $regex: escapeRegex(firstToken), $options: "i" } },
      { counterparty: { $regex: escapeRegex(firstToken), $options: "i" } },
    ],
  })
    .select("vendor counterparty")
    .limit(500)
    .lean();

  const variants = new Set();
  for (const txn of legacyTxns) {
    if (txn.vendor && loosePartyNameKey(txn.vendor) === targetKey) {
      variants.add(txn.vendor.trim());
    }
    if (txn.counterparty && loosePartyNameKey(txn.counterparty) === targetKey) {
      variants.add(txn.counterparty.trim());
    }
  }
  return [...variants];
};

/**
 * Fallback: find party IDs already referenced on transactions.
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
    const partyId = typeof ref === "object" ? ref._id : ref;
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
    candidates = await Party.find({ admin: scope.admin, archived: false })
      .select("_id name")
      .lean();
    matched = candidates.filter(
      (party) => loosePartyNameKey(party.name) === targetKey,
    );
  }

  if (matched.length > 0) {
    return matched.map((party) => party._id);
  }

  const lookupScope =
    transactionScope ?? buildAdminTransactionScope(adminId);

  const fromTxns = await resolvePartyIdsFromTransactions({
    name: searchName,
    field: partyField,
    transactionScope: lookupScope,
  });
  if (fromTxns.length > 0) return fromTxns;

  if (partyId && mongoose.isValidObjectId(String(partyId))) {
    return [new mongoose.Types.ObjectId(String(partyId))];
  }

  return [];
};

/**
 * Build a MongoDB condition for filtering transactions by party display name.
 * Matches party ObjectId refs and legacy vendor/counterparty strings.
 */
export const buildPartyFieldFilterCondition = async ({
  field,
  name,
  partyId,
  adminId,
  organizationId,
  transactionScope,
}) => {
  const lookupScope =
    transactionScope ?? buildAdminTransactionScope(adminId);

  const ids = await resolvePartyIdsByName({
    name,
    partyId,
    adminId,
    organizationId,
    transactionScope: lookupScope,
    partyField: field,
  });

  const clauses = [];
  if (ids.length > 0) {
    clauses.push({ [field]: { $in: ids } });
  }

  const searchName = name?.trim();
  if (searchName && field === "party") {
    const exactRegex = {
      $regex: `^${escapeRegex(searchName)}$`,
      $options: "i",
    };
    clauses.push({ vendor: exactRegex });
    clauses.push({ counterparty: exactRegex });

    const legacyVariants = await collectLegacyNameVariants(
      searchName,
      lookupScope,
    );
    for (const variant of legacyVariants) {
      if (variant !== searchName) {
        clauses.push({ vendor: variant });
        clauses.push({ counterparty: variant });
      }
    }
  }

  if (clauses.length === 0) {
    return {
      [field]: {
        $in: [new mongoose.Types.ObjectId("000000000000000000000000")],
      },
    };
  }

  return clauses.length === 1 ? clauses[0] : { $or: clauses };
};

/**
 * Find an existing party by loose-normalized name (dedupe on create).
 */
export const findPartyByLooseName = async ({
  adminId,
  organizationId,
  name,
}) => {
  const scope = buildPartyScope({ adminId, organizationId });
  const targetKey = loosePartyNameKey(name);
  const parties = await Party.find({ admin: scope.admin, archived: false })
    .select("_id name type organization")
    .lean();

  return (
    parties.find((party) => loosePartyNameKey(party.name) === targetKey) ?? null
  );
};
