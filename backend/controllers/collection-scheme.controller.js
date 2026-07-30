import mongoose from "mongoose";
import dayjs from "dayjs";
import { CollectionScheme } from "../models/CollectionScheme.js";
import { SchemeMember } from "../models/SchemeMember.js";
import { Party } from "../models/Party.js";
import { Account } from "../models/Account.js";
import { Category } from "../models/Category.js";
import { Transaction } from "../models/Transaction.js";
import {
  buildOrgFilter,
  checkOrgAccess,
  getOrgFromRequest,
} from "../utils/organization.js";

const memberStatus = (expected, paid) => {
  if (paid <= 0) return "due";
  if (paid + 0.001 >= expected) return "paid";
  return "partial";
};

const resolveSchemeOrgId = (req, scheme) =>
  scheme?.organization?.toString?.() ||
  scheme?.organization ||
  getOrgFromRequest(req);

const loadSchemeForUser = async (req, schemeId) => {
  const scheme = await CollectionScheme.findById(schemeId);
  if (!scheme || scheme.archived) {
    return { error: { status: 404, message: "Scheme not found" } };
  }

  const orgId = resolveSchemeOrgId(req, scheme);
  const access = await checkOrgAccess(
    req.user.id,
    orgId || undefined,
    "manage_customers",
  );
  if (!access.hasAccess) {
    return { error: { status: 403, message: access.error || "Access denied" } };
  }

  if (scheme.organization) {
    if (!orgId || scheme.organization.toString() !== String(orgId)) {
      // Allow if user has membership on the scheme's org
      const schemeAccess = await checkOrgAccess(
        req.user.id,
        scheme.organization.toString(),
        "manage_customers",
      );
      if (!schemeAccess.hasAccess) {
        return { error: { status: 403, message: "Access denied" } };
      }
    }
  } else if (scheme.admin.toString() !== req.user.id) {
    return { error: { status: 403, message: "Access denied" } };
  }

  return { scheme };
};

const paidByPartyForScheme = async (schemeId, partyIds) => {
  if (!partyIds.length) return new Map();

  const rows = await Transaction.aggregate([
    {
      $match: {
        scheme: new mongoose.Types.ObjectId(schemeId),
        party: { $in: partyIds.map((id) => new mongoose.Types.ObjectId(id)) },
        type: "credit",
        is_deleted: { $ne: true },
        payment_status: { $ne: "due" },
      },
    },
    {
      $group: {
        _id: "$party",
        paid: { $sum: "$amount" },
        payment_count: { $sum: 1 },
        last_payment_at: { $max: "$date" },
      },
    },
  ]);

  const map = new Map();
  for (const row of rows) {
    map.set(row._id.toString(), {
      paid: row.paid || 0,
      payment_count: row.payment_count || 0,
      last_payment_at: row.last_payment_at || null,
    });
  }
  return map;
};

const buildRosterRows = async (scheme, members) => {
  const rate = Number(scheme.rate_per_member) || 0;
  const partyIds = members.map((m) => m.party._id || m.party);
  const paidMap = await paidByPartyForScheme(scheme._id, partyIds);

  return members.map((m) => {
    const partyId = (m.party._id || m.party).toString();
    const paidInfo = paidMap.get(partyId) || {
      paid: 0,
      payment_count: 0,
      last_payment_at: null,
    };
    const expected = Number(m.member_count) * rate;
    const paid = paidInfo.paid;
    const due = Math.max(0, expected - paid);
    return {
      _id: m._id,
      party: m.party,
      member_count: m.member_count,
      sort_order: m.sort_order ?? null,
      notes: m.notes,
      expected,
      paid,
      due,
      status: memberStatus(expected, paid),
      payment_count: paidInfo.payment_count,
      last_payment_at: paidInfo.last_payment_at,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  });
};

const sortRosterRows = (rows) =>
  [...rows].sort((a, b) => {
    const ao = Number(a.sort_order);
    const bo = Number(b.sort_order);
    const aHas = Number.isFinite(ao) && ao > 0;
    const bHas = Number.isFinite(bo) && bo > 0;
    if (aHas && bHas && ao !== bo) return ao - bo;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return String(a.party?.name || "").localeCompare(
      String(b.party?.name || ""),
      "bn",
    );
  });

const normalizeSortOrder = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.min(10000, Math.round(n));
};

