import { Party, PARTY_TYPE_OPTIONS } from "../models/Party.js";
import { OrganizationMember } from "../models/OrganizationMember.js";
import { Transaction } from "../models/Transaction.js";
import { Invoice } from "../models/Invoice.js";
import { Category } from "../models/Category.js";
import {
  findPartyByLooseName,
  loosePartyNameKey,
} from "../utils/partyFilter.js";
import mongoose from "mongoose";

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * ObjectId + legacy name refs that link a transaction to a party.
 * Older imports often stored the party only as vendor/counterparty text.
 */
const buildPartyLinkOrConditions = (party, nameVariants = []) => {
  const partyId = party._id;
  const or = [{ party: partyId }, { for_party: partyId }];

  const names = new Set();
  const primary = (party.name || "").trim();
  if (primary) names.add(primary);
  for (const n of nameVariants) {
    const t = String(n || "").trim();
    if (t) names.add(t);
  }

  for (const name of names) {
    const nameRegex = new RegExp(`^${escapeRegex(name)}$`, "i");
    or.push({ vendor: nameRegex }, { counterparty: nameRegex });
  }

  return or;
};

/**
 * Scope used for merge name rewrites (admin + org-safe).
 * MongoDB `{ organization: null }` matches both missing and null.
 */
const buildPartyTransactionScope = (party) => {
  if (party.organization) {
    return {
      is_deleted: { $ne: true },
      $or: [
        { organization: party.organization },
        { admin: party.admin, organization: null },
      ],
    };
  }
  return {
    admin: party.admin,
    organization: null,
    is_deleted: { $ne: true },
  };
};

/**
 * Find vendor/counterparty spelling variants that loosely match the party name
 * (Bengali vowel-sign / whitespace / case differences).
 */
const collectPartyNameVariants = async (party) => {
  const name = (party.name || "").trim();
  if (!name) return [];

  const targetKey = loosePartyNameKey(name);
  const firstToken = name.split(/\s+/).find((t) => t.length >= 2) || name;
  // Also scan org-scoped transactions when collecting name variants
  const candidateFilter = party.organization
    ? {
        is_deleted: { $ne: true },
        $or: [
          { admin: party.admin },
          { organization: party.organization },
        ],
        $and: [
          {
            $or: [
              { vendor: { $regex: escapeRegex(firstToken), $options: "i" } },
              {
                counterparty: {
                  $regex: escapeRegex(firstToken),
                  $options: "i",
                },
              },
            ],
          },
        ],
      }
    : {
        admin: party.admin,
        is_deleted: { $ne: true },
        $or: [
          { vendor: { $regex: escapeRegex(firstToken), $options: "i" } },
          { counterparty: { $regex: escapeRegex(firstToken), $options: "i" } },
        ],
      };

  const candidates = await Transaction.find(candidateFilter)
    .select("vendor counterparty")
    .limit(400)
    .lean();

  const variants = new Set([name]);
  for (const txn of candidates) {
    if (txn.vendor && loosePartyNameKey(txn.vendor) === targetKey) {
      variants.add(String(txn.vendor).trim());
    }
    if (txn.counterparty && loosePartyNameKey(txn.counterparty) === targetKey) {
      variants.add(String(txn.counterparty).trim());
    }
  }
  return [...variants];
};

/**
 * Ledger / balance match for a party.
 *
 * ObjectId links are matched directly (ids are unique — no org/admin filter),
 * which keeps ledger in sync with balance updates from any org member.
 * Legacy vendor/counterparty names are admin-scoped (+ loose name variants).
 */
const buildPartyTransactionMatch = async (party) => {
  const variants = await collectPartyNameVariants(party);
  const nameOr = [];
  for (const name of variants) {
    const nameRegex = new RegExp(`^${escapeRegex(name)}$`, "i");
    // Match by owner admin OR by shared organization (member-created txns)
    nameOr.push(
      { vendor: nameRegex, admin: party.admin },
      { counterparty: nameRegex, admin: party.admin },
    );
    if (party.organization) {
      nameOr.push(
        { vendor: nameRegex, organization: party.organization },
        { counterparty: nameRegex, organization: party.organization },
      );
    }
  }

  return {
    is_deleted: { $ne: true },
    $or: [{ party: party._id }, { for_party: party._id }, ...nameOr],
  };
};

