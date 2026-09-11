import mongoose from "mongoose";
import { Account } from "../models/Account.js";
import { Category } from "../models/Category.js";
import { Party } from "../models/Party.js";
import { Transaction } from "../models/Transaction.js";
import { Transfer } from "../models/Transfer.js";
import { Product } from "../models/Product.js";
import { Invoice } from "../models/Invoice.js";
import { StockMovement } from "../models/StockMovement.js";

const MIN_SCHEMA_VERSION = 1;
const MAX_PUSH_CHANGES = 500;

const personalScope = (adminId) => ({
  admin: adminId,
  $or: [{ organization: { $exists: false } }, { organization: null }],
});

/** All books owned by this admin (personal + organizations). */
const adminScope = (adminId) => ({ admin: adminId });

const orgIdFromPayload = (payload) => {
  const raw =
    payload?.organization_id ?? payload?.organization ?? payload?.organizationId;
  if (!raw) return null;
  if (isValidObjectId(String(raw))) return toObjectId(String(raw));
  return null;
};
const isValidObjectId = (value) => {
  if (!value || typeof value !== "string") return false;
  return (
    mongoose.Types.ObjectId.isValid(value) &&
    String(new mongoose.Types.ObjectId(value)) === value
  );
};

const toObjectId = (value) => new mongoose.Types.ObjectId(value);

const toIso = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const boolFromPayload = (value) => Boolean(Number(value) || value === true);

/** Cash impact: credit +, debit −. Skip dues (not yet cash). */
const accountCashDelta = (type, amount, paymentStatus) => {
  if (paymentStatus === "due") return 0;
  const n = Number(amount) || 0;
  return type === "credit" ? n : -n;
};

/** Party ledger convention — matches REST transaction controller. */
const partyBalanceDelta = (partyType, type, amount, paymentStatus) => {
  if (paymentStatus === "due" || !partyType) return 0;
  const n = Number(amount) || 0;
  const isCustomer = partyType === "customer";
  if (isCustomer) {
    return type === "credit" ? n : -n;
  }
  return type === "debit" ? n : -n;
};

const applyAccountInc = async (accountId, delta) => {
  if (!accountId || !delta) return;
  await Account.findByIdAndUpdate(accountId, {
    $inc: { current_balance: delta },
  });
};

const applyPartyInc = async (partyId, delta) => {
  if (!partyId || !delta) return;
  await Party.findByIdAndUpdate(partyId, {
    $inc: { current_balance: delta },
  });
};

const mergeClientMeta = (existingMeta, clientId) => {
  const meta =
    existingMeta && typeof existingMeta === "object" ? { ...existingMeta } : {};
  if (clientId) meta.client_id = clientId;
  return meta;
};

const findByServerOrClientId = async (Model, adminId, serverId, clientId) => {
  if (serverId && isValidObjectId(serverId)) {
    const doc = await Model.findOne({
      _id: toObjectId(serverId),
      admin: adminId,
    });
    if (doc) return doc;
  }
  if (clientId) {
    return Model.findOne({
      admin: adminId,
      "meta_data.client_id": clientId,
    });
  }
  return null;
};

const resolveRefId = async (Model, adminId, refValue, serverIdHint, idMap) => {
  if (refValue && idMap?.has(String(refValue))) {
    return toObjectId(idMap.get(String(refValue)));
  }
  if (serverIdHint && isValidObjectId(serverIdHint)) {
    const doc = await Model.findOne({
      _id: toObjectId(serverIdHint),
      admin: adminId,
    }).select("_id");
    if (doc) return doc._id;
  }
  if (refValue && isValidObjectId(refValue)) {
    const doc = await Model.findOne({
      _id: toObjectId(refValue),
      admin: adminId,
    }).select("_id");
    if (doc) return doc._id;
  }
  if (refValue) {
    const doc = await Model.findOne({
      admin: adminId,
      "meta_data.client_id": String(refValue),
    }).select("_id");
    if (doc) return doc._id;
  }
  return null;
};

const applyTimestamps = (doc, payload, change) => {
  const updatedAt = change.updated_at || payload.updated_at;
  const createdAt = payload.created_at;
  if (createdAt) doc.createdAt = new Date(createdAt);
  if (updatedAt) doc.updatedAt = new Date(updatedAt);
};

/** Reject push when server copy is newer (last-write-wins). */
const rejectIfStale = (doc, change) => {
  if (!doc) return;
  const existingMs = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
  const incomingMs = Date.parse(change.updated_at || "") || 0;
  if (incomingMs < existingMs) {
    throw Object.assign(new Error("Stale change (LWW)"), { code: "stale_lww" });
  }
  if (incomingMs > existingMs) return;

  const incDel = change.op === "delete" || Boolean(change.deleted_at);
  const exDel = Boolean(
    doc.is_deleted || doc.archived || doc.meta_data?.deleted_at,
  );
  if (incDel && !exDel) return;
  if (!incDel && exDel) {
    throw Object.assign(new Error("Stale change (LWW delete)"), {
      code: "stale_lww",
    });
  }
  const exDev = String(doc.meta_data?.device_id || "");
  const inDev = String(change.device_id || "");
  if (inDev && exDev && inDev < exDev) {
    throw Object.assign(new Error("Stale change (LWW device)"), {
      code: "stale_lww",
    });
  }
};

const clientIdFromDoc = (doc) =>
  doc?.meta_data?.client_id ? String(doc.meta_data.client_id) : null;

const mapAccountPayload = async (adminId, change, idMap) => {
  const payload = change.payload || {};
  const clientId = change.id || payload.id;
  const serverId = change.server_id || payload.server_id;
  let doc = await findByServerOrClientId(
    Account,
    adminId,
    serverId,
    clientId,
  );
  rejectIfStale(doc, change);

  if (change.op === "delete") {
    if (!doc) return { doc: null, created: false };
    doc.archived = true;
    doc.archived_at = change.deleted_at
      ? new Date(change.deleted_at)
      : new Date();
    doc.meta_data = mergeClientMeta(
      { ...doc.meta_data, device_id: change.device_id },
      clientId,
    );
    applyTimestamps(doc, payload, change);
    await doc.save({ timestamps: false });
    return { doc, created: false };
  }

  const isNew = !doc;
  if (isNew) {
    doc = new Account({ admin: adminId });
  }

  const orgRef = orgIdFromPayload(payload);
  if (orgRef) doc.organization = orgRef;
  else if (isNew) doc.organization = undefined;

  if (payload.name !== undefined) doc.name = payload.name;
  if (payload.description !== undefined) doc.description = payload.description;
  if (payload.kind !== undefined) doc.kind = payload.kind;
  if (payload.opening_balance !== undefined) {
    doc.opening_balance = Number(payload.opening_balance);
  }
  // Do NOT trust client current_balance on sync push for existing accounts —
  // balances are applied via transaction $inc. New accounts start at opening.
  if (isNew) {
    doc.current_balance = Number(
      payload.opening_balance !== undefined
        ? payload.opening_balance
        : payload.current_balance ?? 0,
    );
  }
  if (payload.currency_code !== undefined) {
    doc.currency_code = payload.currency_code;
  }
  if (payload.currency_symbol !== undefined) {
    doc.currency_symbol = payload.currency_symbol;
  }
  if (payload.archived !== undefined) {
    doc.archived = boolFromPayload(payload.archived);
  }
  if (payload.archived_at !== undefined) {
    doc.archived_at = payload.archived_at
      ? new Date(payload.archived_at)
      : undefined;
  }
  doc.meta_data = mergeClientMeta(
    { ...doc.meta_data, device_id: change.device_id },
    clientId,
  );
  applyTimestamps(doc, payload, change);
  await doc.save({ timestamps: false });
  if (clientId) idMap.set(String(clientId), doc._id.toString());
  return { doc, created: isNew };
};

