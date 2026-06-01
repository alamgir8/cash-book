#!/usr/bin/env node
/**
 * migrate-parties.js  (v2)
 *
 * Phase 1 — String-to-ObjectId migration (idempotent):
 *   For each admin/org scope, finds transactions that still have legacy
 *   counterparty / vendor strings with no `party` ObjectId ref, creates Party
 *   documents, links them, and recalculates balances.
 *
 * Phase 2 — Loan-role fix (idempotent):
 *   Ensures EVERY loan transaction has BOTH party (vendor/giver) AND
 *   for_party (beneficiary/receiver) set with the correct semantic:
 *
 *   loan_out  "Loan Given"          (debit)  : party=self, for_party=borrower
 *   loan_out  "Loan Repayment Paid" (debit)  : party=self, for_party=lender
 *   loan_in   "Loan Received"       (credit) : party=lender, for_party=self
 *   loan_in   "Loan Repayment Received"(credit): party=borrower, for_party=self
 *
 *   "self" = the admin's own Party document (looked up by --self-party-name,
 *            defaults to "আলমগীর"; created if not found).
 *
 * Usage:
 *   node scripts/migrate-parties.js
 *   node scripts/migrate-parties.js --admin-id=<ObjectId>
 *   node scripts/migrate-parties.js --self-party-name=আলমগীর
 *   node scripts/migrate-parties.js --dry-run
 */

import "dotenv/config";
import mongoose from "mongoose";
import { Admin } from "../models/Admin.js";
import { Party } from "../models/Party.js";
import { Transaction } from "../models/Transaction.js";
import { Category } from "../models/Category.js";

// ── helpers ────────────────────────────────────────────────────────────────

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseArgs = () => {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, value] = arg.replace(/^--/, "").split("=");
      return [key, value ?? true];
    }),
  );
  return {
    adminId: args["admin-id"] ?? null,
    selfPartyName: args["self-party-name"] ?? "আলমগীর",
    dryRun: Boolean(args["dry-run"]),
  };
};

// ── recalculate a single party's current_balance from its transactions ─────

async function recalculatePartyBalance(partyId, partyType) {
  const [agg] = await Transaction.aggregate([
    {
      $match: {
        party: new mongoose.Types.ObjectId(partyId.toString()),
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
      },
    },
  ]);

  const totalCredit = agg?.total_credit ?? 0;
  const totalDebit = agg?.total_debit ?? 0;

  // customer: credit = receivable (positive), debit = payment received (reduces balance)
  // supplier/both: debit = payable (positive), credit = payment made (reduces balance)
  const balance =
    partyType === "customer"
      ? totalCredit - totalDebit
      : totalDebit - totalCredit;

  await Party.updateOne(
    { _id: partyId },
    { $set: { current_balance: balance } },
  );
  return balance;
}

// ── infer party type from transaction history ──────────────────────────────

async function inferPartyType(adminId, orgId, names) {
  const [agg] = await Transaction.aggregate([
    {
      $match: {
        admin: new mongoose.Types.ObjectId(adminId.toString()),
        ...(orgId
          ? { organization: new mongoose.Types.ObjectId(orgId.toString()) }
          : { organization: { $exists: false } }),
        $or: names.flatMap((n) => [
          { counterparty: { $regex: `^${escapeRegex(n)}$`, $options: "i" } },
          { vendor: { $regex: `^${escapeRegex(n)}$`, $options: "i" } },
        ]),
        is_deleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: null,
        has_credit: {
          $max: { $cond: [{ $eq: ["$type", "credit"] }, 1, 0] },
        },
        has_debit: {
          $max: { $cond: [{ $eq: ["$type", "debit"] }, 1, 0] },
        },
      },
    },
  ]);

  if (!agg) return "both";
  if (agg.has_credit && !agg.has_debit) return "customer";
  if (agg.has_debit && !agg.has_credit) return "supplier";
  return "both";
}

// ── migrate one admin/org scope ───────────────────────────────────────────

