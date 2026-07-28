#!/usr/bin/env node
/**
 * link-counterparty-to-for-party.js
 *
 * For a specific admin (default phone 01957930032):
 *  1) Resolve leftover static counterparty/vendor strings → Party docs
 *  2) Set party = self ("আলমগীর") and for_party = that person when for_party is missing
 *  3) Recalculate party balances from party OR for_party links
 *
 * Never deletes transactions. Skips transfers (counterparty is often the other account).
 *
 * Usage:
 *   node scripts/link-counterparty-to-for-party.js --dry-run
 *   node scripts/link-counterparty-to-for-party.js
 *   node scripts/link-counterparty-to-for-party.js --phone=01957930032 --self-party-name=আলমগীর
 */

import "dotenv/config";
import mongoose from "mongoose";
import { Admin } from "../models/Admin.js";
import { Party } from "../models/Party.js";
import { Transaction } from "../models/Transaction.js";
import { OrganizationMember } from "../models/OrganizationMember.js";

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseArgs = () => {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, value] = arg.replace(/^--/, "").split("=");
      return [key, value ?? true];
    }),
  );
  return {
    phone: args.phone ?? "01957930032",
    selfPartyName: args["self-party-name"] ?? "আলমগীর",
    dryRun: Boolean(args["dry-run"]),
  };
};

async function findOrCreateSelfParty(adminId, orgId, name, dryRun) {
  const filter = {
    admin: adminId,
    name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    ...(orgId
      ? { organization: orgId }
      : {
          $or: [{ organization: null }, { organization: { $exists: false } }],
        }),
  };

  let party = await Party.findOne(filter).lean();
  if (party) return party;

  console.log(
    `  Creating self-party "${name}" (${orgId ? `org=${orgId}` : "personal"})`,
  );
  if (dryRun) {
    return { _id: null, name, __dry: true };
  }

  party = await Party.create({
    admin: adminId,
    ...(orgId ? { organization: orgId } : {}),
    name,
    type: "both",
    current_balance: 0,
  });
  return party.toObject ? party.toObject() : party;
}

async function findOrCreateNamedParty(adminId, orgId, name, dryRun) {
  const trimmed = String(name).trim();
  if (!trimmed) return null;

  const filter = {
    admin: adminId,
    name: { $regex: `^${escapeRegex(trimmed)}$`, $options: "i" },
    ...(orgId
      ? { organization: orgId }
      : {
          $or: [{ organization: null }, { organization: { $exists: false } }],
        }),
  };

  let party = await Party.findOne(filter).lean();
  if (party) return { party, created: false };

  if (dryRun) {
    return {
      party: { _id: null, name: trimmed, __dry: true },
      created: true,
    };
  }

  party = await Party.create({
    admin: adminId,
    ...(orgId ? { organization: orgId } : {}),
    name: trimmed,
    type: "both",
    current_balance: 0,
  });
  return {
    party: party.toObject ? party.toObject() : party,
    created: true,
  };
}