const summarizeRoster = (rows) => {
  const summary = {
    family_count: rows.length,
    paid_count: 0,
    partial_count: 0,
    due_count: 0,
    total_expected: 0,
    total_paid: 0,
    total_due: 0,
    total_members: 0,
  };
  for (const row of rows) {
    summary.total_expected += row.expected;
    summary.total_paid += row.paid;
    summary.total_due += row.due;
    summary.total_members += row.member_count || 0;
    if (row.status === "paid") summary.paid_count += 1;
    else if (row.status === "partial") summary.partial_count += 1;
    else summary.due_count += 1;
  }
  return summary;
};

const adjustAccountBalanceAtomic = async ({ accountId, amount, type }) => {
  const delta = type === "credit" ? amount : -amount;
  const updated = await Account.findByIdAndUpdate(
    accountId,
    { $inc: { current_balance: delta } },
    { new: true },
  );
  if (!updated) {
    throw Object.assign(new Error("Account not found for balance update"), {
      statusCode: 404,
    });
  }
  return updated.current_balance;
};

const adjustPartyBalanceAtomic = async ({ partyId, amount, type }) => {
  if (!partyId) return null;
  const partyDoc = await Party.findById(partyId).select("type").lean();
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
    { new: true },
  );
  return updated?.current_balance ?? null;
};