const mapCategoryPayload = async (adminId, change, idMap) => {
  const payload = change.payload || {};
  const clientId = change.id || payload.id;
  const serverId = change.server_id || payload.server_id;
  let doc = await findByServerOrClientId(
    Category,
    adminId,
    serverId,
    clientId,
  );
  rejectIfStale(doc, change);

  if (change.op === "delete") {
    if (!doc) return { doc: null, created: false };
    doc.archived = true;
    doc.archived_at = change.deleted_at
      ? new Date(change.deleted_at)
      : new Date();
    doc.meta_data = mergeClientMeta(
      { ...doc.meta_data, device_id: change.device_id },
      clientId,
    );
    applyTimestamps(doc, payload, change);
    await doc.save({ timestamps: false });
    return { doc, created: false };
  }

  const isNew = !doc;
  if (isNew) {
    doc = new Category({ admin: adminId });
  }

  const orgRef = orgIdFromPayload(payload);
  if (orgRef) doc.organization = orgRef;
  else if (isNew) doc.organization = undefined;

  if (payload.type !== undefined) doc.type = payload.type;
  if (payload.flow !== undefined) doc.flow = payload.flow;
  if (payload.name !== undefined) doc.name = payload.name;
  if (payload.description !== undefined) doc.description = payload.description;
  if (payload.color !== undefined) doc.color = payload.color;
  if (payload.archived !== undefined) {
    doc.archived = boolFromPayload(payload.archived);
  }
  if (payload.archived_at !== undefined) {
    doc.archived_at = payload.archived_at
      ? new Date(payload.archived_at)
      : undefined;
  }
  doc.meta_data = mergeClientMeta(
    { ...doc.meta_data, device_id: change.device_id },
    clientId,
  );
  applyTimestamps(doc, payload, change);
  await doc.save({ timestamps: false });
  if (clientId) idMap.set(String(clientId), doc._id.toString());
  return { doc, created: isNew };
};

const mapPartyPayload = async (adminId, change, idMap) => {
  const payload = change.payload || {};
  const clientId = change.id || payload.id;
  const serverId = change.server_id || payload.server_id;
  let doc = await findByServerOrClientId(Party, adminId, serverId, clientId);
  rejectIfStale(doc, change);

  if (change.op === "delete") {
    if (!doc) return { doc: null, created: false };
    doc.archived = true;
    doc.archived_at = change.deleted_at
      ? new Date(change.deleted_at)
      : new Date();
    doc.meta_data = mergeClientMeta(
      { ...doc.meta_data, device_id: change.device_id },
      clientId,
    );
    applyTimestamps(doc, payload, change);
    await doc.save({ timestamps: false });
    return { doc, created: false };
  }

  const isNew = !doc;
  if (isNew) {
    doc = new Party({ admin: adminId, type: "customer" });
  }

  const orgRef = orgIdFromPayload(payload);
  if (orgRef) doc.organization = orgRef;

  if (payload.type !== undefined) doc.type = payload.type;
  if (payload.name !== undefined) doc.name = payload.name;
  if (payload.code !== undefined) doc.code = payload.code;
  if (payload.phone !== undefined) doc.phone = payload.phone;
  if (payload.email !== undefined) doc.email = payload.email;
  if (payload.address_json !== undefined) {
    try {
      doc.address =
        typeof payload.address_json === "string"
          ? JSON.parse(payload.address_json)
          : payload.address_json;
    } catch {
      doc.address = {};
    }
  } else if (payload.address !== undefined) {
    doc.address = payload.address;
  }
  if (payload.opening_balance !== undefined) {
    doc.opening_balance = Number(payload.opening_balance);
  }
  // Party balances are applied via transaction $inc; new parties start at opening.
  if (isNew) {
    doc.current_balance = Number(
      payload.opening_balance !== undefined
        ? payload.opening_balance
        : payload.current_balance ?? 0,
    );
  }
  if (payload.credit_limit !== undefined) {
    doc.credit_limit = Number(payload.credit_limit ?? 0);
  }
  if (payload.notes !== undefined) doc.notes = payload.notes;
  if (payload.archived !== undefined) {
    doc.archived = boolFromPayload(payload.archived);
  }
  if (payload.archived_at !== undefined) {
    doc.archived_at = payload.archived_at
      ? new Date(payload.archived_at)
      : undefined;
  }
  doc.meta_data = mergeClientMeta(doc.meta_data, clientId);
  applyTimestamps(doc, payload, change);
  await doc.save({ timestamps: false });
  if (clientId) idMap.set(String(clientId), doc._id.toString());
  return { doc, created: isNew };
};

