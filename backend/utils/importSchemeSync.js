import { Party } from "../models/Party.js";
import { CollectionScheme } from "../models/CollectionScheme.js";
import { SchemeMember } from "../models/SchemeMember.js";
import { convertBanglaToEnglish } from "./importParser.js";

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Infer rate_per_member from a scheme/column name.
 * Examples: "১০০০ টাকা" → 1000, "৫০০ টাকা - ২" → 500, "ছাগল টোকা" → null
 */
export const inferRateFromSchemeName = (name) => {
  if (!name) return null;
  const normalized = convertBanglaToEnglish(String(name));
  const match = normalized.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const rate = parseFloat(String(match[1]).replace(/,/g, ""));
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return rate;
};

const partyScopeFilter = (adminId, organizationId) => {
  if (organizationId) {
    return {
      organization: organizationId,
      archived: { $ne: true },
    };
  }
  return {
    admin: adminId,
    organization: { $exists: false },
    archived: { $ne: true },
  };
};

const schemeScopeFilter = (adminId, organizationId) => {
  if (organizationId) {
    return {
      organization: organizationId,
      archived: { $ne: true },
    };
  }
  return {
    admin: adminId,
    organization: { $exists: false },
    archived: { $ne: true },
  };
};

/**
 * Find or create a party (family) by display name within the import scope.
 */
export const findOrCreateImportParty = async ({
  adminId,
  organizationId,
  name,
  session,
  cache,
}) => {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;

  const cacheKey = trimmed.toLowerCase();
  if (cache?.has(cacheKey)) return cache.get(cacheKey);

  const scope = partyScopeFilter(adminId, organizationId);
  let party = await Party.findOne({ ...scope, name: trimmed }).session(session);

  if (!party) {
    party = await Party.findOne({
      ...scope,
      name: { $regex: `^${escapeRegex(trimmed)}$`, $options: "i" },
    }).session(session);
  }

  if (!party) {
    const created = await Party.create(
      [
        {
          admin: adminId,
          organization: organizationId || undefined,
          name: trimmed,
          type: "both",
          created_by: adminId,
        },
      ],
      { session },
    );
    party = created[0];
  }

  if (cache) cache.set(cacheKey, party);
  return party;
};

/**
 * Find or create a collection scheme named after the ledger column.
 */
export const findOrCreateImportScheme = async ({
  adminId,
  organizationId,
  name,
  defaultAccountId,
  session,
  cache,
}) => {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;

  const cacheKey = trimmed.toLowerCase();
  if (cache?.has(cacheKey)) return cache.get(cacheKey);

  const scope = schemeScopeFilter(adminId, organizationId);
  const inferredRate = inferRateFromSchemeName(trimmed);

  let scheme = await CollectionScheme.findOne({
    ...scope,
    name: trimmed,
  }).session(session);

  if (!scheme) {
    scheme = await CollectionScheme.findOne({
      ...scope,
      name: { $regex: `^${escapeRegex(trimmed)}$`, $options: "i" },
    }).session(session);
  }

  if (!scheme) {
    const created = await CollectionScheme.create(
      [
        {
          admin: adminId,
          organization: organizationId || undefined,
          name: trimmed,
          rate_per_member: inferredRate ?? 0,
          default_account: defaultAccountId || undefined,
          created_by: adminId,
        },
      ],
      { session },
    );
    scheme = created[0];
  } else {
    let dirty = false;
    if (
      inferredRate != null &&
      inferredRate > 0 &&
      (!scheme.rate_per_member || Number(scheme.rate_per_member) === 0)
    ) {
      scheme.rate_per_member = inferredRate;
      dirty = true;
    }
    if (!scheme.default_account && defaultAccountId) {
      scheme.default_account = defaultAccountId;
      dirty = true;
    }
    if (dirty) {
      await scheme.save({ session });
    }
  }

  if (cache) cache.set(cacheKey, scheme);
  return scheme;
};

/**
 * Enroll or update family member_count / sort_order on a scheme.
 * Member counts and village order can change over time — apply values from this row.
 */
export const upsertImportSchemeMember = async ({
  scheme,
  party,
  memberCount,
  sortOrder,
  adminId,
  organizationId,
  session,
}) => {
  const count = Number(memberCount);
  if (!Number.isFinite(count) || count < 1) return null;
  const order =
    Number.isFinite(Number(sortOrder)) && Number(sortOrder) >= 1
      ? Math.min(10000, Math.round(Number(sortOrder)))
      : undefined;

  let member = await SchemeMember.findOne({
    scheme: scheme._id,
    party: party._id,
    archived: { $ne: true },
  }).session(session);

  if (member) {
    let dirty = false;
    if (Number(member.member_count) !== count) {
      member.member_count = count;
      dirty = true;
    }
    if (order !== undefined && Number(member.sort_order) !== order) {
      member.sort_order = order;
      dirty = true;
    }
    if (dirty) await member.save({ session });
    return member;
  }

  const archived = await SchemeMember.findOne({
    scheme: scheme._id,
    party: party._id,
    archived: true,
  }).session(session);

  if (archived) {
    archived.archived = false;
    archived.archived_at = undefined;
    archived.member_count = count;
    if (order !== undefined) archived.sort_order = order;
    await archived.save({ session });
    return archived;
  }

  const created = await SchemeMember.create(
    [
      {
        scheme: scheme._id,
        party: party._id,
        member_count: count,
        sort_order: order,
        admin: adminId,
        organization: organizationId || scheme.organization || undefined,
      },
    ],
    { session },
  );
  return created[0];
};

/**
 * Adjust party ledger balance for an imported scheme payment (mirrors recordPayment).
 */
export const adjustImportPartyBalance = async ({
  partyId,
  amount,
  type,
  session,
}) => {
  if (!partyId) return null;
  const partyDoc = await Party.findById(partyId)
    .select("type")
    .session(session)
    .lean();
  if (!partyDoc) return null;

  const isCustomer = partyDoc.type === "customer";
  const delta = isCustomer
    ? type === "credit"
      ? Number(amount)
      : -Number(amount)
    : type === "debit"
      ? Number(amount)
      : -Number(amount);

  const updated = await Party.findByIdAndUpdate(
    partyId,
    { $inc: { current_balance: delta } },
    { new: true, session },
  );
  return updated?.current_balance ?? null;
};