export const listSchemes = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const organization = getOrgFromRequest(req);
    const includeArchived = req.query.archived === "true";

    if (organization) {
      const access = await checkOrgAccess(userId, organization, "manage_customers");
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    }

    const filter = buildOrgFilter(userId, organization || undefined, {
      ...(includeArchived ? {} : { archived: { $ne: true } }),
    });

    const schemes = await CollectionScheme.find(filter)
      .sort({ createdAt: -1 })
      .populate("default_account", "name kind")
      .populate("default_category_id", "name type")
      .lean();

    const schemeIds = schemes.map((s) => s._id);
    const memberCounts = await SchemeMember.aggregate([
      {
        $match: {
          scheme: { $in: schemeIds },
          archived: { $ne: true },
        },
      },
      { $group: { _id: "$scheme", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(
      memberCounts.map((r) => [r._id.toString(), r.count]),
    );

    res.json({
      schemes: schemes.map((s) => ({
        ...s,
        member_count: countMap.get(s._id.toString()) || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const createScheme = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      organization,
      name,
      rate_per_member,
      description,
      default_account,
      default_category_id,
    } = req.body;

    if (!name || String(name).trim().length < 2) {
      return res
        .status(400)
        .json({ message: "Name is required (min 2 characters)" });
    }
    const rate = Number(rate_per_member);
    if (!Number.isFinite(rate) || rate < 0) {
      return res.status(400).json({ message: "rate_per_member must be >= 0" });
    }

    const access = await checkOrgAccess(
      userId,
      organization,
      "manage_customers",
    );
    if (!access.hasAccess) {
      return res.status(403).json({ message: access.error });
    }

    const scheme = await CollectionScheme.create({
      admin: userId,
      organization: organization || undefined,
      name: String(name).trim(),
      rate_per_member: rate,
      description: description?.trim() || undefined,
      default_account: default_account || undefined,
      default_category_id: default_category_id || undefined,
      created_by: userId,
    });

    res.status(201).json({ scheme });
  } catch (error) {
    next(error);
  }
};

export const getScheme = async (req, res, next) => {
  try {
    const result = await loadSchemeForUser(req, req.params.schemeId);
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    const members = await SchemeMember.find({
      scheme: result.scheme._id,
      archived: { $ne: true },
    })
      .populate("party", "name code type phone")
      .lean();

    const rows = await buildRosterRows(result.scheme, members);
    const summary = summarizeRoster(rows);

    const populated = await CollectionScheme.findById(result.scheme._id)
      .populate("default_account", "name kind")
      .populate("default_category_id", "name type")
      .lean();

    res.json({
      scheme: { ...populated, ...summary, member_count: summary.family_count },
      summary,
    });
  } catch (error) {
    next(error);
  }
};

export const updateScheme = async (req, res, next) => {
  try {
    const result = await loadSchemeForUser(req, req.params.schemeId);
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    const { scheme } = result;
    const {
      name,
      rate_per_member,
      description,
      default_account,
      default_category_id,
    } = req.body;

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (trimmed.length < 2) {
        return res
          .status(400)
          .json({ message: "Name is required (min 2 characters)" });
      }
      scheme.name = trimmed;
    }
    if (rate_per_member !== undefined) {
      const rate = Number(rate_per_member);
      if (!Number.isFinite(rate) || rate < 0) {
        return res.status(400).json({ message: "rate_per_member must be >= 0" });
      }
      scheme.rate_per_member = rate;
    }
    if (description !== undefined) {
      scheme.description = String(description).trim() || undefined;
    }
    if (default_account !== undefined) {
      scheme.default_account = default_account || undefined;
    }
    if (default_category_id !== undefined) {
      scheme.default_category_id = default_category_id || undefined;
    }

    await scheme.save();
    res.json({ scheme });
  } catch (error) {
    next(error);
  }
};

export const archiveScheme = async (req, res, next) => {
  try {
    const result = await loadSchemeForUser(req, req.params.schemeId);
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    result.scheme.archived = true;
    result.scheme.archived_at = new Date();
    await result.scheme.save();
    res.json({ scheme: result.scheme, message: "Scheme archived" });
  } catch (error) {
    next(error);
  }
};

export const deleteScheme = async (req, res, next) => {
  try {
    const result = await loadSchemeForUser(req, req.params.schemeId);
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    // Block delete if any active members are enrolled
    const activeMemberCount = await SchemeMember.countDocuments({
      scheme: result.scheme._id,
      archived: { $ne: true },
    });
    if (activeMemberCount > 0) {
      return res.status(400).json({
        message: `Cannot delete scheme with ${activeMemberCount} enrolled families. Remove all families first.`,
      });
    }

    // Clean up archived members + the scheme itself
    await SchemeMember.deleteMany({ scheme: result.scheme._id });
    await CollectionScheme.findByIdAndDelete(result.scheme._id);
    res.json({ message: "Scheme deleted" });
  } catch (error) {
    next(error);
  }
};

export const duplicateScheme = async (req, res, next) => {
  try {
    const result = await loadSchemeForUser(req, req.params.schemeId);
    if (result.error) {
      return res
        .status(result.error.status)
        .json({ message: result.error.message });
    }

    const incomingName = req.body?.name;
    const newName =
      incomingName && String(incomingName).trim().length > 0
        ? String(incomingName).trim()
        : `Copy of ${result.scheme.name}`;

    if (newName.length < 2) {
      return res.status(400).json({ message: "Name is required (min 2 characters)" });
    }

    // IMPORTANT: We intentionally do NOT copy any Transactions/payments.
    // Roster paid/due is computed from Transactions, so the duplicate starts fresh.
    const duplicated = await CollectionScheme.create({
      admin: req.user.id,
      organization: result.scheme.organization || undefined,
      name: newName,
      rate_per_member: result.scheme.rate_per_member,
      description: result.scheme.description,
      default_account: result.scheme.default_account || undefined,
      default_category_id: result.scheme.default_category_id || undefined,
    });

    const members = await SchemeMember.find({
      scheme: result.scheme._id,
      archived: { $ne: true },
    })
      .lean();

    if (members.length > 0) {
      await SchemeMember.insertMany(
        members.map((m) => ({
          scheme: duplicated._id,
          party: m.party,
          member_count: m.member_count,
          notes: m.notes,
          admin: req.user.id,
          organization: duplicated.organization || m.organization || undefined,
        })),
      );
    }

    res.json({ scheme: duplicated, member_count: members.length });
  } catch (error) {
    next(error);
  }
};

export const getRoster = async (req, res, next) => {
  try {
    const result = await loadSchemeForUser(req, req.params.schemeId);
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    const statusFilter = (req.query.status || "all").toString().toLowerCase();
    const search = (req.query.search || "").toString().trim().toLowerCase();

    const members = await SchemeMember.find({
      scheme: result.scheme._id,
      archived: { $ne: true },
    })
      .populate("party", "name code type phone")
      .sort({ sort_order: 1, createdAt: 1 })
      .lean();

    let rows = sortRosterRows(await buildRosterRows(result.scheme, members));
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (search) {
      rows = rows.filter((r) =>
        String(r.party?.name || "")
          .toLowerCase()
          .includes(search),
      );
    }

    res.json({
      scheme: {
        _id: result.scheme._id,
        name: result.scheme.name,
        rate_per_member: result.scheme.rate_per_member,
      },
      summary: summarizeRoster(
        await buildRosterRows(result.scheme, members),
      ),
      members: rows,
    });
  } catch (error) {
    next(error);
  }
};

export const addMember = async (req, res, next) => {
  try {
    const result = await loadSchemeForUser(req, req.params.schemeId);
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    const { party: partyId, member_count, notes, sort_order } = req.body;
    if (!partyId) {
      return res.status(400).json({ message: "party is required" });
    }
    const count = Number(member_count ?? 1);
    if (!Number.isFinite(count) || count < 1) {
      return res.status(400).json({ message: "member_count must be >= 1" });
    }
    const sortOrder = normalizeSortOrder(sort_order);

    const party = await Party.findById(partyId);
    if (!party || party.archived) {
      return res.status(404).json({ message: "Party not found" });
    }

    const existing = await SchemeMember.findOne({
      scheme: result.scheme._id,
      party: partyId,
      archived: { $ne: true },
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: "This family is already enrolled in the scheme" });
    }

    // Reactivate archived enrollment if present
    const archived = await SchemeMember.findOne({
      scheme: result.scheme._id,
      party: partyId,
      archived: true,
    });
    let member;
    if (archived) {
      archived.archived = false;
      archived.archived_at = undefined;
      archived.member_count = count;
      archived.notes = notes?.trim() || undefined;
      if (sortOrder !== undefined) archived.sort_order = sortOrder;
      member = await archived.save();
    } else {
      member = await SchemeMember.create({
        scheme: result.scheme._id,
        party: partyId,
        member_count: count,
        sort_order: sortOrder,
        notes: notes?.trim() || undefined,
        admin: req.user.id,
        organization: result.scheme.organization || undefined,
      });
    }

    const populated = await SchemeMember.findById(member._id)
      .populate("party", "name code type phone")
      .lean();

    const [row] = await buildRosterRows(result.scheme, [populated]);
    res.status(201).json({ member: row });
  } catch (error) {
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ message: "This family is already enrolled in the scheme" });
    }
    next(error);
  }
};

export const updateMember = async (req, res, next) => {
  try {
    const result = await loadSchemeForUser(req, req.params.schemeId);
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    const member = await SchemeMember.findOne({
      _id: req.params.memberId,
      scheme: result.scheme._id,
      archived: { $ne: true },
    });
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    const { member_count, notes, sort_order } = req.body;
    if (member_count !== undefined) {
      const count = Number(member_count);
      if (!Number.isFinite(count) || count < 1) {
        return res.status(400).json({ message: "member_count must be >= 1" });
      }
      member.member_count = count;
    }
    if (notes !== undefined) {
      member.notes = String(notes).trim() || undefined;
    }
    if (sort_order !== undefined) {
      const sortOrder = normalizeSortOrder(sort_order);
      if (sort_order === null || sort_order === "") {
        member.sort_order = undefined;
      } else if (sortOrder === undefined) {
        return res.status(400).json({ message: "sort_order must be >= 1" });
      } else {
        member.sort_order = sortOrder;
      }
    }
    await member.save();

    const populated = await SchemeMember.findById(member._id)
      .populate("party", "name code type phone")
      .lean();
    const [row] = await buildRosterRows(result.scheme, [populated]);
    res.json({ member: row });
  } catch (error) {
    next(error);
  }
};

export const removeMember = async (req, res, next) => {
  try {
    const result = await loadSchemeForUser(req, req.params.schemeId);
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    const member = await SchemeMember.findOne({
      _id: req.params.memberId,
      scheme: result.scheme._id,
      archived: { $ne: true },
    });
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    // Owner / personal-mode only (super admin)
    const orgId = resolveSchemeOrgId(req, result.scheme);
    if (orgId) {
      const access = await checkOrgAccess(req.user.id, orgId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error || "Access denied" });
      }
      if (!access.isPersonal && access.membership?.role !== "owner") {
        return res
          .status(403)
          .json({ message: "Only the organization owner can remove families" });
      }
    } else if (result.scheme.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const transactionCount = await Transaction.countDocuments({
      scheme: result.scheme._id,
      party: member.party,
      is_deleted: { $ne: true },
    });
    if (transactionCount > 0) {
      return res.status(400).json({
        message:
          "Cannot remove family with linked payments/transactions. Remove those transactions first.",
        transactionCount,
      });
    }

    member.archived = true;
    member.archived_at = new Date();
    await member.save();
    res.json({ message: "Member removed from scheme" });
  } catch (error) {
    next(error);
  }
};