const mapTransactionPayload = async (adminId, change, idMap) => {
  const payload = change.payload || {};
  const clientId = change.id || payload.id;
  const serverId = change.server_id || payload.server_id;
  const clientRequestId =
    change.client_request_id || payload.client_request_id || null;

  let doc = null;
  if (clientRequestId) {
    doc = await Transaction.findOne({
      admin: adminId,
      client_request_id: clientRequestId,
      is_deleted: { $ne: true },
    });
  }
  if (!doc) {
    doc = await findByServerOrClientId(
      Transaction,
      adminId,
      serverId,
      clientId,
    );
  }
  rejectIfStale(doc, change);

  if (change.op === "delete") {
    if (!doc) return { doc: null, created: false };
    // Already soft-deleted — idempotent.
    if (doc.is_deleted) {
      return { doc, created: false };
    }
    // Revert cash/party if this was a paid transaction.
    const cashDelta = accountCashDelta(
      doc.type,
      doc.amount,
      doc.payment_status,
    );
    if (cashDelta) {
      await applyAccountInc(doc.account, -cashDelta);
    }
    if (doc.party && cashDelta) {
      const partyDoc = await Party.findById(doc.party).select("type").lean();
      const pDelta = partyBalanceDelta(
        partyDoc?.type,
        doc.type,
        doc.amount,
        doc.payment_status,
      );
      if (pDelta) await applyPartyInc(doc.party, -pDelta);
    }
    // Restore parent due remaining when deleting a due payment.
    if (doc.parent_due_id) {
      await Transaction.findByIdAndUpdate(doc.parent_due_id, {
        $inc: { due_remaining: Number(doc.amount) || 0 },
        $unset: { due_settled_at: 1 },
      });
    }
    doc.is_deleted = true;
    doc.deleted_at = change.deleted_at
      ? new Date(change.deleted_at)
      : new Date();
    doc.meta_data = mergeClientMeta(
      { ...doc.meta_data, device_id: change.device_id },
      clientId,
    );
    applyTimestamps(doc, payload, change);
    await doc.save({ timestamps: false });
    return { doc, created: false };
  }

  const accountId = await resolveRefId(
    Account,
    adminId,
    payload.account_id,
    payload.account_server_id,
    idMap,
  );
  if (!accountId) {
    throw new Error("Account reference not found");
  }

  const categoryId = payload.category_id
    ? await resolveRefId(
        Category,
        adminId,
        payload.category_id,
        payload.category_server_id,
        idMap,
      )
    : null;
  const partyId = payload.party_id
    ? await resolveRefId(
        Party,
        adminId,
        payload.party_id,
        payload.party_server_id,
        idMap,
      )
    : null;
  const forPartyId = payload.for_party_id
    ? await resolveRefId(
        Party,
        adminId,
        payload.for_party_id,
        payload.for_party_server_id,
        idMap,
      )
    : null;

  const isNew = !doc;
  const prevSnapshot = doc
    ? {
        account: doc.account,
        party: doc.party,
        type: doc.type,
        amount: doc.amount,
        payment_status: doc.payment_status,
        is_deleted: doc.is_deleted,
      }
    : null;

  if (isNew) {
    doc = new Transaction({ admin: adminId, account: accountId });
  }

  const orgRef = orgIdFromPayload(payload);
  if (orgRef) doc.organization = orgRef;

  doc.account = accountId;
  doc.category_id = categoryId || undefined;
  doc.party = partyId || undefined;
  doc.for_party = forPartyId || undefined;
  if (payload.type !== undefined) doc.type = payload.type;
  if (payload.amount !== undefined) doc.amount = Number(payload.amount);
  if (payload.date !== undefined) doc.date = new Date(payload.date);
  if (payload.description !== undefined) doc.description = payload.description;
  if (payload.keyword !== undefined) doc.keyword = payload.keyword;
  if (payload.counterparty !== undefined) {
    doc.counterparty = payload.counterparty;
  }
  if (payload.vendor !== undefined) doc.vendor = payload.vendor;
  if (payload.payment_status !== undefined) {
    doc.payment_status = payload.payment_status;
  }
  if (payload.due_date !== undefined) {
    doc.due_date = payload.due_date ? new Date(payload.due_date) : undefined;
  }
  if (payload.due_group_id !== undefined) {
    doc.due_group_id =
      payload.due_group_id && isValidObjectId(payload.due_group_id)
        ? toObjectId(payload.due_group_id)
        : undefined;
  }
  if (payload.parent_due_id !== undefined) {
    doc.parent_due_id =
      payload.parent_due_id && isValidObjectId(payload.parent_due_id)
        ? toObjectId(payload.parent_due_id)
        : await resolveRefId(
            Transaction,
            adminId,
            payload.parent_due_id,
            payload.parent_due_server_id,
            idMap,
          );
  }
  if (payload.due_remaining !== undefined) {
    doc.due_remaining = payload.due_remaining;
  }
  if (payload.due_settled_at !== undefined) {
    doc.due_settled_at = payload.due_settled_at
      ? new Date(payload.due_settled_at)
      : undefined;
  }
  if (payload.meta_data_json !== undefined) {
    try {
      doc.meta_data =
        typeof payload.meta_data_json === "string"
          ? JSON.parse(payload.meta_data_json)
          : payload.meta_data_json;
    } catch {
      doc.meta_data = payload.meta_data;
    }
  } else if (payload.meta_data !== undefined) {
    doc.meta_data = payload.meta_data;
  }
  // Ignore client balance_after_* — server denormalized fields are set after $inc.
  if (payload.transfer_id !== undefined) {
    doc.transfer_id =
      payload.transfer_id && isValidObjectId(payload.transfer_id)
        ? toObjectId(payload.transfer_id)
        : undefined;
  }
  if (payload.transfer_direction !== undefined) {
    doc.transfer_direction = payload.transfer_direction;
  }
  if (payload.attachments_json !== undefined) {
    try {
      doc.attachments =
        typeof payload.attachments_json === "string"
          ? JSON.parse(payload.attachments_json)
          : payload.attachments_json;
    } catch {
      /* ignore malformed attachments */
    }
  } else if (payload.attachments !== undefined) {
    doc.attachments = payload.attachments;
  }
  if (clientRequestId) doc.client_request_id = clientRequestId;
  doc.is_deleted = false;
  doc.deleted_at = undefined;
  doc.meta_data = mergeClientMeta(doc.meta_data, clientId);
  applyTimestamps(doc, payload, change);

  // Balance side-effects: revert previous paid state, apply new paid state.
  if (prevSnapshot && !prevSnapshot.is_deleted) {
    const oldCash = accountCashDelta(
      prevSnapshot.type,
      prevSnapshot.amount,
      prevSnapshot.payment_status,
    );
    if (oldCash) {
      await applyAccountInc(prevSnapshot.account, -oldCash);
    }
    if (prevSnapshot.party && oldCash) {
      const partyDoc = await Party.findById(prevSnapshot.party)
        .select("type")
        .lean();
      const pDelta = partyBalanceDelta(
        partyDoc?.type,
        prevSnapshot.type,
        prevSnapshot.amount,
        prevSnapshot.payment_status,
      );
      if (pDelta) await applyPartyInc(prevSnapshot.party, -pDelta);
    }
  }

  const newCash = accountCashDelta(doc.type, doc.amount, doc.payment_status);
  if (newCash) {
    const newBal = await Account.findByIdAndUpdate(
      doc.account,
      { $inc: { current_balance: newCash } },
      { new: true },
    );
    doc.balance_after_transaction = newBal?.current_balance ?? null;
  } else if (doc.payment_status === "due") {
    doc.balance_after_transaction = undefined;
    if (isNew && !doc.due_remaining && doc.due_remaining !== 0) {
      doc.due_remaining = Number(doc.amount) || 0;
    }
    if (isNew && !doc.due_group_id) {
      // Will set after save when we have _id
    }
  }

  if (doc.party && newCash) {
    const partyDoc = await Party.findById(doc.party).select("type").lean();
    const pDelta = partyBalanceDelta(
      partyDoc?.type,
      doc.type,
      doc.amount,
      doc.payment_status,
    );
    if (pDelta) {
      const updatedParty = await Party.findByIdAndUpdate(
        doc.party,
        { $inc: { current_balance: pDelta } },
        { new: true },
      );
      doc.party_balance_after = updatedParty?.current_balance ?? null;
    }
  }

  // Due payment against parent.
  if (isNew && doc.parent_due_id && doc.payment_status === "paid") {
    const parent = await Transaction.findById(doc.parent_due_id);
    if (parent && !parent.is_deleted) {
      const next = Math.max(
        0,
        Number(parent.due_remaining ?? parent.amount ?? 0) -
          Number(doc.amount || 0),
      );
      parent.due_remaining = next;
      if (next <= 1e-9) parent.due_settled_at = new Date();
      await parent.save();
    }
  }

  await doc.save({ timestamps: false });

  if (isNew && doc.payment_status === "due" && !doc.due_group_id) {
    doc.due_group_id = doc._id;
    if (doc.due_remaining == null) doc.due_remaining = Number(doc.amount) || 0;
    await doc.save({ timestamps: false });
  }

  if (clientId) idMap.set(String(clientId), doc._id.toString());
  return { doc, created: isNew };
};