/**
 * Count non-deleted transactions linked to a party (ObjectId + legacy name refs).
 */
const countPartyLinkedTransactions = async (party) => {
  return Transaction.countDocuments(await buildPartyTransactionMatch(party));
};

/**
 * Count invoices linked to a party.
 */
const countPartyLinkedInvoices = async (partyId) => {
  return Invoice.countDocuments({ party: partyId });
};

/**
 * Recalculate current_balance + total_transactions for a party from its txns.
 */
const recalculatePartyBalance = async (partyId, partyType) => {
  const party = await Party.findById(partyId).lean();
  if (!party) return 0;

  const [agg] = await Transaction.aggregate([
    {
      $match: await buildPartyTransactionMatch(party),
    },
    {
      $group: {
        _id: null,
        total_credit: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$type", "credit"] },
                  { $ne: ["$payment_status", "due"] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
        total_debit: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$type", "debit"] },
                  { $ne: ["$payment_status", "due"] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
        debit_count: {
          $sum: { $cond: [{ $eq: ["$type", "debit"] }, 1, 0] },
        },
        credit_count: {
          $sum: { $cond: [{ $eq: ["$type", "credit"] }, 1, 0] },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const totalCredit = agg?.total_credit ?? 0;
  const totalDebit = agg?.total_debit ?? 0;
  const balance =
    partyType === "customer"
      ? totalCredit - totalDebit
      : totalDebit - totalCredit;

  await Party.updateOne(
    { _id: partyId },
    {
      $set: {
        current_balance: balance,
        total_transactions: agg?.count ?? 0,
        debit_transactions: agg?.debit_count ?? 0,
        credit_transactions: agg?.credit_count ?? 0,
      },
    },
  );
  return balance;
};

/**
 * Attach live debit/credit txn counts for a page of parties (ObjectId links).
 * Unscoped by org/admin — party ObjectIds are unique.
 */
const attachPartyTxnTypeCounts = async (parties) => {
  if (!parties?.length) return parties;

  const ids = parties.map((p) => p._id);

  const [asParty, asForParty] = await Promise.all([
    Transaction.aggregate([
      {
        $match: {
          is_deleted: { $ne: true },
          party: { $in: ids },
        },
      },
      {
        $group: {
          _id: { id: "$party", type: "$type" },
          count: { $sum: 1 },
        },
      },
    ]),
    Transaction.aggregate([
      {
        $match: {
          is_deleted: { $ne: true },
          for_party: { $in: ids },
        },
      },
      {
        $group: {
          _id: { id: "$for_party", type: "$type" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const debit = Object.create(null);
  const credit = Object.create(null);
  const apply = (rows) => {
    for (const row of rows) {
      if (!row?._id?.id) continue;
      const id = String(row._id.id);
      const bag = row._id.type === "credit" ? credit : debit;
      bag[id] = (bag[id] || 0) + row.count;
    }
  };
  apply(asParty);
  apply(asForParty);

  return parties.map((p) => {
    const id = String(p._id);
    const debitCount = debit[id] || 0;
    const creditCount = credit[id] || 0;
    const liveTotal = debitCount + creditCount;
    return {
      ...p,
      debit_transactions: liveTotal > 0 ? debitCount : p.debit_transactions || 0,
      credit_transactions:
        liveTotal > 0 ? creditCount : p.credit_transactions || 0,
      total_transactions:
        liveTotal > 0 ? liveTotal : p.total_transactions || 0,
    };
  });
};

const assertPartyManageAccess = async (userId, party) => {
  const permission =
    party.type === "customer" ? "manage_customers" : "manage_suppliers";
  if (party.organization) {
    const access = await checkOrgAccess(userId, party.organization, permission);
    if (!access.hasAccess) {
      return { ok: false, status: 403, message: access.error };
    }
  } else if (party.admin.toString() !== userId) {
    return { ok: false, status: 403, message: "Access denied" };
  }
  return { ok: true };
};


/**
 * Check organization access and permission
 */
const checkOrgAccess = async (userId, organizationId, permission) => {
  if (!organizationId) {
    return { hasAccess: true, isPersonal: true };
  }

  const membership = await OrganizationMember.findOne({
    organization: organizationId,
    user: userId,
    status: "active",
  });

  if (!membership) {
    return { hasAccess: false, error: "Access denied to this organization" };
  }

  if (permission && !membership.hasPermission(permission)) {
    return {
      hasAccess: false,
      error: `You don't have ${permission} permission`,
    };
  }

  return { hasAccess: true, membership, isPersonal: false };
};

/**
 * Create a new party (customer/supplier)
 */
export const createParty = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      organization,
      type,
      name,
      phone,
      email,
      address,
      opening_balance,
      credit_limit,
      payment_terms_days,
      tax_id,
      notes,
      tags,
    } = req.body;

    if (!name || name.trim().length < 2) {
      return res
        .status(400)
        .json({ message: "Name is required (min 2 characters)" });
    }

    // Check organization access
    const resolvedType = type || "both";
    const permission =
      resolvedType === "customer"
        ? "manage_customers"
        : resolvedType === "supplier"
          ? "manage_suppliers"
          : "manage_customers";
    const access = await checkOrgAccess(userId, organization, permission);
    if (!access.hasAccess) {
      return res.status(403).json({ message: access.error });
    }

    const trimmedName = name.trim();

    // Reuse existing party with the same display name (loose match)
    const existing = await findPartyByLooseName({
      adminId: userId,
      organizationId: organization,
      name: trimmedName,
    });
    if (existing) {
      const updates = {};
      if (resolvedType === "both" && existing.type !== "both") {
        updates.type = "both";
      }
      if (Object.keys(updates).length > 0) {
        await Party.findByIdAndUpdate(existing._id, { $set: updates });
        existing.type = updates.type;
      }
      return res.status(200).json({
        message: "Party already exists",
        party: existing,
        existing: true,
      });
    }

    const party = await Party.create({
      organization,
      admin: userId,
      type: resolvedType,
      name: trimmedName,
      phone,
      email,
      address,
      opening_balance: opening_balance || 0,
      credit_limit,
      payment_terms_days,
      tax_id,
      notes,
      tags,
      created_by: userId,
    });

    res.status(201).json({
      message: `${
        type === "supplier" ? "Supplier" : "Customer"
      } created successfully`,
      party,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "A party with this code already exists" });
    }
    next(error);
  }
};

/**
 * Scope for listing parties.
 * When an organization is active, include that org's parties PLUS the user's
 * legacy personal parties (no organization) — older data was created before
 * org assignment and would otherwise disappear from the list.
 */
const buildPartyListScope = (userId, organization) => {
  if (organization) {
    return {
      $or: [
        { organization },
        // MongoDB { organization: null } matches missing OR null
        { admin: userId, organization: null },
      ],
    };
  }
  return {
    admin: userId,
    organization: null,
  };
};

/**
 * Get parties list
 */
export const getParties = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      organization,
      type,
      search,
      archived,
      page = 1,
      limit = 50,
      sort = "-updatedAt",
    } = req.query;

    if (organization) {
      const access = await checkOrgAccess(userId, organization);
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    }

    const and = [buildPartyListScope(userId, organization || null)];

    if (type && PARTY_TYPE_OPTIONS.includes(type)) {
      // Include parties with type "both" when filtering by customer or supplier
      and.push({
        type: type === "both" ? "both" : { $in: [type, "both"] },
      });
    }

    if (archived === "true") {
      and.push({ archived: true });
    } else if (archived !== "all") {
      and.push({ archived: { $ne: true } });
    }

    if (search) {
      const escapedSearch = escapeRegex(search);
      and.push({
        $or: [
          { name: { $regex: escapedSearch, $options: "i" } },
          { phone: { $regex: escapedSearch, $options: "i" } },
          { email: { $regex: escapedSearch, $options: "i" } },
          { code: { $regex: escapedSearch, $options: "i" } },
        ],
      });
    }

    const query = and.length === 1 ? and[0] : { $and: and };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * pageLimit;
    const sortObj = {};
    const sortField = sort.startsWith("-") ? sort.substring(1) : sort;
    sortObj[sortField] = sort.startsWith("-") ? -1 : 1;

    const [parties, total] = await Promise.all([
      Party.find(query).sort(sortObj).skip(skip).limit(pageLimit).lean(),
      Party.countDocuments(query),
    ]);

    const partiesWithCounts = await attachPartyTxnTypeCounts(parties);

    res.json({
      parties: partiesWithCounts,
      pagination: {
        page: pageNum,
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit) || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single party
 */
export const getParty = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { partyId } = req.params;

    const party = await Party.findById(partyId);

    if (!party) {
      return res.status(404).json({ message: "Party not found" });
    }

    // Check access
    if (party.organization) {
      const access = await checkOrgAccess(userId, party.organization);
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    } else if (party.admin.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({ party });
  } catch (error) {
    next(error);
  }
};

/**
 * Update party
 */
export const updateParty = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { partyId } = req.params;
    const updates = req.body;

    const party = await Party.findById(partyId);

    if (!party) {
      return res.status(404).json({ message: "Party not found" });
    }

    // Check access
    const permission =
      party.type === "customer" ? "manage_customers" : "manage_suppliers";
    if (party.organization) {
      const access = await checkOrgAccess(
        userId,
        party.organization,
        permission,
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    } else if (party.admin.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Allowed updates
    const allowedFields = [
      "name",
      "phone",
      "email",
      "address",
      "credit_limit",
      "payment_terms_days",
      "tax_id",
      "notes",
      "tags",
      "type",
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        party[field] = updates[field];
      }
    }

    await party.save();

    res.json({
      message: "Party updated successfully",
      party,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Archive/unarchive party
 */
export const archiveParty = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { partyId } = req.params;
    const { archived } = req.body;

    const party = await Party.findById(partyId);

    if (!party) {
      return res.status(404).json({ message: "Party not found" });
    }

    const access = await assertPartyManageAccess(userId, party);
    if (!access.ok) {
      return res.status(access.status).json({ message: access.message });
    }

    party.archived = archived !== false;
    party.archived_at = archived !== false ? new Date() : undefined;
    await party.save();

    res.json({
      message: `Party ${
        archived !== false ? "archived" : "unarchived"
      } successfully`,
      party,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Hard-delete a party. Blocked if any transactions or invoices still reference it.
 */
export const deleteParty = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { partyId } = req.params;

    const party = await Party.findById(partyId);
    if (!party) {
      return res.status(404).json({ message: "Party not found" });
    }

    const access = await assertPartyManageAccess(userId, party);
    if (!access.ok) {
      return res.status(access.status).json({ message: access.message });
    }

    const [transactionCount, invoiceCount] = await Promise.all([
      countPartyLinkedTransactions(party),
      countPartyLinkedInvoices(party._id),
    ]);

    if (transactionCount > 0 || invoiceCount > 0) {
      const parts = [];
      if (transactionCount > 0) {
        parts.push(
          `${transactionCount} transaction${transactionCount > 1 ? "s" : ""}`,
        );
      }
      if (invoiceCount > 0) {
        parts.push(
          `${invoiceCount} invoice${invoiceCount > 1 ? "s" : ""}`,
        );
      }
      return res.status(400).json({
        message: `Cannot delete "${party.name}". It has ${parts.join(
          " and ",
        )} linked. Delete those first, or merge this party into another similar party.`,
        transactionCount,
        invoiceCount,
        canMerge: true,
        partyId: party._id,
        partyName: party.name,
      });
    }

    await Party.deleteOne({ _id: partyId });

    res.json({ message: "Party deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Merge source party into target: reassign transactions/invoices.
 * Source party is kept so the user can delete it manually afterward.
 */
export const mergeParties = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { partyId } = req.params;
    const { targetPartyId } = req.body;

    if (!targetPartyId) {
      return res.status(400).json({ message: "targetPartyId is required" });
    }
    if (partyId === targetPartyId) {
      return res
        .status(400)
        .json({ message: "Cannot merge a party into itself" });
    }

    const [source, target] = await Promise.all([
      Party.findById(partyId),
      Party.findById(targetPartyId),
    ]);

    if (!source) {
      return res.status(404).json({ message: "Source party not found" });
    }
    if (!target) {
      return res.status(404).json({ message: "Target party not found" });
    }

    // Same org/personal scope
    const sourceOrg = source.organization?.toString() || null;
    const targetOrg = target.organization?.toString() || null;
    if (sourceOrg !== targetOrg) {
      return res.status(400).json({
        message: "Cannot merge parties across different organizations",
      });
    }
    if (!sourceOrg && source.admin.toString() !== target.admin.toString()) {
      return res.status(400).json({
        message: "Cannot merge parties belonging to different users",
      });
    }

    const sourceAccess = await assertPartyManageAccess(userId, source);
    if (!sourceAccess.ok) {
      return res
        .status(sourceAccess.status)
        .json({ message: sourceAccess.message });
    }
    const targetAccess = await assertPartyManageAccess(userId, target);
    if (!targetAccess.ok) {
      return res
        .status(targetAccess.status)
        .json({ message: targetAccess.message });
    }

    const sourceName = (source.name || "").trim();
    const targetName = (target.name || "").trim();
    const nameRegex = sourceName
      ? new RegExp(`^${escapeRegex(sourceName)}$`, "i")
      : null;
    const txnScope = buildPartyTransactionScope(source);

    // 1) Reassign ObjectId party / for_party refs (keep category, account, etc.)
    const [partyResult, forPartyResult] = await Promise.all([
      Transaction.updateMany(
        { party: source._id, is_deleted: { $ne: true } },
        { $set: { party: target._id } },
      ),
      Transaction.updateMany(
        { for_party: source._id, is_deleted: { $ne: true } },
        { $set: { for_party: target._id } },
      ),
    ]);

    // 2) Legacy vendor / counterparty name strings → target display name
    //    AND attach party ObjectId relation (not name-only links).
    let vendorResult = { modifiedCount: 0 };
    let counterpartyResult = { modifiedCount: 0 };

    if (nameRegex && targetName) {
      // Vendor matched source name: update text + ensure party ObjectId = target
      // (only set party when missing or still pointing at source)
      const vendorMatched = await Transaction.find({
        ...txnScope,
        vendor: nameRegex,
      })
        .select("_id party")
        .lean();

      if (vendorMatched.length) {
        const ops = vendorMatched.map((txn) => {
          const setFields = { vendor: targetName };
          if (!txn.party || String(txn.party) === String(source._id)) {
            setFields.party = target._id;
          }
          return {
            updateOne: {
              filter: { _id: txn._id },
              update: { $set: setFields },
            },
          };
        });
        const bulk = await Transaction.bulkWrite(ops, { ordered: false });
        vendorResult = { modifiedCount: bulk.modifiedCount || 0 };
      }

      // Counterparty matched source name: update text + ensure party ObjectId = target
      const counterpartyMatched = await Transaction.find({
        ...txnScope,
        counterparty: nameRegex,
      })
        .select("_id party")
        .lean();

      if (counterpartyMatched.length) {
        const ops = counterpartyMatched.map((txn) => {
          const setFields = { counterparty: targetName };
          if (!txn.party || String(txn.party) === String(source._id)) {
            setFields.party = target._id;
          }
          return {
            updateOne: {
              filter: { _id: txn._id },
              update: { $set: setFields },
            },
          };
        });
        const bulk = await Transaction.bulkWrite(ops, { ordered: false });
        counterpartyResult = { modifiedCount: bulk.modifiedCount || 0 };
      }

      // Sync leftover display strings on already-reassigned ObjectId rows
      await Promise.all([
        Transaction.updateMany(
          { party: target._id, vendor: nameRegex, is_deleted: { $ne: true } },
          { $set: { vendor: targetName } },
        ),
        Transaction.updateMany(
          {
            party: target._id,
            counterparty: nameRegex,
            is_deleted: { $ne: true },
          },
          { $set: { counterparty: targetName } },
        ),
        Transaction.updateMany(
          {
            for_party: target._id,
            vendor: nameRegex,
            is_deleted: { $ne: true },
          },
          { $set: { vendor: targetName } },
        ),
        Transaction.updateMany(
          {
            for_party: target._id,
            counterparty: nameRegex,
            is_deleted: { $ne: true },
          },
          { $set: { counterparty: targetName } },
        ),
      ]);
    }

    // Reassign invoices (ObjectId relation only)
    const invoiceResult = await Invoice.updateMany(
      { party: source._id },
      { $set: { party: target._id } },
    );

    // Widen target type to "both" if roles differ
    if (source.type !== target.type && target.type !== "both") {
      target.type = "both";
      await target.save();
    }

    // Clear any leftover ObjectId refs on source (e.g. soft-deleted txns)
    await Transaction.updateMany(
      { party: source._id },
      { $unset: { party: "" } },
    );
    await Transaction.updateMany(
      { for_party: source._id },
      { $unset: { for_party: "" } },
    );

    // Recalculate both parties — keep source so the user can delete it later
    await Promise.all([
      recalculatePartyBalance(target._id, target.type),
      recalculatePartyBalance(source._id, source.type),
    ]);

    const refreshedSource = await Party.findById(source._id).lean();
    const refreshedTarget = await Party.findById(target._id).lean();

    const transactionsUpdated =
      (partyResult.modifiedCount || 0) +
      (forPartyResult.modifiedCount || 0) +
      (vendorResult.modifiedCount || 0) +
      (counterpartyResult.modifiedCount || 0);

    res.json({
      message: `Moved links from "${sourceName}" into "${targetName}". "${sourceName}" was kept — delete it separately if you no longer need it.`,
      source: refreshedSource,
      target: refreshedTarget,
      transactionsUpdated,
      invoicesUpdated: invoiceResult.modifiedCount || 0,
      sourceDeleted: false,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get party ledger (transaction history)
 */
export const getPartyLedger = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { partyId } = req.params;
    const {
      startDate,
      endDate,
      page = 1,
      limit = 50,
      search,
      type,
      sort = "-date",
    } = req.query;

    if (!mongoose.Types.ObjectId.isValid(partyId)) {
      return res.status(400).json({ message: "Invalid party id" });
    }

    const party = await Party.findById(partyId);
    if (!party) {
      return res.status(404).json({ message: "Party not found" });
    }

    if (party.organization) {
      const access = await checkOrgAccess(
        userId,
        party.organization,
        "view_transactions",
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    } else if (party.admin.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const andConditions = [await buildPartyTransactionMatch(party)];

    if (type === "debit" || type === "credit") {
      andConditions.push({ type });
    }

    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      andConditions.push({ date: dateFilter });
    }

    const searchText = search != null ? String(search).trim() : "";
    if (searchText) {
      const escaped = escapeRegex(searchText);
      const searchRegex = new RegExp(escaped, "i");
      const matchingCategories = await Category.find({
        name: searchRegex,
        ...(party.organization
          ? { organization: party.organization }
          : { admin: party.admin, organization: null }),
      })
        .select("_id")
        .limit(50)
        .lean();
      const categoryIds = matchingCategories.map((c) => c._id);

      andConditions.push({
        $or: [
          { description: searchRegex },
          { keyword: searchRegex },
          { vendor: searchRegex },
          { counterparty: searchRegex },
          ...(categoryIds.length
            ? [{ category_id: { $in: categoryIds } }]
            : []),
        ],
      });
    }

    const query = { $and: andConditions };
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * pageLimit;
    const isCustomer = party.type === "customer";
    const openingBalance = Number(party.opening_balance || 0);

    const sortRaw = String(sort || "-date");
    const sortField = sortRaw.startsWith("-") ? sortRaw.slice(1) : sortRaw;
    const sortDir = sortRaw.startsWith("-") ? -1 : 1;
    const allowedSort = new Set(["date", "amount", "type", "createdAt"]);
    const safeSortField = allowedSort.has(sortField) ? sortField : "date";
    const sortObj = {
      [safeSortField]: sortDir,
      createdAt: sortDir,
      _id: sortDir,
    };

    const [total, totalsAgg, pageTxns] = await Promise.all([
      Transaction.countDocuments(query),
      Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            total_debit: {
              $sum: {
                $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0],
              },
            },
            total_credit: {
              $sum: {
                $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0],
              },
            },
          },
        },
      ]),
      Transaction.find(query)
        .populate("account", "name kind")
        .populate("category_id", "name type")
        .sort(sortObj)
        .skip(skip)
        .limit(pageLimit)
        .lean(),
    ]);

    const applyDelta = (balance, txn) =>
      isCustomer
        ? balance + (txn.type === "credit" ? txn.amount : -txn.amount)
        : balance + (txn.type === "debit" ? txn.amount : -txn.amount);

    // Balance before this page's earliest chronological txn
    let balanceCursor = openingBalance;
    const chronological = [...pageTxns].sort(
      (a, b) =>
        new Date(a.date) - new Date(b.date) ||
        new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
    );

    if (chronological.length > 0) {
      const first = chronological[0];
      const beforeTxns = await Transaction.find({
        $and: [
          ...andConditions,
          {
            $or: [
              { date: { $lt: first.date } },
              {
                date: first.date,
                createdAt: { $lt: first.createdAt || first.date },
              },
            ],
          },
        ],
      })
        .select("type amount")
        .lean();
      for (const txn of beforeTxns) {
        balanceCursor = applyDelta(balanceCursor, txn);
      }
    }

    const balanceById = new Map();
    for (const txn of chronological) {
      balanceCursor = applyDelta(balanceCursor, txn);
      balanceById.set(String(txn._id), balanceCursor);
    }

    const entries = pageTxns.map((txn) => {
      const categoryName =
        typeof txn.category_id === "object" && txn.category_id
          ? txn.category_id.name
          : undefined;
      const accountName =
        typeof txn.account === "object" && txn.account
          ? txn.account.name
          : undefined;
      const description =
        (txn.description && String(txn.description).trim()) ||
        categoryName ||
        txn.type;

      return {
        _id: txn._id,
        date: txn.date,
        type: txn.type,
        description,
        comment: txn.keyword || "",
        reference: txn.reference || undefined,
        debit: txn.type === "debit" ? Number(txn.amount || 0) : 0,
        credit: txn.type === "credit" ? Number(txn.amount || 0) : 0,
        running_balance: balanceById.get(String(txn._id)) ?? 0,
        transaction_id: txn._id,
        invoice_id: txn.invoice || undefined,
        category_name: categoryName,
        account_name: accountName,
        payment_status: txn.payment_status,
        amount: txn.amount,
      };
    });

    const totalDebit = totalsAgg[0]?.total_debit ?? 0;
    const totalCredit = totalsAgg[0]?.total_credit ?? 0;
    const closingBalance = isCustomer
      ? openingBalance + totalCredit - totalDebit
      : openingBalance + totalDebit - totalCredit;

    res.json({
      party,
      net_balance: closingBalance,
      entries,
      summary: {
        opening_balance: openingBalance,
        total_debit: totalDebit,
        total_credit: totalCredit,
        closing_balance: closingBalance,
      },
      ledger: entries,
      pagination: {
        page: pageNum,
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit) || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPartyNetBalance = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { partyId } = req.params;

    const party = await Party.findById(partyId);
    if (!party) {
      return res.status(404).json({ message: "Party not found" });
    }

    if (party.organization) {
      const access = await checkOrgAccess(
        userId,
        party.organization,
        "view_transactions",
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    } else if (party.admin.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const [agg] = await Transaction.aggregate([
      {
        $match: {
          party: party._id,
          is_deleted: false,
          payment_status: { $ne: "due" }, // only settled cash transactions
        },
      },
      {
        $group: {
          _id: null,
          total_credit: {
            $sum: { $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0] },
          },
          total_debit: {
            $sum: { $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0] },
          },
          count: { $sum: 1 },
          last_transaction_at: { $max: "$date" },
        },
      },
    ]);

    const totalCredit = agg?.total_credit ?? 0;
    const totalDebit = agg?.total_debit ?? 0;
    const isCustomer = party.type === "customer";

    // Net balance: positive = we have a receivable from them, negative = we have a payable to them
    // customer convention: net = credit - debit (credit = they owe more, debit = they paid)
    // supplier/both convention: net = debit - credit (debit = we owe more, credit = we paid)
    const netBalance = isCustomer
      ? totalCredit - totalDebit + (party.opening_balance ?? 0)
      : totalDebit - totalCredit + (party.opening_balance ?? 0);

    let owingMessage;
    if (Math.abs(netBalance) < 0.01) {
      owingMessage = "settled";
    } else if (isCustomer) {
      owingMessage = netBalance > 0 ? "they_owe_you" : "you_owe_them"; // advance
    } else {
      owingMessage = netBalance > 0 ? "you_owe_them" : "they_owe_you";
    }

    // Outstanding dues (payment_status=due, not yet settled)
    const [dueAgg] = await Transaction.aggregate([
      {
        $match: {
          party: party._id,
          is_deleted: false,
          payment_status: "due",
        },
      },
      {
        $group: {
          _id: null,
          total_due: { $sum: { $ifNull: ["$due_remaining", "$amount"] } },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      party: {
        _id: party._id,
        name: party.name,
        type: party.type,
        code: party.code,
        phone: party.phone,
        opening_balance: party.opening_balance,
      },
      summary: {
        total_credit: totalCredit,
        total_debit: totalDebit,
        net_balance: netBalance,
        owing: owingMessage,
        transaction_count: agg?.count ?? 0,
        last_transaction_at: agg?.last_transaction_at ?? null,
      },
      outstanding_dues: {
        total: dueAgg?.total_due ?? 0,
        count: dueAgg?.count ?? 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get party summary/stats — uses aggregation pipeline for efficiency
 */
export const getPartySummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { organization, type } = req.query;

    // Build query — same scope as getParties (org + legacy personal)
    const matchFilter = buildPartyListScope(
      new mongoose.Types.ObjectId(userId),
      organization ? new mongoose.Types.ObjectId(organization) : null,
    );

    if (organization) {
      const access = await checkOrgAccess(userId, organization);
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    }

    const and = [matchFilter, { archived: { $ne: true } }];

    if (type && PARTY_TYPE_OPTIONS.includes(type)) {
      and.push({
        type: type === "both" ? "both" : { $in: [type, "both"] },
      });
    }

    const results = await Party.aggregate([
      { $match: and.length === 1 ? and[0] : { $and: and } },
      {
        $group: {
          _id: null,
          total_customers: {
            $sum: {
              $cond: [{ $in: ["$type", ["customer", "both"]] }, 1, 0],
            },
          },
          total_suppliers: {
            $sum: {
              $cond: [{ $in: ["$type", ["supplier", "both"]] }, 1, 0],
            },
          },
          total_receivable: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$type", ["customer", "both"]] },
                    { $gt: ["$current_balance", 0] },
                  ],
                },
                "$current_balance",
                0,
              ],
            },
          },
          total_payable: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$type", ["supplier", "both"]] },
                    { $gt: ["$current_balance", 0] },
                  ],
                },
                "$current_balance",
                0,
              ],
            },
          },
          customers_with_balance: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$type", ["customer", "both"]] },
                    { $gt: ["$current_balance", 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          suppliers_with_balance: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$type", ["supplier", "both"]] },
                    { $gt: ["$current_balance", 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const summary = results[0] ?? {
      total_customers: 0,
      total_suppliers: 0,
      total_receivable: 0,
      total_payable: 0,
      customers_with_balance: 0,
      suppliers_with_balance: 0,
    };
    delete summary._id;

    res.json({ summary });
  } catch (error) {
    next(error);
  }
};

/**
 * Get options
 */
export const getOptions = async (req, res) => {
  res.json({
    party_types: PARTY_TYPE_OPTIONS,
  });
};