async function migrateScope(adminId, orgId, dryRun) {
  const scopeLabel = orgId
    ? `admin=${adminId} org=${orgId}`
    : `admin=${adminId}`;
  console.log(`\n── Migrating scope: ${scopeLabel}`);

  const baseMatch = {
    admin: new mongoose.Types.ObjectId(adminId.toString()),
    ...(orgId
      ? { organization: new mongoose.Types.ObjectId(orgId.toString()) }
      : { organization: { $exists: false } }),
    party: { $exists: false },
    is_deleted: { $ne: true },
    // Exclude transfers — their counterparty is the other account name, not a Person
    transfer_id: { $exists: false },
  };

  // 1. Collect unique names from counterparty and vendor fields
  const [counterpartyValues, vendorValues] = await Promise.all([
    Transaction.distinct("counterparty", {
      ...baseMatch,
      counterparty: { $exists: true, $nin: [null, ""] },
    }),
    Transaction.distinct("vendor", {
      ...baseMatch,
      vendor: { $exists: true, $nin: [null, ""] },
    }),
  ]);

  // Merge and deduplicate (case-insensitive key → canonical name)
  const nameMap = new Map(); // lowercase key → first encountered canonical spelling
  for (const name of [...counterpartyValues, ...vendorValues]) {
    if (!name || !String(name).trim()) continue;
    const canonical = String(name).trim();
    const key = canonical.toLowerCase();
    if (!nameMap.has(key)) nameMap.set(key, canonical);
  }

  if (nameMap.size === 0) {
    console.log("  No unmigrated counterparty/vendor strings found. Skipping.");
    return;
  }

  console.log(`  Found ${nameMap.size} unique name(s) to migrate.`);

  let created = 0;
  let reused = 0;
  let txnUpdated = 0;
  const affectedPartyIds = [];

  for (const [key, canonical] of nameMap) {
    // 2. Find or create the Party
    let party = await Party.findOne({
      admin: new mongoose.Types.ObjectId(adminId.toString()),
      ...(orgId
        ? { organization: new mongoose.Types.ObjectId(orgId.toString()) }
        : { organization: { $exists: false } }),
      name: { $regex: `^${escapeRegex(canonical)}$`, $options: "i" },
    }).lean();

    if (!party) {
      // Infer type from transaction mix
      const partyType = await inferPartyType(adminId, orgId, [canonical]);
      console.log(`  Creating party: "${canonical}" (type=${partyType})`);

      if (!dryRun) {
        party = await Party.create({
          admin: new mongoose.Types.ObjectId(adminId.toString()),
          ...(orgId
            ? { organization: new mongoose.Types.ObjectId(orgId.toString()) }
            : {}),
          name: canonical,
          type: partyType,
          current_balance: 0,
        });
      } else {
        console.log(
          `  [DRY-RUN] Would create party "${canonical}" (${partyType})`,
        );
        party = { _id: "DRY_RUN_ID", name: canonical, type: partyType };
      }
      created++;
    } else {
      console.log(`  Reusing existing party: "${party.name}" (${party._id})`);
      reused++;
    }

    if (!dryRun) {
      // 3. Update all transactions: set party ref, unset string fields
      const matchFilter = {
        admin: new mongoose.Types.ObjectId(adminId.toString()),
        ...(orgId
          ? { organization: new mongoose.Types.ObjectId(orgId.toString()) }
          : { organization: { $exists: false } }),
        party: { $exists: false },
        transfer_id: { $exists: false },
        is_deleted: { $ne: true },
        $or: [
          {
            counterparty: {
              $regex: `^${escapeRegex(canonical)}$`,
              $options: "i",
            },
          },
          { vendor: { $regex: `^${escapeRegex(canonical)}$`, $options: "i" } },
        ],
      };

      const result = await Transaction.updateMany(matchFilter, {
        $set: { party: party._id },
        $unset: { counterparty: "", vendor: "" },
      });

      txnUpdated += result.modifiedCount;
      if (result.modifiedCount > 0) {
        affectedPartyIds.push(party._id);
        console.log(
          `  Linked ${result.modifiedCount} transaction(s) → party "${party.name}"`,
        );
      }
    } else {
      // Count in dry-run
      const count = await Transaction.countDocuments({
        admin: new mongoose.Types.ObjectId(adminId.toString()),
        party: { $exists: false },
        transfer_id: { $exists: false },
        $or: [
          {
            counterparty: {
              $regex: `^${escapeRegex(canonical)}$`,
              $options: "i",
            },
          },
          { vendor: { $regex: `^${escapeRegex(canonical)}$`, $options: "i" } },
        ],
      });
      console.log(
        `  [DRY-RUN] Would link ${count} transaction(s) → party "${canonical}"`,
      );
    }
  }

  // 4. Recalculate current_balance for all affected parties
  if (!dryRun && affectedPartyIds.length > 0) {
    console.log(
      `\n  Recalculating balances for ${affectedPartyIds.length} party(ies)...`,
    );
    for (const partyId of affectedPartyIds) {
      const partyDoc = await Party.findById(partyId).select("type name").lean();
      if (!partyDoc) continue;
      const balance = await recalculatePartyBalance(partyId, partyDoc.type);
      console.log(
        `    "${partyDoc.name}" → current_balance = ${balance.toFixed(2)}`,
      );
    }
  }

  console.log(
    `\n  ✓ Scope done: ${created} party(ies) created, ${reused} reused, ${txnUpdated} transactions updated.`,
  );
}