const mapTransferPayload = async (adminId, change, idMap) => {
  const payload = change.payload || {};
  const clientId = change.id || payload.id;
  const serverId = change.server_id || payload.server_id;
  const clientRequestId =
    change.client_request_id || payload.client_request_id || null;

  let doc = null;
  if (clientRequestId) {
    doc = await Transfer.findOne({
      admin: adminId,
      client_request_id: clientRequestId,
    });
  }
  if (!doc) {
    doc = await findByServerOrClientId(
      Transfer,
      adminId,
      serverId,
      clientId,
    );
  }
  rejectIfStale(doc, change);

  if (change.op === "delete") {
    if (!doc) return { doc: null, created: false };
    const deletedAt = change.deleted_at
      ? new Date(change.deleted_at)
      : new Date();
    const txIds = [doc.debit_transaction, doc.credit_transaction].filter(
      Boolean,
    );
    if (txIds.length) {
      await Transaction.updateMany(
        { _id: { $in: txIds }, admin: adminId },
        { $set: { is_deleted: true, deleted_at: deletedAt } },
      );
    }
    doc.meta_data = mergeClientMeta(
      { ...doc.meta_data, deleted_at: deletedAt.toISOString(), device_id: change.device_id },
      clientId,
    );
    applyTimestamps(doc, payload, change);
    await doc.save({ timestamps: false });
    return { doc, created: false };
  }

  const fromAccountId = await resolveRefId(
    Account,
    adminId,
    payload.from_account_id,
    payload.from_account_server_id,
    idMap,
  );
  const toAccountId = await resolveRefId(
    Account,
    adminId,
    payload.to_account_id,
    payload.to_account_server_id,
    idMap,
  );
  if (!fromAccountId || !toAccountId) {
    throw new Error("Transfer account references not found");
  }

  let debitTxId = await resolveRefId(
    Transaction,
    adminId,
    payload.debit_transaction_id,
    payload.debit_transaction_server_id,
    idMap,
  );
  let creditTxId = await resolveRefId(
    Transaction,
    adminId,
    payload.credit_transaction_id,
    payload.credit_transaction_server_id,
    idMap,
  );

  if (!debitTxId || !creditTxId) {
    const transferDate = payload.date ? new Date(payload.date) : new Date();
    const amount = Number(payload.amount ?? 0);
    if (!debitTxId) {
      const debitTx = new Transaction({
        admin: adminId,
        account: fromAccountId,
        amount,
        type: "debit",
        date: transferDate,
        description: payload.description || "Transfer out",
        keyword: payload.keyword,
        counterparty: payload.counterparty,
        client_request_id: clientRequestId
          ? `${clientRequestId}:debit`
          : undefined,
        meta_data: mergeClientMeta(null, `${clientId}:debit`),
      });
      await debitTx.save();
      debitTxId = debitTx._id;
    }
    if (!creditTxId) {
      const creditTx = new Transaction({
        admin: adminId,
        account: toAccountId,
        amount,
        type: "credit",
        date: transferDate,
        description: payload.description || "Transfer in",
        keyword: payload.keyword,
        counterparty: payload.counterparty,
        client_request_id: clientRequestId
          ? `${clientRequestId}:credit`
          : undefined,
        meta_data: mergeClientMeta(null, `${clientId}:credit`),
      });
      await creditTx.save();
      creditTxId = creditTx._id;
    }
  }

  const isNew = !doc;
  if (isNew) {
    doc = new Transfer({
      admin: adminId,
      from_account: fromAccountId,
      to_account: toAccountId,
      debit_transaction: debitTxId,
      credit_transaction: creditTxId,
    });
  }

  const orgRef = orgIdFromPayload(payload);
  if (orgRef) doc.organization = orgRef;

  doc.from_account = fromAccountId;
  doc.to_account = toAccountId;
  doc.debit_transaction = debitTxId;
  doc.credit_transaction = creditTxId;
  if (payload.amount !== undefined) doc.amount = Number(payload.amount);
  if (payload.date !== undefined) doc.date = new Date(payload.date);
  if (payload.description !== undefined) doc.description = payload.description;
  if (payload.keyword !== undefined) doc.keyword = payload.keyword;
  if (payload.counterparty !== undefined) doc.counterparty = payload.counterparty;
  if (payload.meta_data_json !== undefined) {
    try {
      doc.meta_data =
        typeof payload.meta_data_json === "string"
          ? JSON.parse(payload.meta_data_json)
          : payload.meta_data_json;
    } catch {
      doc.meta_data = payload.meta_data;
    }
  } else if (payload.meta_data !== undefined) {
    doc.meta_data = payload.meta_data;
  }
  if (clientRequestId) doc.client_request_id = clientRequestId;
  doc.meta_data = mergeClientMeta(doc.meta_data, clientId);
  applyTimestamps(doc, payload, change);
  await doc.save({ timestamps: false });
  if (clientId) idMap.set(String(clientId), doc._id.toString());
  return { doc, created: isNew };
};

// ── Shop entity mappers (Phase 13) ─────────────────────────────────────────
// Design: these are deliberately SIDE-EFFECT FREE. The client already owns
// stock (via pushed `stock_movement` rows) and cash (via pushed `transaction`
// rows), so an invoice push must not touch balances or inventory — otherwise
// every sync would double-count.

const boolNum = (value) => (Number(value) || value === true ? 1 : 0);

