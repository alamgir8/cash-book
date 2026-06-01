import { Party, PARTY_TYPE_OPTIONS } from "../models/Party.js";
import { OrganizationMember } from "../models/OrganizationMember.js";
import { Transaction } from "../models/Transaction.js";
import mongoose from "mongoose";

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
    const permission =
      type === "customer" ? "manage_customers" : "manage_suppliers";
    const access = await checkOrgAccess(userId, organization, permission);
    if (!access.hasAccess) {
      return res.status(403).json({ message: access.error });
    }

    const party = await Party.create({
      organization,
      admin: userId,
      type: type || "customer",
      name: name.trim(),
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

    // Build query for transactions
    const query = {
      party: partyId,
      is_deleted: false,
    };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate("account", "name kind")
        .populate("category_id", "name type")
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Transaction.countDocuments(query),
    ]);

    // Calculate running balance
    // customer: credit = +amount (receivable grows), debit = -amount (receivable shrinks)
    // supplier/both: debit = +amount (payable grows), credit = -amount (payable shrinks)
    // For "both" type: unified net balance (positive = payable to them, negative = receivable from them)
    const isCustomer = party.type === "customer";
    let runningBalance = party.opening_balance;
    const ledgerEntries = transactions.reverse().map((txn) => {
      if (isCustomer) {
        runningBalance += txn.type === "credit" ? txn.amount : -txn.amount;
      } else {
        runningBalance += txn.type === "debit" ? txn.amount : -txn.amount;
      }
      return {
        ...txn,
        running_balance: runningBalance,
      };
    });

    // Net balance interpretation for the response
    let balanceLabel;
    if (isCustomer) {
      balanceLabel =
        runningBalance >= 0 ? "receivable" : "advance_paid_to_customer";
    } else {
      balanceLabel =
        runningBalance >= 0 ? "payable" : "advance_paid_to_supplier";
    }

    res.json({
      party,
      net_balance: runningBalance,
      balance_direction: balanceLabel,
      ledger: ledgerEntries.reverse(),
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