// ── Phase 2: fix loan transaction party roles ─────────────────────────────
//
// Rules:
//   loan_out (Loan Given / Loan Repayment Paid)
//     party     = adminSelf  (I am the giver / payer)
//     for_party = the OTHER party currently stored in `party` (borrower / lender)
//
//   loan_in (Loan Received / Loan Repayment Received)
//     party     = the OTHER party (lender / borrower) — keep as-is
//     for_party = adminSelf  (I am the receiver)
//
// Idempotent: skips transactions that are already correctly assigned.

async function fixLoanRoles(adminId, orgId, selfPartyId, dryRun) {
  const scopeLabel = orgId
    ? `admin=${adminId} org=${orgId}`
    : `admin=${adminId}`;
  console.log(`\n── Phase 2 (loan roles): ${scopeLabel}`);

  const scopeFilter = {
    admin: new mongoose.Types.ObjectId(adminId.toString()),
    ...(orgId
      ? { organization: new mongoose.Types.ObjectId(orgId.toString()) }
      : { organization: { $exists: false } }),
    is_deleted: { $ne: true },
    transfer_id: { $exists: false },
  };

  // Collect all loan category IDs (type loan_in or loan_out)
  const orgCatFilter = orgId
    ? { organization: new mongoose.Types.ObjectId(orgId.toString()) }
    : {
        $or: [
          { organization: { $exists: false } },
          { admin: new mongoose.Types.ObjectId(adminId.toString()) },
        ],
      };

  const loanCats = await Category.find({
    ...orgCatFilter,
    type: { $in: ["loan_in", "loan_out"] },
  })
    .select("_id type name")
    .lean();

  const loanOutIds = loanCats
    .filter((c) => c.type === "loan_out")
    .map((c) => c._id);
  const loanInIds = loanCats
    .filter((c) => c.type === "loan_in")
    .map((c) => c._id);

  if (loanOutIds.length === 0 && loanInIds.length === 0) {
    console.log("  No loan categories found for this scope — skipping.");
    return;
  }

  const selfOid = new mongoose.Types.ObjectId(selfPartyId.toString());
  let loanOutFixed = 0;
  let loanInFixed = 0;

  // ── loan_out: party→for_party, set party=self ──────────────────────────
  // Find loan_out transactions where party != self (still has the borrower as party)
  // These need to be "rotated": for_party=current party, party=self
  if (loanOutIds.length > 0) {
    // Only process if party exists AND party != self AND for_party not yet set
    const loanOutNeedsFix = await Transaction.find({
      ...scopeFilter,
      category_id: { $in: loanOutIds },
      party: { $exists: true, $ne: null, $ne: selfOid },
      for_party: { $exists: false },
    })
      .select("_id party")
      .lean();

    console.log(
      `  loan_out: ${loanOutNeedsFix.length} transaction(s) need party-role fix`,
    );

    if (!dryRun && loanOutNeedsFix.length > 0) {
      // Group by current party value, then bulk update
      const byParty = new Map();
      for (const txn of loanOutNeedsFix) {
        const key = txn.party.toString();
        if (!byParty.has(key)) byParty.set(key, []);
        byParty.get(key).push(txn._id);
      }
      for (const [currentPartyStr, ids] of byParty) {
        const currentPartyOid = new mongoose.Types.ObjectId(currentPartyStr);
        const result = await Transaction.updateMany(
          { _id: { $in: ids } },
          {
            $set: { party: selfOid, for_party: currentPartyOid },
          },
        );
        loanOutFixed += result.modifiedCount;
      }
      console.log(
        `  loan_out: fixed ${loanOutFixed} transaction(s) → party=self, for_party=borrower`,
      );
    } else if (dryRun && loanOutNeedsFix.length > 0) {
      console.log(
        `  [DRY-RUN] Would fix ${loanOutNeedsFix.length} loan_out transaction(s)`,
      );
    }

    // Also fix loan_out where party=self but for_party is still missing
    // (e.g. self was already set in a previous run but for_party wasn't)
    const loanOutMissingForParty = await Transaction.countDocuments({
      ...scopeFilter,
      category_id: { $in: loanOutIds },
      party: selfOid,
      for_party: { $exists: false },
    });
    if (loanOutMissingForParty > 0) {
      console.log(
        `  loan_out: ${loanOutMissingForParty} transaction(s) have party=self but no for_party (cannot auto-assign — please set manually via UI)`,
      );
    }
  }

  // ── loan_in: keep party, set for_party=self ────────────────────────────
  if (loanInIds.length > 0) {
    const loanInNeedsFix = await Transaction.countDocuments({
      ...scopeFilter,
      category_id: { $in: loanInIds },
      party: { $exists: true, $ne: null },
      for_party: { $exists: false },
    });

    console.log(
      `  loan_in: ${loanInNeedsFix} transaction(s) need for_party=self`,
    );

    if (!dryRun && loanInNeedsFix > 0) {
      const result = await Transaction.updateMany(
        {
          ...scopeFilter,
          category_id: { $in: loanInIds },
          party: { $exists: true, $ne: null },
          for_party: { $exists: false },
        },
        { $set: { for_party: selfOid } },
      );
      loanInFixed = result.modifiedCount;
      console.log(
        `  loan_in: fixed ${loanInFixed} transaction(s) → for_party=self`,
      );
    } else if (dryRun && loanInNeedsFix > 0) {
      console.log(
        `  [DRY-RUN] Would fix ${loanInNeedsFix} loan_in transaction(s)`,
      );
    }

    // Also count loan_in with no party at all (data gap — can't auto-fix)
    const loanInNoParty = await Transaction.countDocuments({
      ...scopeFilter,
      category_id: { $in: loanInIds },
      party: { $exists: false },
    });
    if (loanInNoParty > 0) {
      console.log(
        `  loan_in: ${loanInNoParty} transaction(s) have NO party set (cannot auto-assign lender — please set via UI)`,
      );
      if (!dryRun) {
        // At minimum set for_party=self so the ledger works
        const result = await Transaction.updateMany(
          {
            ...scopeFilter,
            category_id: { $in: loanInIds },
            party: { $exists: false },
            for_party: { $exists: false },
          },
          { $set: { for_party: selfOid } },
        );
        if (result.modifiedCount > 0) {
          console.log(
            `  loan_in: set for_party=self on ${result.modifiedCount} no-party transaction(s)`,
          );
        }
      }
    }
  }

  console.log(
    `  ✓ Phase 2 done: ${loanOutFixed} loan_out + ${loanInFixed} loan_in fixed`,
  );
}