const mapProductPayload = async (adminId, change, idMap) => {
  const payload = change.payload || {};
  const clientId = change.id || payload.id;
  const serverId = change.server_id || payload.server_id;

  let doc = await findByServerOrClientId(Product, adminId, serverId, clientId);
  rejectIfStale(doc, change);

  if (change.op === "delete") {
    if (!doc) return { doc: null, created: false };
    doc.is_deleted = true;
    doc.deleted_at = change.deleted_at
      ? new Date(change.deleted_at)
      : new Date();
    doc.meta_data = mergeClientMeta(
      { ...doc.meta_data, device_id: change.device_id },
      clientId,
    );
    applyTimestamps(doc, payload, change);
    await doc.save({ timestamps: false });
    return { doc, created: false };
  }

  const isNew = !doc;
  if (isNew) doc = new Product({ admin: adminId });

  const orgRef = orgIdFromPayload(payload);
  if (orgRef) doc.organization = orgRef;
  else if (isNew) doc.organization = undefined;

  const assign = (key) => {
    if (payload[key] !== undefined) doc[key] = payload[key];
  };
  assign("name");
  assign("sku");
  assign("barcode");
  assign("description");
  assign("unit");
  assign("tax_rate");
  assign("low_stock_threshold");

  // Numbers arrive as REAL from SQLite.
  for (const key of [
    "purchase_price",
    "additional_cost",
    "sale_price",
    "current_stock",
    "opening_stock",
  ]) {
    if (payload[key] !== undefined) doc[key] = Number(payload[key]);
  }
  if (payload.category_id !== undefined) {
    const catRef = await resolveRefId(
      Category,
      adminId,
      payload.category_id,
      payload.category_server_id,
      idMap,
    );
    doc.category_id = catRef || undefined;
  }
  if (payload.track_inventory !== undefined) {
    doc.track_inventory = Boolean(Number(payload.track_inventory));
  }
  if (payload.is_active !== undefined) {
    doc.is_active = Boolean(Number(payload.is_active));
  }
  if (payload.is_deleted !== undefined) {
    doc.is_deleted = Boolean(Number(payload.is_deleted));
  }
  if (payload.deleted_at !== undefined) {
    doc.deleted_at = payload.deleted_at ? new Date(payload.deleted_at) : undefined;
  } else if (doc.is_deleted === false) {
    doc.deleted_at = undefined;
  }

  if (payload.client_request_id) {
    doc.client_request_id = payload.client_request_id;
  }
  doc.meta_data = mergeClientMeta(
    { ...doc.meta_data, device_id: change.device_id },
    clientId,
  );
  applyTimestamps(doc, payload, change);
  await doc.save({ timestamps: false });
  if (clientId) idMap.set(String(clientId), doc._id.toString());
  return { doc, created: isNew };
};

/** Build the embedded items array from the client's normalized item rows. */
const toEmbeddedItems = (items) =>
  (Array.isArray(items) ? items : []).map((it) => ({
    description: String(it.description ?? ""),
    quantity: Number(it.quantity || 0),
    unit: it.unit ?? "pcs",
    unit_price: Number(it.unit_price || 0),
    discount: Number(it.discount || 0),
    discount_type: it.discount_type === "percent" ? "percent" : "fixed",
    tax_rate: Number(it.tax_rate || 0),
    subtotal: Number(it.subtotal || 0),
    discount_amount: Number(it.discount_amount || 0),
    tax_amount: Number(it.tax_amount || 0),
    total: Number(it.total || 0),
    barcode: it.barcode_snapshot ?? undefined,
    notes: it.notes ?? undefined,
    // Cost basis captured at sale time — the whole point of Phase 9.
    unit_cost_at_sale:
      it.unit_cost_at_sale === null || it.unit_cost_at_sale === undefined
        ? undefined
        : Number(it.unit_cost_at_sale),
    ...(it.product_server_id
      ? { product: new mongoose.Types.ObjectId(it.product_server_id) }
      : {}),
  }));

const mapInvoicePayload = async (adminId, change, idMap) => {
  const payload = change.payload || {};
  const clientId = change.id || payload.id;
  const serverId = change.server_id || payload.server_id;
  const clientRequestId =
    change.client_request_id || payload.client_request_id || null;

  let doc = null;
  if (clientRequestId) {
    doc = await Invoice.findOne({
      admin: adminId,
      client_request_id: clientRequestId,
      is_deleted: { $ne: true },
    });
  }
  if (!doc) {
    doc = await findByServerOrClientId(Invoice, adminId, serverId, clientId);
  }
  rejectIfStale(doc, change);

  if (change.op === "delete") {
    if (!doc) return { doc: null, created: false };
    doc.status = "cancelled";
    doc.cancelled_at = change.deleted_at
      ? new Date(change.deleted_at)
      : new Date();
    doc.meta_data = mergeClientMeta(
      { ...doc.meta_data, device_id: change.device_id },
      clientId,
    );
    applyTimestamps(doc, payload, change);
    await doc.save({ timestamps: false });
    return { doc, created: false };
  }

  const isNew = !doc;
  if (isNew) doc = new Invoice({ admin: adminId });

  const orgRef = orgIdFromPayload(payload);
  if (orgRef) doc.organization = orgRef;

  if (payload.invoice_number) doc.invoice_number = payload.invoice_number;
  if (payload.type) doc.type = payload.type === "purchase" ? "purchase" : "sale";
  if (payload.status) doc.status = payload.status;
  if (payload.date) doc.date = new Date(payload.date);
  if (payload.due_date !== undefined) {
    doc.due_date = payload.due_date ? new Date(payload.due_date) : undefined;
  }
  if (payload.party_name !== undefined) doc.party_name = payload.party_name;
  if (payload.party_phone !== undefined) doc.party_phone = payload.party_phone;
  if (payload.party_address !== undefined) {
    doc.party_address = payload.party_address;
  }
  if (payload.party_id) {
    const partyRef = await resolveRefId(
      Party,
      adminId,
      payload.party_id,
      payload.party_server_id,
      idMap,
    );
    doc.party = partyRef || undefined;
  }
  if (Array.isArray(payload.items)) {
    doc.items = toEmbeddedItems(payload.items);
  }
  if (payload.notes !== undefined) doc.notes = payload.notes;
  if (payload.terms !== undefined) doc.terms = payload.terms;
  if (payload.internal_notes !== undefined) {
    doc.internal_notes = payload.internal_notes;
  }
  if (payload.linked_transactions !== undefined) {
    doc.linked_transactions = payload.linked_transactions
      .map((t) => (isValidObjectId(String(t)) ? toObjectId(String(t)) : null))
      .filter(Boolean);
  }
  if (clientRequestId) doc.client_request_id = clientRequestId;

  // Amounts are recomputed by the model's pre-save hook from items. Payments
  // are pushed as part of the invoice payload so a later payment re-pushes the
  // same doc (idempotent by client_request_id).
  if (Array.isArray(payload.payments)) {
    doc.payments = payload.payments.map((p) => ({
      date: p.date ? new Date(p.date) : new Date(),
      amount: Number(p.amount || 0),
      method: p.method || "cash",
      reference: p.reference ?? undefined,
      notes: p.notes ?? undefined,
    }));
  }

  doc.created_by = doc.created_by || adminId;
  doc.is_deleted = false;
  doc.meta_data = mergeClientMeta(
    { ...doc.meta_data, device_id: change.device_id },
    clientId,
  );
  applyTimestamps(doc, payload, change);

  try {
    await doc.save({ timestamps: false });
  } catch (error) {
    // A local invoice number can collide with the org counter. Keep the data by
    // giving this doc a unique suffix instead of failing the whole push.
    if (error?.code === 11000 && error?.keyPattern?.invoice_number) {
      doc.invoice_number = `${doc.invoice_number}-${String(doc._id).slice(-5)}`;
      await doc.save({ timestamps: false });
    } else {
      throw error;
    }
  }

  if (clientId) idMap.set(String(clientId), doc._id.toString());
  return { doc, created: isNew };
};