async function inferPartyType(adminId, names) {
  const [agg] = await Transaction.aggregate([
    {
      $match: {
        admin: adminId,
        is_deleted: { $ne: true },
        transfer_id: { $exists: false },
        $or: names.flatMap((n) => [
          { counterparty: { $regex: `^${escapeRegex(n)}$`, $options: "i" } },
          { vendor: { $regex: `^${escapeRegex(n)}$`, $options: "i" } },
        ]),
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

async function recalculatePartyBalance(partyId) {
  const party = await Party.findById(partyId).lean();
  if (!party) return;

  const [agg] = await Transaction.aggregate([
    {
      $match: {
        is_deleted: { $ne: true },
        payment_status: { $ne: "due" },
        $or: [{ party: party._id }, { for_party: party._id }],
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
        debit_count: {
          $sum: { $cond: [{ $eq: ["$type", "debit"] }, 1, 0] },
        },
        credit_count: {
          $sum: { $cond: [{ $eq: ["$type", "credit"] }, 1, 0] },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const totalCredit = agg?.total_credit ?? 0;
  const totalDebit = agg?.total_debit ?? 0;
  const balance =
    party.type === "customer"
      ? totalCredit - totalDebit
      : totalDebit - totalCredit;

  await Party.updateOne(
    { _id: party._id },
    {
      $set: {
        current_balance: balance,
        total_transactions: agg?.count ?? 0,
        debit_transactions: agg?.debit_count ?? 0,
        credit_transactions: agg?.credit_count ?? 0,
      },
    },
  );
}

async function migrateStaticStrings(adminId, orgId, selfParty, dryRun, stats) {
  const orgMatch = orgId
    ? { organization: orgId }
    : {
        $or: [{ organization: null }, { organization: { $exists: false } }],
      };

  const base = {
    admin: adminId,
    ...orgMatch,
    is_deleted: { $ne: true },
    transfer_id: { $exists: false },
  };

  // Static text still present, and missing for_party (may or may not have party)
  const withStatic = await Transaction.find({
    ...base,
    $and: [
      {
        $or: [
          { counterparty: { $exists: true, $nin: [null, ""] } },
          { vendor: { $exists: true, $nin: [null, ""] } },
        ],
      },
      { $or: [{ for_party: { $exists: false } }, { for_party: null }] },
    ],
  })
    .select("_id counterparty vendor party")
    .lean();

  if (withStatic.length === 0) {
    console.log("  No static counterparty/vendor left to link.");
    return;
  }

  console.log(`  Static-string txs missing for_party: ${withStatic.length}`);

  const byName = new Map();
  for (const txn of withStatic) {
    const raw = (txn.counterparty || txn.vendor || "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!byName.has(key)) byName.set(key, { name: raw, ids: [] });
    byName.get(key).ids.push(txn._id);
  }

  for (const { name, ids } of byName.values()) {
    let resolved = await findOrCreateNamedParty(adminId, orgId, name, dryRun);
    if (!resolved) continue;

    if (resolved.created && !dryRun) {
      const type = await inferPartyType(adminId, [name]);
      await Party.updateOne({ _id: resolved.party._id }, { $set: { type } });
      resolved.party.type = type;
      stats.partiesCreated++;
      console.log(`  + party "${name}" (${type})`);
    } else if (resolved.created && dryRun) {
      stats.partiesCreated++;
      console.log(`  [DRY-RUN] Would create party "${name}"`);
    } else {
      stats.partiesReused++;
    }

    if (selfParty.__dry || resolved.party.__dry) {
      stats.staticLinked += ids.length;
      console.log(
        `  [DRY-RUN] Would link ${ids.length} txn(s) → for_party="${name}", party=self`,
      );
      continue;
    }

    const result = await Transaction.updateMany(
      {
        _id: { $in: ids },
        $or: [{ for_party: { $exists: false } }, { for_party: null }],
      },
      {
        $set: {
          for_party: resolved.party._id,
          party: selfParty._id,
          // keep human-readable label (safe, non-destructive)
          counterparty: name,
        },
      },
    );
    stats.staticLinked += result.modifiedCount;
    stats.affectedPartyIds.add(String(resolved.party._id));
    stats.affectedPartyIds.add(String(selfParty._id));
    console.log(
      `  Linked ${result.modifiedCount} txn(s) → for_party="${name}", party="${selfParty.name}"`,
    );
  }
}

async function rotatePartyToForParty(adminId, orgId, selfParty, dryRun, stats) {
  if (selfParty.__dry || !selfParty._id) {
    console.log("  [DRY-RUN] Skipping rotation (self party not persisted).");
    return;
  }

  const orgMatch = orgId
    ? { organization: orgId }
    : {
        $or: [{ organization: null }, { organization: { $exists: false } }],
      };

  const needsRotate = await Transaction.find({
    admin: adminId,
    ...orgMatch,
    is_deleted: { $ne: true },
    transfer_id: { $exists: false },
    party: { $exists: true, $ne: null, $ne: selfParty._id },
    $or: [{ for_party: { $exists: false } }, { for_party: null }],
  })
    .select("_id party")
    .populate("party", "name")
    .lean();

  console.log(
    `  party→for_party rotations needed: ${needsRotate.length} (party ≠ ${selfParty.name})`,
  );

  if (needsRotate.length === 0) return;

  const byParty = new Map();
  for (const txn of needsRotate) {
    const key = String(txn.party._id || txn.party);
    if (!byParty.has(key)) {
      byParty.set(key, {
        partyId: txn.party._id || txn.party,
        name: txn.party?.name || "",
        ids: [],
      });
    }
    byParty.get(key).ids.push(txn._id);
  }

  for (const { partyId, name, ids } of byParty.values()) {
    if (dryRun) {
      stats.rotated += ids.length;
      console.log(
        `  [DRY-RUN] Would rotate ${ids.length} txn(s): party="${name}" → for_party, party=self`,
      );
      continue;
    }

    const result = await Transaction.updateMany(
      {
        _id: { $in: ids },
        $or: [{ for_party: { $exists: false } }, { for_party: null }],
      },
      {
        $set: {
          for_party: partyId,
          party: selfParty._id,
          ...(name ? { counterparty: name } : {}),
        },
      },
    );
    stats.rotated += result.modifiedCount;
    stats.affectedPartyIds.add(String(partyId));
    stats.affectedPartyIds.add(String(selfParty._id));
    console.log(
      `  Rotated ${result.modifiedCount}: for_party="${name}", party="${selfParty.name}"`,
    );
  }
}

async function linkOrphanTxns(adminId, orgId, selfParty, dryRun, stats) {
  const orgMatch = orgId
    ? { organization: orgId }
    : {
        $or: [{ organization: null }, { organization: { $exists: false } }],
      };

  const orphans = await Transaction.find({
    admin: adminId,
    ...orgMatch,
    is_deleted: { $ne: true },
    transfer_id: { $exists: false },
    $and: [
      { $or: [{ party: { $exists: false } }, { party: null }] },
      { $or: [{ for_party: { $exists: false } }, { for_party: null }] },
    ],
  })
    .select("_id description keyword counterparty vendor")
    .lean();

  if (orphans.length === 0) return;

  console.log(`  Orphans (no party/for_party): ${orphans.length}`);

  // Known description → party name hints (safe, explicit only)
  const descriptionHints = [
    { test: /hadi\s*mama/i, name: "হাদি মামা" },
  ];

  for (const txn of orphans) {
    let name = (txn.counterparty || txn.vendor || "").trim();
    if (!name) {
      const hint = descriptionHints.find((h) =>
        h.test.test(txn.description || ""),
      );
      if (hint) name = hint.name;
    }

    if (!name) {
      console.log(
        `  ! orphan ${txn._id} has no counterparty/vendor — skipped (desc="${(txn.description || "").slice(0, 40)}")`,
      );
      stats.orphansSkipped++;
      continue;
    }

    const resolved = await findOrCreateNamedParty(adminId, orgId, name, dryRun);
    if (!resolved || resolved.party.__dry || selfParty.__dry) {
      stats.orphansLinked++;
      console.log(`  [DRY-RUN] Would link orphan ${txn._id} → "${name}"`);
      continue;
    }
    if (resolved.created) stats.partiesCreated++;
    else stats.partiesReused++;

    await Transaction.updateOne(
      { _id: txn._id },
      {
        $set: {
          for_party: resolved.party._id,
          party: selfParty._id,
          counterparty: name,
        },
      },
    );
    stats.orphansLinked++;
    stats.affectedPartyIds.add(String(resolved.party._id));
    stats.affectedPartyIds.add(String(selfParty._id));
    console.log(`  Linked orphan ${txn._id} → for_party="${name}"`);
  }
}

async function main() {
  const { phone, selfPartyName, dryRun } = parseArgs();
  if (dryRun) console.log("=== DRY-RUN — no writes ===");

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected");

  const phoneVariants = [
    phone,
    phone.replace(/^0/, ""),
    `+88${phone.replace(/^0/, "")}`,
    `88${phone.replace(/^0/, "")}`,
  ];

  const admin = await Admin.findOne({
    $or: phoneVariants.map((p) => ({ phone: p })),
  })
    .select("_id name phone")
    .lean();

  if (!admin) {
    console.error(`Admin not found for phone ${phone}`);
    process.exit(1);
  }

  console.log(`Admin: ${admin.name} (${admin._id}) phone=${admin.phone}`);
  console.log(`Self party name: "${selfPartyName}"`);

  // Snapshot counts before
  const before = {
    total: await Transaction.countDocuments({
      admin: admin._id,
      is_deleted: { $ne: true },
    }),
    withParty: await Transaction.countDocuments({
      admin: admin._id,
      is_deleted: { $ne: true },
      party: { $exists: true, $ne: null },
    }),
    withForParty: await Transaction.countDocuments({
      admin: admin._id,
      is_deleted: { $ne: true },
      for_party: { $exists: true, $ne: null },
    }),
  };
  console.log("Before:", before);

  const memberships = await OrganizationMember.find({
    user: admin._id,
    status: "active",
  })
    .select("organization")
    .lean();

  const scopes = [
    { orgId: null },
    ...memberships.map((m) => ({ orgId: m.organization })),
  ];

  const stats = {
    partiesCreated: 0,
    partiesReused: 0,
    staticLinked: 0,
    rotated: 0,
    orphansLinked: 0,
    orphansSkipped: 0,
    affectedPartyIds: new Set(),
  };

  for (const { orgId } of scopes) {
    const label = orgId ? `org=${orgId}` : "personal";
    console.log(`\n── Scope: ${label}`);

    const selfParty = await findOrCreateSelfParty(
      admin._id,
      orgId,
      selfPartyName,
      dryRun,
    );
    if (selfParty?._id) {
      console.log(`  Self: "${selfParty.name}" (${selfParty._id})`);
      stats.affectedPartyIds.add(String(selfParty._id));
    }

    await migrateStaticStrings(admin._id, orgId, selfParty, dryRun, stats);
    await rotatePartyToForParty(admin._id, orgId, selfParty, dryRun, stats);
    await linkOrphanTxns(admin._id, orgId, selfParty, dryRun, stats);
  }

  if (!dryRun && stats.affectedPartyIds.size > 0) {
    console.log(
      `\nRecalculating balances for ${stats.affectedPartyIds.size} parties...`,
    );
    for (const id of stats.affectedPartyIds) {
      await recalculatePartyBalance(id);
    }
  }

  const after = {
    total: await Transaction.countDocuments({
      admin: admin._id,
      is_deleted: { $ne: true },
    }),
    withParty: await Transaction.countDocuments({
      admin: admin._id,
      is_deleted: { $ne: true },
      party: { $exists: true, $ne: null },
    }),
    withForParty: await Transaction.countDocuments({
      admin: admin._id,
      is_deleted: { $ne: true },
      for_party: { $exists: true, $ne: null },
    }),
  };

  console.log("\n=== Summary ===");
  console.log(stats);
  console.log("After:", after);
  if (before.total !== after.total) {
    console.error("ERROR: transaction count changed — aborting integrity check failed");
    process.exit(1);
  }
  console.log("Integrity OK: transaction count unchanged.");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
