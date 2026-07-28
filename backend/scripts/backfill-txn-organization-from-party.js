/**
 * Backfill transaction.organization from linked party.organization.
 *
 * Many org-scoped parties have transactions missing the organization field
 * (created without x-organization-id). Org-scoped ledger/count queries then
 * return zero rows even though party ObjectId links exist.
 *
 * Usage: node scripts/backfill-txn-organization-from-party.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Party } from "../models/Party.js";
import { Transaction } from "../models/Transaction.js";

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  console.error("Set MONGODB_URI");
  process.exit(1);
}

await mongoose.connect(uri);

const orgParties = await Party.find({
  organization: { $exists: true, $ne: null },
})
  .select("_id organization")
  .lean();

const partyOrg = new Map(
  orgParties.map((p) => [String(p._id), p.organization]),
);
const ids = orgParties.map((p) => p._id);

const missing = await Transaction.find({
  is_deleted: { $ne: true },
  $and: [
    { $or: [{ party: { $in: ids } }, { for_party: { $in: ids } }] },
    { $or: [{ organization: null }, { organization: { $exists: false } }] },
  ],
})
  .select("_id party for_party")
  .lean();

console.log(`Found ${missing.length} transactions to backfill`);

const ops = [];
for (const txn of missing) {
  const org =
    (txn.party && partyOrg.get(String(txn.party))) ||
    (txn.for_party && partyOrg.get(String(txn.for_party)));
  if (!org) continue;
  ops.push({
    updateOne: {
      filter: { _id: txn._id },
      update: { $set: { organization: org } },
    },
  });
}

if (ops.length) {
  const result = await Transaction.bulkWrite(ops, { ordered: false });
  console.log(`Updated ${result.modifiedCount || 0} transactions`);
} else {
  console.log("Nothing to update");
}

await mongoose.disconnect();