const mapStockMovementPayload = async (adminId, change, idMap) => {
  const payload = change.payload || {};
  const clientId = change.id || payload.id;
  const serverId = change.server_id || payload.server_id;
  const clientRequestId =
    change.client_request_id || payload.client_request_id || null;

  // Idempotency first: a retried movement must never double-count stock.
  if (clientRequestId) {
    const existing = await StockMovement.findOne({
      admin: adminId,
      client_request_id: clientRequestId,
    });
    if (existing) {
      if (clientId) idMap.set(String(clientId), existing._id.toString());
      return { doc: existing, created: false };
    }
  }

  let doc = await findByServerOrClientId(
    StockMovement,
    adminId,
    serverId,
    clientId,
  );
  rejectIfStale(doc, change);
  if (doc) {
    if (clientId) idMap.set(String(clientId), doc._id.toString());
    return { doc, created: false };
  }

  const productRef = await resolveRefId(
    Product,
    adminId,
    payload.product_id,
    payload.product_server_id,
    idMap,
  );
  if (!productRef) {
    throw new Error("Stock movement product reference not found");
  }

  doc = new StockMovement({
    admin: adminId,
    product: productRef,
    type: payload.type,
    quantity: Number(payload.quantity || 0),
    unit_cost: Number(payload.unit_cost || 0),
    stock_after: Number(payload.stock_after || 0),
    notes: payload.notes ?? undefined,
    date: payload.date ? new Date(payload.date) : new Date(),
    created_by: adminId,
  });
  const orgRef = orgIdFromPayload(payload);
  if (orgRef) doc.organization = orgRef;
  if (clientRequestId) doc.client_request_id = clientRequestId;
  doc.meta_data = mergeClientMeta(
    { ...doc.meta_data, device_id: change.device_id },
    clientId,
  );
  applyTimestamps(doc, payload, change);
  await doc.save({ timestamps: false });
  if (clientId) idMap.set(String(clientId), doc._id.toString());
  return { doc, created: true };
};

const applyPushChange = async (adminId, change, idMap) => {
  switch (change.entity) {
    case "account":
      return mapAccountPayload(adminId, change, idMap);
    case "category":
      return mapCategoryPayload(adminId, change, idMap);
    case "party":
      return mapPartyPayload(adminId, change, idMap);
    case "transaction":
      return mapTransactionPayload(adminId, change, idMap);
    case "transfer":
      return mapTransferPayload(adminId, change, idMap);
    case "product":
      return mapProductPayload(adminId, change, idMap);
    case "invoice":
      return mapInvoicePayload(adminId, change, idMap);
    case "stock_movement":
      return mapStockMovementPayload(adminId, change, idMap);
    default:
      throw new Error(`Unsupported entity: ${change.entity}`);
  }
};

const toSyncChange = (entity, doc, opts = {}) => {
  const serverId = doc._id.toString();
  const clientId = clientIdFromDoc(doc);
  const id = clientId || serverId;
  const updatedAt = toIso(doc.updatedAt) || new Date().toISOString();
  const deletedAt =
    opts.deletedAt ??
    (entity === "transaction" && doc.is_deleted
      ? toIso(doc.deleted_at)
      : entity === "transfer" && doc.meta_data?.deleted_at
        ? toIso(doc.meta_data.deleted_at)
        : doc.archived
          ? toIso(doc.archived_at)
          : null);

  const payload = opts.payload
    ? {
        ...opts.payload,
        id,
        server_id: serverId,
      }
    : opts.payload;

  return {
    entity,
    id,
    server_id: serverId,
    op: deletedAt ? "delete" : "upsert",
    updated_at: updatedAt,
    deleted_at: deletedAt,
    device_id: doc.meta_data?.device_id || "server",
    client_request_id: doc.client_request_id ?? null,
    payload,
  };
};

const accountToPayload = (doc) => ({
  id: clientIdFromDoc(doc) || doc._id.toString(),
  server_id: doc._id.toString(),
  organization_id: doc.organization ? String(doc.organization) : null,
  name: doc.name,
  description: doc.description ?? null,
  kind: doc.kind,
  opening_balance: doc.opening_balance ?? 0,
  current_balance: doc.current_balance ?? 0,
  currency_code: doc.currency_code ?? null,
  currency_symbol: doc.currency_symbol ?? null,
  archived: doc.archived ? 1 : 0,
  archived_at: toIso(doc.archived_at),
  created_at: toIso(doc.createdAt),
  updated_at: toIso(doc.updatedAt),
  deleted_at: doc.archived ? toIso(doc.archived_at) : null,
  dirty: 0,
  sync_version: 0,
  client_request_id: doc.client_request_id ?? null,
  device_id: doc.meta_data?.device_id || "server",
  meta_data_json: doc.meta_data ? JSON.stringify(doc.meta_data) : null,
});

const categoryToPayload = (doc) => ({
  id: clientIdFromDoc(doc) || doc._id.toString(),
  server_id: doc._id.toString(),
  organization_id: doc.organization ? String(doc.organization) : null,
  type: doc.type,
  flow: doc.flow,
  name: doc.name,
  description: doc.description ?? null,
  color: doc.color ?? null,
  archived: doc.archived ? 1 : 0,
  archived_at: toIso(doc.archived_at),
  created_at: toIso(doc.createdAt),
  updated_at: toIso(doc.updatedAt),
  deleted_at: doc.archived ? toIso(doc.archived_at) : null,
  dirty: 0,
  sync_version: 0,
  client_request_id: doc.client_request_id ?? null,
  device_id: doc.meta_data?.device_id || "server",
  meta_data_json: doc.meta_data ? JSON.stringify(doc.meta_data) : null,
});

