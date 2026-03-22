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
      query.type = type;
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
    let runningBalance = party.opening_balance;
    const ledgerEntries = transactions.reverse().map((txn) => {
      // For customers: credit increases balance (they owe more), debit decreases (they paid)
      // For suppliers: debit increases balance (we owe more), credit decreases (we paid)
      if (party.type === "customer") {
        runningBalance += txn.type === "credit" ? txn.amount : -txn.amount;
      } else {
        runningBalance += txn.type === "debit" ? txn.amount : -txn.amount;
      }
      return {
        ...txn,
        running_balance: runningBalance,
      };
    });

    res.json({
      party,
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
