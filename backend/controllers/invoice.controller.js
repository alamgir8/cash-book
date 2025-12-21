import mongoose from "mongoose";
import {
  Invoice,
  INVOICE_TYPE_OPTIONS,
  INVOICE_STATUS_OPTIONS,
} from "../models/Invoice.js";
import { Party } from "../models/Party.js";
import { Transaction } from "../models/Transaction.js";
import { Account } from "../models/Account.js";
import { OrganizationMember } from "../models/OrganizationMember.js";

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
 * Create a new invoice
 */
export const createInvoice = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      organization,
      type,
      party,
      party_name,
      party_phone,
      party_address,
      date,
      due_date,
      items,
      shipping_charge,
      adjustment,
      adjustment_description,
      notes,
      terms,
      internal_notes,
    } = req.body;

    if (!type || !INVOICE_TYPE_OPTIONS.includes(type)) {
      return res
        .status(400)
        .json({ message: "Valid invoice type is required (sale/purchase)" });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    // Check organization access
    const access = await checkOrgAccess(
      userId,
      organization,
      "create_invoices"
    );
    if (!access.hasAccess) {
      return res.status(403).json({ message: access.error });
    }

    // Generate invoice number
    let invoice_number;
    if (organization) {
      invoice_number = await Invoice.generateInvoiceNumber(organization, type);
    } else {
      // For personal invoices, generate simple number
      const count = await Invoice.countDocuments({ admin: userId, type });
      const prefix = type === "sale" ? "INV" : "PO";
      invoice_number = `${prefix}-${String(count + 1).padStart(6, "0")}`;
    }

    // Create invoice
    const invoice = await Invoice.create({
      organization,
      admin: userId,
      invoice_number,
      type,
      status: "pending",
      party,
      party_name,
      party_phone,
      party_address,
      date: date || new Date(),
      due_date,
      items,
      shipping_charge,
      adjustment,
      adjustment_description,
      notes,
      terms,
      internal_notes,
      created_by: userId,
    });

    // Update party stats
    if (party) {
      await Party.findByIdAndUpdate(party, {
        $inc: { total_invoices: 1 },
      });
    }

    // Populate for response
    await invoice.populate([
      { path: "party", select: "name phone code type" },
      { path: "created_by", select: "name email" },
    ]);

    res.status(201).json({
      message: "Invoice created successfully",
      invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get invoices list
 */
export const getInvoices = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      organization,
      type,
      status,
      party,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 50,
      sort = "-date",
    } = req.query;

    // Build query
    const query = {};

    if (organization) {
      const access = await checkOrgAccess(
        userId,
        organization,
        "view_invoices"
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
      query.organization = organization;
    } else {
      query.admin = userId;
      query.organization = { $exists: false };
    }

    if (type && INVOICE_TYPE_OPTIONS.includes(type)) {
      query.type = type;
    }

    if (status && INVOICE_STATUS_OPTIONS.includes(status)) {
      query.status = status;
    }

    if (party) {
      query.party = party;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { invoice_number: { $regex: search, $options: "i" } },
        { party_name: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    const sortField = sort.startsWith("-") ? sort.substring(1) : sort;
    sortObj[sortField] = sort.startsWith("-") ? -1 : 1;

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate("party", "name phone code type")
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit)),
      Invoice.countDocuments(query),
    ]);

    res.json({
      invoices,
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
 * Get single invoice
 */
export const getInvoice = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { invoiceId } = req.params;

    const invoice = await Invoice.findById(invoiceId)
      .populate("party", "name phone email address code type current_balance")
      .populate("payments.account", "name kind")
      .populate("payments.recorded_by", "name")
      .populate("created_by", "name email")
      .populate("updated_by", "name email")
      .populate("organization", "name settings");

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Check access
    if (invoice.organization) {
      const access = await checkOrgAccess(
        userId,
        invoice.organization._id,
        "view_invoices"
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    } else if (invoice.admin.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({ invoice });
  } catch (error) {
    next(error);
  }
};

/**
 * Update invoice
 */
export const updateInvoice = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { invoiceId } = req.params;
    const updates = req.body;

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Check access
    if (invoice.organization) {
      const access = await checkOrgAccess(
        userId,
        invoice.organization,
        "edit_invoices"
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    } else if (invoice.admin.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Cannot edit cancelled or paid invoices
    if (invoice.status === "cancelled") {
      return res.status(400).json({ message: "Cannot edit cancelled invoice" });
    }

    if (invoice.status === "paid" && updates.items) {
      return res
        .status(400)
        .json({ message: "Cannot edit items of paid invoice" });
    }

    // Allowed updates
    const allowedFields = [
      "party",
      "party_name",
      "party_phone",
      "party_address",
      "date",
      "due_date",
      "items",
      "shipping_charge",
      "adjustment",
      "adjustment_description",
      "notes",
      "terms",
      "internal_notes",
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        invoice[field] = updates[field];
      }
    }

    invoice.updated_by = userId;
    await invoice.save();

    await invoice.populate([
      { path: "party", select: "name phone code type" },
      { path: "created_by", select: "name email" },
    ]);

    res.json({
      message: "Invoice updated successfully",
      invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record payment for invoice
 */
export const recordPayment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { invoiceId } = req.params;
    const { amount, method, account, reference, notes, date } = req.body;

    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json({ message: "Valid payment amount is required" });
    }

    const invoice = await Invoice.findById(invoiceId).session(session);

    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Check access
    if (invoice.organization) {
      const access = await checkOrgAccess(
        userId,
        invoice.organization,
        "create_transactions"
      );
      if (!access.hasAccess) {
        await session.abortTransaction();
        return res.status(403).json({ message: access.error });
      }
    } else if (invoice.admin.toString() !== userId) {
      await session.abortTransaction();
      return res.status(403).json({ message: "Access denied" });
    }

    if (invoice.status === "cancelled") {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Cannot add payment to cancelled invoice" });
    }

    if (invoice.status === "paid") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invoice is already fully paid" });
    }

    // Validate account
    let paymentAccount;
    if (account) {
      paymentAccount = await Account.findById(account).session(session);
      if (!paymentAccount) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Payment account not found" });
      }
    }

    // Create transaction for the payment
    let transaction;
    if (paymentAccount) {
      // For sale invoice: credit (money coming in)
      // For purchase invoice: debit (money going out)
      const txnType = invoice.type === "sale" ? "credit" : "debit";

      transaction = await Transaction.create(
        [
          {
            organization: invoice.organization,
            admin: userId,
            account: paymentAccount._id,
            type: txnType,
            amount,
            date: date || new Date(),
            description: `Payment for ${invoice.invoice_number}`,
            counterparty: invoice.party_name,
            party: invoice.party,
            invoice: invoice._id,
            created_by: userId,
          },
        ],
        { session }
      );

      // Update account balance
      const balanceChange = txnType === "credit" ? amount : -amount;
      paymentAccount.current_balance += balanceChange;
      await paymentAccount.save({ session });

      // Update transaction with balance
      transaction[0].balance_after_transaction = paymentAccount.current_balance;
      await transaction[0].save({ session });
    }

    // Add payment to invoice
    invoice.payments.push({
      date: date || new Date(),
      amount,
      method: method || "cash",
      account: paymentAccount?._id,
      transaction: transaction?.[0]?._id,
      reference,
      notes,
      recorded_by: userId,
    });

    // Update party balance
    if (invoice.party) {
      const party = await Party.findById(invoice.party).session(session);
      if (party) {
        // For sale: customer pays, reduce their balance (receivable)
        // For purchase: we pay, reduce our payable
        const balanceChange = invoice.type === "sale" ? -amount : -amount;
        party.current_balance += balanceChange;
        party.total_transactions++;
        party.last_transaction_at = new Date();
        await party.save({ session });
      }
    }

    invoice.linked_transactions.push(transaction?.[0]?._id);
    await invoice.save({ session });

    await session.commitTransaction();

    await invoice.populate([
      { path: "party", select: "name phone code type current_balance" },
      { path: "payments.account", select: "name kind" },
    ]);

    res.json({
      message: "Payment recorded successfully",
      invoice,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Cancel invoice
 */
export const cancelInvoice = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { invoiceId } = req.params;
    const { reason } = req.body;

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Check access
    if (invoice.organization) {
      const access = await checkOrgAccess(
        userId,
        invoice.organization,
        "delete_invoices"
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    } else if (invoice.admin.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (invoice.status === "cancelled") {
      return res.status(400).json({ message: "Invoice is already cancelled" });
    }

    if (invoice.payments.length > 0) {
      return res.status(400).json({
        message: "Cannot cancel invoice with payments. Refund payments first.",
      });
    }

    invoice.cancel(userId, reason);
    await invoice.save();

    res.json({
      message: "Invoice cancelled successfully",
      invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get invoice summary/stats
 */
export const getInvoiceSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { organization, type, startDate, endDate } = req.query;

    // Build query
    const query = { status: { $ne: "cancelled" } };

    if (organization) {
      const access = await checkOrgAccess(userId, organization, "view_reports");
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
      query.organization = new mongoose.Types.ObjectId(organization);
    } else {
      query.admin = new mongoose.Types.ObjectId(userId);
      query.organization = { $exists: false };
    }

    if (type && INVOICE_TYPE_OPTIONS.includes(type)) {
      query.type = type;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const summary = await Invoice.aggregate([
      { $match: query },
      {
        $group: {
          _id: { type: "$type", status: "$status" },
          count: { $sum: 1 },
          total: { $sum: "$grand_total" },
          paid: { $sum: "$amount_paid" },
          due: { $sum: "$balance_due" },
        },
      },
    ]);

    // Restructure for easier consumption
    const result = {
      sales: {
        total: 0,
        paid: 0,
        due: 0,
        count: 0,
        by_status: {},
      },
      purchases: {
        total: 0,
        paid: 0,
        due: 0,
        count: 0,
        by_status: {},
      },
    };

    for (const item of summary) {
      const key = item._id.type === "sale" ? "sales" : "purchases";
      result[key].total += item.total;
      result[key].paid += item.paid;
      result[key].due += item.due;
      result[key].count += item.count;
      result[key].by_status[item._id.status] = {
        count: item.count,
        total: item.total,
        paid: item.paid,
        due: item.due,
      };
    }

    res.json({ summary: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Get options
 */
export const getOptions = async (req, res) => {
  res.json({
    invoice_types: INVOICE_TYPE_OPTIONS,
    invoice_statuses: INVOICE_STATUS_OPTIONS,
  });
};