const partyToPayload = (doc) => ({
  id: doc._id.toString(),
  server_id: doc._id.toString(),
  organization_id: doc.organization ? String(doc.organization) : null,
  type: doc.type,
  name: doc.name,
  code: doc.code ?? null,
  phone: doc.phone ?? null,
  email: doc.email ?? null,
  address_json: doc.address ? JSON.stringify(doc.address) : null,
  opening_balance: doc.opening_balance ?? 0,
  current_balance: doc.current_balance ?? 0,
  credit_limit: doc.credit_limit ?? null,
  notes: doc.notes ?? null,
  archived: doc.archived ? 1 : 0,
  archived_at: toIso(doc.archived_at),
  created_at: toIso(doc.createdAt),
  updated_at: toIso(doc.updatedAt),
  deleted_at: doc.archived ? toIso(doc.archived_at) : null,
  dirty: 0,
  sync_version: 0,
  client_request_id: doc.client_request_id ?? null,
  device_id: "server",
});

const transactionToPayload = (doc) => ({
  id: doc._id.toString(),
  server_id: doc._id.toString(),
  organization_id: doc.organization ? String(doc.organization) : null,
  account_id: doc.account?.toString() ?? null,
  category_id: doc.category_id?.toString() ?? null,
  party_id: doc.party?.toString() ?? null,
  for_party_id: doc.for_party?.toString() ?? null,
  type: doc.type,
  amount: doc.amount,
  date: toIso(doc.date),
  description: doc.description ?? null,
  keyword: doc.keyword ?? null,
  counterparty: doc.counterparty ?? null,
  vendor: doc.vendor ?? null,
  payment_status: doc.payment_status ?? "paid",
  due_date: toIso(doc.due_date),
  due_group_id: doc.due_group_id?.toString() ?? null,
  parent_due_id: doc.parent_due_id?.toString() ?? null,
  due_remaining: doc.due_remaining ?? null,
  due_settled_at: toIso(doc.due_settled_at),
  meta_data_json: doc.meta_data ? JSON.stringify(doc.meta_data) : null,
  balance_after_transaction: doc.balance_after_transaction ?? null,
  party_balance_after: doc.party_balance_after ?? null,
  transfer_id: doc.transfer_id?.toString() ?? null,
  transfer_direction: doc.transfer_direction ?? null,
  attachments_json: doc.attachments ? JSON.stringify(doc.attachments) : null,
  created_at: toIso(doc.createdAt),
  updated_at: toIso(doc.updatedAt),
  deleted_at: doc.is_deleted ? toIso(doc.deleted_at) : null,
  dirty: 0,
  sync_version: 0,
  client_request_id: doc.client_request_id ?? null,
  device_id: "server",
});

const transferToPayload = (doc) => ({
  id: clientIdFromDoc(doc) || doc._id.toString(),
  server_id: doc._id.toString(),
  organization_id: doc.organization ? String(doc.organization) : null,
  from_account_id: doc.from_account?.toString() ?? null,
  to_account_id: doc.to_account?.toString() ?? null,
  amount: doc.amount,
  date: toIso(doc.date),
  description: doc.description ?? null,
  keyword: doc.keyword ?? null,
  counterparty: doc.counterparty ?? null,
  meta_data_json: doc.meta_data ? JSON.stringify(doc.meta_data) : null,
  debit_transaction_id: doc.debit_transaction?.toString() ?? null,
  credit_transaction_id: doc.credit_transaction?.toString() ?? null,
  created_at: toIso(doc.createdAt),
  updated_at: toIso(doc.updatedAt),
  deleted_at: doc.meta_data?.deleted_at
    ? toIso(doc.meta_data.deleted_at)
    : null,
  dirty: 0,
  sync_version: 0,
  client_request_id: doc.client_request_id ?? null,
  device_id: doc.meta_data?.device_id || "server",
});

const productToPayload = (doc) => ({
  id: clientIdFromDoc(doc) || doc._id.toString(),
  server_id: doc._id.toString(),
  organization_id: doc.organization ? String(doc.organization) : null,
  name: doc.name,
  sku: doc.sku ?? null,
  barcode: doc.barcode ?? null,
  description: doc.description ?? null,
  category_id: doc.category_id ? String(doc.category_id) : null,
  unit: doc.unit ?? "pcs",
  purchase_price: doc.purchase_price ?? 0,
  additional_cost: doc.additional_cost ?? 0,
  cost_price: doc.cost_price ?? 0,
  sale_price: doc.sale_price ?? 0,
  tax_rate: doc.tax_rate ?? 0,
  current_stock: doc.current_stock ?? 0,
  opening_stock: doc.opening_stock ?? 0,
  low_stock_threshold: doc.low_stock_threshold ?? 0,
  track_inventory: doc.track_inventory === false ? 0 : 1,
  is_active: doc.is_active === false ? 0 : 1,
  is_deleted: doc.is_deleted ? 1 : 0,
  deleted_at: toIso(doc.deleted_at),
  created_at: toIso(doc.createdAt),
  updated_at: toIso(doc.updatedAt),
  dirty: 0,
  sync_version: 0,
  client_request_id: doc.client_request_id ?? null,
  device_id: doc.meta_data?.device_id || "server",
  sync_status: "synced",
  meta_data_json: doc.meta_data ? JSON.stringify(doc.meta_data) : null,
});

