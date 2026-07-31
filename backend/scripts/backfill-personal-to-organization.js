/**
 * Attach personal-scoped accounts / categories / parties / transactions
 * for one admin into a target organization.
 *
 * Needed when ledger data was created before org scoping, so org mode
 * only sees the few rows that already have organization set.
 *
 * Usage:
 *   node scripts/backfill-personal-to-organization.js \
 *     --admin=68ee351be62ca182442974eb \
 *     --organization=6948e857a916d1d7ac39dac8 \
 *     [--dry-run]
 */
import "dotenv/config";
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  console.error("Set MONGODB_URI");
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const adminId = args.admin;
const organizationId = args.organization;
const dryRun = Boolean(args["dry-run"]);

if (!adminId || !organizationId) {
  console.error(
    "Usage: node scripts/backfill-personal-to-organization.js --admin=<id> --organization=<id> [--dry-run]",
  );
  process.exit(1);
}

if (!mongoose.isValidObjectId(adminId) || !mongoose.isValidObjectId(organizationId)) {
  console.error("admin and organization must be valid ObjectIds");
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;

const admin = new mongoose.Types.ObjectId(adminId);
const organization = new mongoose.Types.ObjectId(organizationId);

const personalFilter = {
  admin,
  $or: [{ organization: { $exists: false } }, { organization: null }],
};

const collections = ["accounts", "categories", "parties", "transactions"];

for (const name of collections) {
  const filter =
    name === "transactions"
      ? { ...personalFilter, is_deleted: { $ne: true } }
      : personalFilter;

  const count = await db.collection(name).countDocuments(filter);
  console.log(`${name}: ${count} personal docs to attach`);

  if (!dryRun && count > 0) {
    const result = await db.collection(name).updateMany(filter, {
      $set: { organization },
    });
    console.log(`  → matched ${result.matchedCount}, modified ${result.modifiedCount}`);
  }
}

if (!dryRun) {
  const summary = {
    accounts: await db.collection("accounts").countDocuments({ organization }),
    categories: await db
      .collection("categories")
      .countDocuments({ organization }),
    parties: await db.collection("parties").countDocuments({ organization }),
    transactions: await db.collection("transactions").countDocuments({
      organization,
      is_deleted: { $ne: true },
    }),
  };
  console.log("\nOrg totals after backfill:", summary);
} else {
  console.log("\nDry run — no changes written.");
}

await mongoose.disconnect();
