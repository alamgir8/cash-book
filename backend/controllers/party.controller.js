import { Party, PARTY_TYPE_OPTIONS } from "../models/Party.js";
import { OrganizationMember } from "../models/OrganizationMember.js";
import { Transaction } from "../models/Transaction.js";
import { Invoice } from "../models/Invoice.js";
import {
  findPartyByLooseName,
} from "../utils/partyFilter.js";
import mongoose from "mongoose";

/**
 * Count non-deleted transactions linked to a party (ObjectId + legacy name refs).
 */
const countPartyLinkedTransactions = async (party) => {
  const partyId = party._id;
  const name = (party.name || "").trim();
  const or = [{ party: partyId }, { for_party: partyId }];

  if (name) {
    const nameRegex = new RegExp(`^${escapeRegex(name)}$`, "i");
    or.push({ vendor: nameRegex }, { counterparty: nameRegex });
  }

  return Transaction.countDocuments({
    is_deleted: { $ne: true },
    $or: or,
  });
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
  const oid = new mongoose.Types.ObjectId(partyId.toString());
  const [agg] = await Transaction.aggregate([
    {
      $match: {
        $or: [{ party: oid }, { for_party: oid }],
        is_deleted: { $ne: true },
        payment_status: { $ne: "due" },
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
      },
    },
  );
  return balance;
};

/**
 * Verify the authenticated user can manage this party.
 */
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
 * Escape regex special characters to prevent ReDoS attacks
 */
const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

    // Build query
    const query = {};

    if (organization) {
      const access = await checkOrgAccess(userId, organization);
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
      query.organization = organization;
    } else {
      query.admin = userId;
      query.organization = { $exists: false };
    }

    if (type && PARTY_TYPE_OPTIONS.includes(type)) {
      // Include parties with type "both" when filtering by customer or supplier
      query.type = type === "both" ? "both" : { $in: [type, "both"] };
    }

    if (archived === "true") {
      query.archived = true;
    } else if (archived !== "all") {
      query.archived = { $ne: true };
    }

    if (search) {
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { phone: { $regex: escapedSearch, $options: "i" } },
        { email: { $regex: escapedSearch, $options: "i" } },
        { code: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    const sortField = sort.startsWith("-") ? sort.substring(1) : sort;
    sortObj[sortField] = sort.startsWith("-") ? -1 : 1;

    const [parties, total] = await Promise.all([
      Party.find(query).sort(sortObj).skip(skip).limit(parseInt(limit)).lean(),
      Party.countDocuments(query),
    ]);

    res.json({
      parties,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
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
 * Merge source party into target: reassign transactions/invoices, then delete source.
 * Body: { targetPartyId }
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

    // Reassign ObjectId refs
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

    // Reassign legacy string refs that match the source name
    let vendorResult = { modifiedCount: 0 };
    let counterpartyResult = { modifiedCount: 0 };
    if (nameRegex && targetName) {
      [vendorResult, counterpartyResult] = await Promise.all([
        Transaction.updateMany(
          { vendor: nameRegex, is_deleted: { $ne: true } },
          { $set: { vendor: targetName } },
        ),
        Transaction.updateMany(
          { counterparty: nameRegex, is_deleted: { $ne: true } },
          { $set: { counterparty: targetName } },
        ),
      ]);
    }

    // Reassign invoices
    const invoiceResult = await Invoice.updateMany(
      { party: source._id },
      { $set: { party: target._id } },
    );

    // Widen target type to "both" if roles differ
    if (source.type !== target.type && target.type !== "both") {
      target.type = "both";
      await target.save();
    }

    // Recalculate balances
    await recalculatePartyBalance(target._id, target.type);

    // Soft-clear any remaining refs on deleted/due txns, then remove source
    await Transaction.updateMany(
      { party: source._id },
      { $unset: { party: "" } },
    );
    await Transaction.updateMany(
      { for_party: source._id },
      { $unset: { for_party: "" } },
    );

    await Party.deleteOne({ _id: source._id });

    const transactionsUpdated =
      (partyResult.modifiedCount || 0) +
      (forPartyResult.modifiedCount || 0) +
      (vendorResult.modifiedCount || 0) +
      (counterpartyResult.modifiedCount || 0);

    res.json({
      message: `Merged "${sourceName}" into "${targetName}" successfully`,
      target,
      transactionsUpdated,
      invoicesUpdated: invoiceResult.modifiedCount || 0,
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
    const { startDate, endDate, page = 1, limit = 50 } = req.query;

    const party = await Party.findById(partyId);

    if (!party) {
      return res.status(404).json({ message: "Party not found" });
    }

    // Check access
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

    const partyOid = new mongoose.Types.ObjectId(partyId);
    const query = {
      $or: [{ party: partyOid }, { for_party: partyOid }],
      is_deleted: { $ne: true },
    };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * pageLimit;
    const isCustomer = party.type === "customer";
    const openingBalance = Number(party.opening_balance || 0);

    const applyDelta = (balance, txn) => {
      if (isCustomer) {
        return balance + (txn.type === "credit" ? txn.amount : -txn.amount);
      }
      return balance + (txn.type === "debit" ? txn.amount : -txn.amount);
    };

    const [total, totalsAgg, priorTxns, pageTxns] = await Promise.all([
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
      skip > 0
        ? Transaction.find(query)
            .select("type amount")
            .sort({ date: 1, createdAt: 1 })
            .limit(skip)
            .lean()
        : Promise.resolve([]),
      Transaction.find(query)
        .populate("account", "name kind")
        .populate("category_id", "name type")
        .sort({ date: 1, createdAt: 1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
    ]);

    let runningBalance = openingBalance;
    for (const txn of priorTxns) {
      runningBalance = applyDelta(runningBalance, txn);
    }

    const entriesAsc = pageTxns.map((txn) => {
      runningBalance = applyDelta(runningBalance, txn);
      const debit = txn.type === "debit" ? Number(txn.amount || 0) : 0;
      const credit = txn.type === "credit" ? Number(txn.amount || 0) : 0;
      return {
        _id: txn._id,
        date: txn.date,
        type: txn.type,
        description:
          txn.description ||
          txn.comment ||
          (typeof txn.category_id === "object" ? txn.category_id?.name : "") ||
          txn.type,
        reference: txn.reference || txn.invoice_number || undefined,
        debit,
        credit,
        running_balance: runningBalance,
        transaction_id: txn._id,
        invoice_id: txn.invoice || undefined,
        account: txn.account,
        category_id: txn.category_id,
      };
    });

    // Newest first for the UI
    const entries = entriesAsc.slice().reverse();
    const totalDebit = totalsAgg[0]?.total_debit ?? 0;
    const totalCredit = totalsAgg[0]?.total_credit ?? 0;
    const closingBalance = isCustomer
      ? openingBalance + totalCredit - totalDebit
      : openingBalance + totalDebit - totalCredit;

    const balanceLabel = isCustomer
      ? closingBalance >= 0
        ? "receivable"
        : "advance_paid_to_customer"
      : closingBalance >= 0
        ? "payable"
        : "advance_paid_to_supplier";

    res.json({
      party,
      net_balance: closingBalance,
      balance_direction: balanceLabel,
      // New shape expected by mobile
      entries,
      summary: {
        opening_balance: openingBalance,
        total_debit: totalDebit,
        total_credit: totalCredit,
        closing_balance: closingBalance,
      },
      // Backward-compatible alias
      ledger: entries,
      pagination: {
        page: pageNum,
        limit: pageLimit,
        total,
        pages: Math.max(1, Math.ceil(total / pageLimit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /parties/:partyId/net-balance
 *
 * Returns a full breakdown of all transactions with this party:
 *  - Total credit (sales / money in from party)
 *  - Total debit (purchases / money out to party)
 *  - Net balance (who owes whom and how much)
 *
 * Works for all party types — especially useful for type="both" (Lutfor scenario)
 * where the same person is both a buyer and a seller.
 */
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

    // Build query
    const matchFilter = {};

    if (organization) {
      const access = await checkOrgAccess(userId, organization);
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
      matchFilter.organization = new mongoose.Types.ObjectId(organization);
    } else {
      matchFilter.admin = new mongoose.Types.ObjectId(userId);
      matchFilter.organization = { $exists: false };
    }

    matchFilter.archived = { $ne: true };

    if (type && PARTY_TYPE_OPTIONS.includes(type)) {
      matchFilter.type = type;
    }

    const results = await Party.aggregate([
      { $match: matchFilter },
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