const invoiceToPayload = (doc) => ({
  id: clientIdFromDoc(doc) || doc._id.toString(),
  server_id: doc._id.toString(),
  organization_id: doc.organization ? String(doc.organization) : null,
  invoice_number: doc.invoice_number,
  type: doc.type,
  status: doc.status,
  party_id: doc.party ? String(doc.party) : null,
  party_name: doc.party_name ?? null,
  party_phone: doc.party_phone ?? null,
  party_address: doc.party_address ?? null,
  date: toIso(doc.date),
  due_date: toIso(doc.due_date),
  subtotal: doc.subtotal ?? 0,
  total_discount: doc.total_discount ?? 0,
  total_tax: doc.total_tax ?? 0,
  shipping_charge: doc.shipping_charge ?? 0,
  adjustment: doc.adjustment ?? 0,
  adjustment_description: doc.adjustment_description ?? null,
  grand_total: doc.grand_total ?? 0,
  amount_paid: doc.amount_paid ?? 0,
  balance_due: doc.balance_due ?? 0,
  notes: doc.notes ?? null,
  terms: doc.terms ?? null,
  internal_notes: doc.internal_notes ?? null,
  items: (doc.items || []).map((it) => ({
    id: it._id ? String(it._id) : null,
    product_id: it.product ? String(it.product) : null,
    description: it.description,
    quantity: it.quantity,
    unit: it.unit ?? "pcs",
    unit_price: it.unit_price,
    discount: it.discount ?? 0,
    discount_type: it.discount_type ?? "fixed",
    tax_rate: it.tax_rate ?? 0,
    subtotal: it.subtotal ?? 0,
    discount_amount: it.discount_amount ?? 0,
    tax_amount: it.tax_amount ?? 0,
    total: it.total ?? 0,
    unit_cost_at_sale: it.unit_cost_at_sale ?? null,
    barcode_snapshot: it.barcode ?? null,
    notes: it.notes ?? null,
  })),
  payments: (doc.payments || []).map((p) => ({
    id: p._id ? String(p._id) : null,
    date: toIso(p.date),
    amount: p.amount,
    method: p.method ?? null,
    account_id: p.account ? String(p.account) : null,
    transaction_id: p.transaction ? String(p.transaction) : null,
    reference: p.reference ?? null,
    notes: p.notes ?? null,
  })),
  created_at: toIso(doc.createdAt),
  updated_at: toIso(doc.updatedAt),
  deleted_at: null,
  dirty: 0,
  sync_version: 0,
  client_request_id: doc.client_request_id ?? null,
  device_id: doc.meta_data?.device_id || "server",
  sync_status: "synced",
});

const stockMovementToPayload = (doc) => ({
  id: clientIdFromDoc(doc) || doc._id.toString(),
  server_id: doc._id.toString(),
  organization_id: doc.organization ? String(doc.organization) : null,
  product_id: doc.product ? String(doc.product) : null,
  type: doc.type,
  quantity: doc.quantity,
  unit_cost: doc.unit_cost ?? 0,
  stock_after: doc.stock_after ?? 0,
  notes: doc.notes ?? null,
  date: toIso(doc.date),
  created_at: toIso(doc.createdAt),
  updated_at: toIso(doc.updatedAt),
  deleted_at: null,
  dirty: 0,
  sync_version: 0,
  client_request_id: doc.client_request_id ?? null,
  device_id: doc.meta_data?.device_id || "server",
  sync_status: "synced",
});

export const handshake = async (req, res, next) => {
  try {
    res.json({
      serverTime: new Date().toISOString(),
      minSchemaVersion: MIN_SCHEMA_VERSION,
    });
  } catch (error) {
    next(error);
  }
};

export const push = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { changes } = req.body;

    if (!Array.isArray(changes)) {
      return res.status(400).json({ message: "changes must be an array" });
    }
    if (changes.length > MAX_PUSH_CHANGES) {
      return res.status(413).json({
        message: `Too many changes. Maximum ${MAX_PUSH_CHANGES} per push.`,
      });
    }

    const accepted = [];
    const rejected = [];
    const idMap = new Map();

    for (const change of changes) {
      if (!change?.entity || !change?.id) {
        rejected.push({
          id: change?.id ?? "unknown",
          reason: "Missing entity or id",
        });
        continue;
      }

      try {
        const { doc } = await applyPushChange(adminId, change, idMap);
        if (!doc) {
          rejected.push({ id: change.id, reason: "Entity not found for delete" });
          continue;
        }
        accepted.push({
          id: change.id,
          server_id: doc._id.toString(),
        });
      } catch (error) {
        rejected.push({
          id: change.id,
          reason: error.message || "Failed to apply change",
        });
      }
    }

    res.json({ accepted, rejected });
  } catch (error) {
    next(error);
  }
};

export const pull = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const sinceRaw = req.query.since;
    const scope = req.query.scope || "personal";

    if (!sinceRaw) {
      return res.status(400).json({ message: "since query parameter is required" });
    }
    const since = new Date(sinceRaw);
    if (Number.isNaN(since.getTime())) {
      return res.status(400).json({ message: "Invalid since timestamp" });
    }

    const filter =
      scope === "personal"
        ? { ...personalScope(adminId), updatedAt: { $gt: since } }
        : { ...adminScope(adminId), updatedAt: { $gt: since } };

    const [accounts, categories, parties, transactions, transfers] =
      await Promise.all([
        Account.find(filter).lean(),
        Category.find(filter).lean(),
        Party.find(filter).lean(),
        Transaction.find(filter).lean(),
        Transfer.find(filter).lean(),
      ]);

    // Shop entities. Products/movements/invoices all carry `admin`, so the same
    // filter works. Kept in a separate query so a shop-model error cannot break
    // ledger pull for older deployments.
    let products = [];
    let invoices = [];
    let stockMovements = [];
    try {
      [products, invoices, stockMovements] = await Promise.all([
        Product.find(filter).lean(),
        Invoice.find(filter).lean(),
        StockMovement.find(filter).lean(),
      ]);
    } catch (e) {
      // Models may be absent on an older server — ledger sync still succeeds.
      console.warn("[sync] shop pull skipped", e?.message);
    }

    const changes = [];
    let maxUpdatedAt = since.getTime();

    const trackMax = (doc) => {
      const ts = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
      if (ts > maxUpdatedAt) maxUpdatedAt = ts;
    };

    for (const doc of accounts) {
      trackMax(doc);
      changes.push(
        toSyncChange("account", doc, { payload: accountToPayload(doc) }),
      );
    }
    for (const doc of categories) {
      trackMax(doc);
      changes.push(
        toSyncChange("category", doc, { payload: categoryToPayload(doc) }),
      );
    }
    for (const doc of parties) {
      trackMax(doc);
      changes.push(
        toSyncChange("party", doc, { payload: partyToPayload(doc) }),
      );
    }
    for (const doc of transactions) {
      trackMax(doc);
      changes.push(
        toSyncChange("transaction", doc, {
          payload: transactionToPayload(doc),
        }),
      );
    }
    for (const doc of transfers) {
      trackMax(doc);
      changes.push(
        toSyncChange("transfer", doc, { payload: transferToPayload(doc) }),
      );
    }

    for (const doc of products) {
      trackMax(doc);
      changes.push(
        toSyncChange("product", doc, { payload: productToPayload(doc) }),
      );
    }
    for (const doc of invoices) {
      trackMax(doc);
      changes.push(
        toSyncChange("invoice", doc, { payload: invoiceToPayload(doc) }),
      );
    }
    for (const doc of stockMovements) {
      trackMax(doc);
      changes.push(
        toSyncChange("stock_movement", doc, {
          payload: stockMovementToPayload(doc),
        }),
      );
    }

    const cursor =
      changes.length > 0
        ? new Date(maxUpdatedAt).toISOString()
        : new Date().toISOString();

    res.json({ changes, cursor });
  } catch (error) {
    next(error);
  }
};

export const ack = async (req, res, next) => {
  try {
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