export const recordPayment = async (req, res, next) => {
  try {
    const result = await loadSchemeForUser(req, req.params.schemeId);
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    const { scheme } = result;

    const {
      party: partyId,
      amount,
      account: accountAlias,
      account_id,
      accountId,
      date,
      description,
      category_id,
      categoryId,
      organization,
    } = req.body;

    if (!partyId) {
      return res.status(400).json({ message: "party is required" });
    }
    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ message: "amount must be greater than zero" });
    }

    const member = await SchemeMember.findOne({
      scheme: scheme._id,
      party: partyId,
      archived: { $ne: true },
    });
    if (!member) {
      return res
        .status(400)
        .json({ message: "Party is not enrolled in this scheme" });
    }

    const accountIdentifier =
      accountAlias || account_id || accountId || scheme.default_account;
    if (!accountIdentifier) {
      return res.status(400).json({ message: "Account is required" });
    }

    const orgId =
      organization || scheme.organization?.toString() || undefined;
    if (orgId) {
      const access = await checkOrgAccess(
        req.user.id,
        orgId,
        "create_transactions",
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    }

    let account;
    if (orgId) {
      account = await Account.findOne({ _id: accountIdentifier, organization: orgId });
    } else {
      account = await Account.findOne({
        _id: accountIdentifier,
        admin: req.user.id,
      });
    }
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const categoryIdentifier =
      category_id || categoryId || scheme.default_category_id;
    let categoryDocument = null;
    if (categoryIdentifier) {
      categoryDocument = orgId
        ? await Category.findOne({ _id: categoryIdentifier, organization: orgId })
        : await Category.findOne({
            _id: categoryIdentifier,
            admin: req.user.id,
          });
    }

    let txnDate = new Date();
    if (date) {
      const parsed = dayjs(date);
      if (!parsed.isValid()) {
        return res.status(400).json({ message: "Invalid transaction date" });
      }
      txnDate = parsed.toDate();
    }

    const type = "credit";
    const transaction = await Transaction.create({
      admin: req.user.id,
      organization: orgId || account.organization || undefined,
      account: account._id,
      category_id: categoryDocument?._id,
      party: partyId,
      scheme: scheme._id,
      type,
      amount: paymentAmount,
      date: txnDate,
      description:
        description?.trim() ||
        `Payment for ${scheme.name}`,
      payment_status: "paid",
      created_by: req.user.id,
    });

    const balanceAfter = await adjustAccountBalanceAtomic({
      accountId: account._id,
      amount: paymentAmount,
      type,
    });
    transaction.balance_after_transaction = balanceAfter;

    const newPartyBalance = await adjustPartyBalanceAtomic({
      partyId,
      amount: paymentAmount,
      type,
    });
    if (newPartyBalance !== null) {
      transaction.party_balance_after = newPartyBalance;
    }
    await transaction.save();

    const populated = await Transaction.findById(transaction._id)
      .populate("account", "name kind")
      .populate("category_id", "name type")
      .populate("party", "name code type")
      .populate("scheme", "name rate_per_member")
      .lean();

    res.status(201).json({ transaction: populated });
  } catch (error) {
    next(error);
  }
};

export const listMemberPayments = async (req, res, next) => {
  try {
    const result = await loadSchemeForUser(req, req.params.schemeId);
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    const member = await SchemeMember.findOne({
      _id: req.params.memberId,
      scheme: result.scheme._id,
      archived: { $ne: true },
    }).populate("party", "name code type");
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    const payments = await Transaction.find({
      scheme: result.scheme._id,
      party: member.party._id || member.party,
      type: "credit",
      is_deleted: { $ne: true },
      payment_status: { $ne: "due" },
    })
      .sort({ date: -1, createdAt: -1 })
      .populate("account", "name kind")
      .populate("category_id", "name type")
      .lean();

    const [row] = await buildRosterRows(result.scheme, [
      {
        ...member.toObject(),
        party: member.party,
      },
    ]);

    res.json({ member: row, payments });
  } catch (error) {
    next(error);
  }
};
