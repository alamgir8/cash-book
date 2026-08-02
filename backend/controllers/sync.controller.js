import mongoose from "mongoose";
import { Account } from "../models/Account.js";
import { Category } from "../models/Category.js";
import { Party } from "../models/Party.js";
import { Transaction } from "../models/Transaction.js";
import { Transfer } from "../models/Transfer.js";

const MIN_SCHEMA_VERSION = 1;
const MAX_PUSH_CHANGES = 500;

const personalScope = (adminId) => ({
  admin: adminId,
  $or: [{ organization: { $exists: false } }, { organization: null }],
});

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
      ...personalScope(adminId),
    });
    if (doc) return doc;
  }
  if (clientId) {
    return Model.findOne({
      admin: adminId,
      ...personalScope(adminId),
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
      ...personalScope(adminId),
    }).select("_id");
    if (doc) return doc._id;
  }
  if (refValue && isValidObjectId(refValue)) {
    const doc = await Model.findOne({
      _id: toObjectId(refValue),
      admin: adminId,
      ...personalScope(adminId),
    }).select("_id");
    if (doc) return doc._id;
  }
  if (refValue) {
    const doc = await Model.findOne({
      admin: adminId,
      ...personalScope(adminId),
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

  if (payload.name !== undefined) doc.name = payload.name;
  if (payload.description !== undefined) doc.description = payload.description;
  if (payload.kind !== undefined) doc.kind = payload.kind;
  if (payload.opening_balance !== undefined) {
    doc.opening_balance = Number(payload.opening_balance);
  }
  if (payload.current_balance !== undefined) {
    doc.current_balance = Number(payload.current_balance);
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
  if (payload.current_balance !== undefined) {
    doc.current_balance = Number(payload.current_balance);
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
      ...personalScope(adminId),
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
  if (isNew) {
    doc = new Transaction({ admin: adminId, account: accountId });
  }

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
        : undefined;
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
  if (payload.balance_after_transaction !== undefined) {
    doc.balance_after_transaction = payload.balance_after_transaction;
  }
  if (payload.party_balance_after !== undefined) {
    doc.party_balance_after = payload.party_balance_after;
  }
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
  await doc.save({ timestamps: false });
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
      ...personalScope(adminId),
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
  organization_id: null,
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
  organization_id: null,
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
  organization_id: null,
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
  organization_id: null,
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
  organization_id: null,
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
        : { admin: adminId, updatedAt: { $gt: since } };

    const [accounts, categories, parties, transactions, transfers] =
      await Promise.all([
        Account.find(filter).lean(),
        Category.find(filter).lean(),
        Party.find(filter).lean(),
        Transaction.find(filter).lean(),
        Transfer.find(filter).lean(),
      ]);

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