// ── find or create the "self" party for an admin/scope ────────────────────

async function findOrCreateSelfParty(
  adminId,
  orgId,
  selfPartyName,
  dryRun,
  createIfMissing,
) {
  const partyFilter = {
    admin: new mongoose.Types.ObjectId(adminId.toString()),
    ...(orgId
      ? { organization: new mongoose.Types.ObjectId(orgId.toString()) }
      : { organization: { $exists: false } }),
    name: { $regex: `^${escapeRegex(selfPartyName)}$`, $options: "i" },
  };

  let party = await Party.findOne(partyFilter).lean();

  if (!party) {
    if (!createIfMissing) {
      // In global mode, don't create self-parties for admins that don't have one
      return null;
    }
    console.log(`  Creating self-party "${selfPartyName}" for scope...`);
    if (!dryRun) {
      party = await Party.create({
        admin: new mongoose.Types.ObjectId(adminId.toString()),
        ...(orgId
          ? { organization: new mongoose.Types.ObjectId(orgId.toString()) }
          : {}),
        name: selfPartyName,
        type: "both",
        current_balance: 0,
      });
      console.log(`  Self-party created: ${party._id}`);
    } else {
      console.log(`  [DRY-RUN] Would create self-party "${selfPartyName}"`);
      return null;
    }
  } else {
    console.log(`  Self-party found: "${party.name}" (${party._id})`);
  }

  return party._id;
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  const { adminId, selfPartyName, dryRun } = parseArgs();

  if (dryRun) {
    console.log("=== DRY-RUN mode — no changes will be written ===");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");
  console.log(`Self-party name: "${selfPartyName}"`);

  const { OrganizationMember } =
    await import("../models/OrganizationMember.js");

  const admins = adminId
    ? [await Admin.findById(adminId).select("_id name").lean()]
    : await Admin.find({}).select("_id name").lean();

  console.log(`Found ${admins.length} admin(s) to process.`);

  for (const admin of admins) {
    const aid = admin._id.toString();
    // When --admin-id is given we create the self-party if missing;
    // in global mode we only fix admins where it already exists.
    const createIfMissing = Boolean(adminId);
    console.log(`\n══ Admin: ${admin.name} (${aid})`);

    const memberships = await OrganizationMember.find({
      user: admin._id,
      status: "active",
    }).lean();

    const scopes = [
      { orgId: null },
      ...memberships.map((m) => ({ orgId: m.organization.toString() })),
    ];

    for (const { orgId } of scopes) {
      // ── Phase 1: string → ObjectId ──────────────────────────────────────
      await migrateScope(aid, orgId, dryRun);

      // ── Phase 2: loan roles ─────────────────────────────────────────────
      const selfPartyId = await findOrCreateSelfParty(
        aid,
        orgId,
        selfPartyName,
        dryRun,
        createIfMissing,
      );
      if (selfPartyId) {
        await fixLoanRoles(aid, orgId, selfPartyId, dryRun);
      }
    }
  }

  console.log("\n=== Migration complete ===");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  mongoose.disconnect().finally(() => process.exit(1));
});
