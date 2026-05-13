/**
 * Migration Script: Loan Ledger — All Counterparties
 *
 * Only these 4 categories are processed (all others are ignored):
 *
 *  Category                   | _id                       | type   | Meaning
 *  ───────────────────────────┼───────────────────────────┼────────┼─────────────────────────────────────
 *  Loan Received              | 68ee3f3d4876f0bdaa3661cf  | credit | I took a loan FROM the counterparty
 *  Loan Repayment Paid        | 68ee3f3d4876f0bdaa3661dc  | debit  | I returned/paid back TO the counterparty
 *  Loan Given                 | 68ee3f3d4876f0bdaa3661db  | debit  | I gave a loan TO the counterparty
 *  Loan Repayment Received    | 68ee3f3d4876f0bdaa3661d0  | credit | The counterparty returned/paid back TO me
 *
 * For each counterparty, two independent FIFO queues run:
 *
 *  owedByMe    queue  →  Loan Received dues, consumed by Loan Repayment Paid
 *  owedByThem  queue  →  Loan Given    dues, consumed by Loan Repayment Received
 *
 * Fields set on transactions:
 *  - payment_status   : "due" | "paid"
 *  - due_group_id     : (on due txns) own _id as string
 *  - due_remaining    : (on due txns) how much is still unpaid
 *  - due_settled_at   : (on due txns) date it was fully settled, or null
 *  - parent_due_id    : (on payment txns) ObjectId of the oldest due it covers
 *
 * Usage:
 *   node --env-file=.env scripts/migrate-masjid-loans.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// ─── The 4 loan category IDs ─────────────────────────────────────────────────
const CAT = {
  LOAN_RECEIVED: "68ee3f3d4876f0bdaa3661cf", // credit → I owe counterparty
  LOAN_REPAYMENT_PAID: "68ee3f3d4876f0bdaa3661dc", // debit  → I pay counterparty back
  LOAN_GIVEN: "68ee3f3d4876f0bdaa3661db", // debit  → counterparty owes me
  LOAN_REPAYMENT_RECEIVED: "68ee3f3d4876f0bdaa3661d0", // credit → counterparty pays me back
};

// ─── Schemas ─────────────────────────────────────────────────────────────────
const Transaction = mongoose.model(
  "Transaction",
  new mongoose.Schema({}, { strict: false }),
  "transactions",
);
const Admin = mongoose.model(
  "Admin",
  new mongoose.Schema({}, { strict: false }),
  "admins",
);

function fmtTk(n) {
  return "৳" + Number(n).toLocaleString("en");
}
function shortDate(d) {
  return d?.toISOString?.()?.slice(0, 10) ?? String(d);
}
function catId(txn) {
  return txn.category_id?.toString?.() ?? String(txn.category_id ?? "");
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!MONGO_URI) {
    console.error("❌  Set MONGODB_URI in your .env file");
    process.exit(1);
  }

  console.log("🔌 Connecting to MongoDB…");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected\n");

  const admin = await Admin.findOne({}).lean();
  if (!admin) {
    console.error("❌  No admin found");
    process.exit(1);
  }
  console.log(`👤 Admin: ${admin.email || admin._id}\n`);

  // ── Fetch ALL transactions matching the 4 loan categories ────────────────
  const categoryIds = Object.values(CAT).map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  const txns = await Transaction.find({
    admin: admin._id,
    category_id: { $in: categoryIds },
    is_deleted: { $ne: true },
  })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  if (txns.length === 0) {
    console.log("ℹ️  No loan transactions found. Nothing to migrate.");
    await mongoose.disconnect();
    return;
  }

  console.log(
    `📋 Found ${txns.length} loan transactions across all counterparties\n`,
  );

  // ── Group by counterparty ─────────────────────────────────────────────────
  const byCounterparty = new Map();
  for (const txn of txns) {
    const cp = txn.counterparty || "(no counterparty)";
    if (!byCounterparty.has(cp)) byCounterparty.set(cp, []);
    byCounterparty.get(cp).push(txn);
  }

  console.log(`🗂️  Counterparties with loan activity: ${byCounterparty.size}`);
  for (const [cp, list] of byCounterparty) {
    console.log(`   • ${cp} (${list.length} txns)`);
  }
  console.log();

  // ── Process each counterparty ─────────────────────────────────────────────
  const allUpdates = [];
  const globalStats = { dueOwedByMe: 0, dueOwedByThem: 0, payments: 0 };

  for (const [cp, list] of byCounterparty) {
    console.log(`\n────────────────────────────────────────────────────`);
    console.log(`👤 Counterparty: ${cp} (${list.length} transactions)`);
    console.log(`────────────────────────────────────────────────────`);

    // Two independent FIFO queues
    const owedByMe = []; // seeded by Loan Received,  consumed by Loan Repayment Paid
    const owedByThem = []; // seeded by Loan Given,     consumed by Loan Repayment Received

    const localUpdates = [];
    const localStats = { dueOwedByMe: 0, dueOwedByThem: 0, payments: 0 };

    for (const txn of list) {
      const cid = catId(txn);

      // ── Loan Received → I owe the counterparty ───────────────────────────
      if (cid === CAT.LOAN_RECEIVED) {
        const ref = {
          _id: txn._id,
          patch: {
            payment_status: "due",
            due_group_id: txn._id.toString(),
            due_remaining: txn.amount,
            due_settled_at: null,
          },
        };
        owedByMe.push({
          _id: txn._id,
          amount: txn.amount,
          remaining: txn.amount,
          date: txn.date,
          desc: txn.description,
          ref,
        });
        localUpdates.push(ref);
        localStats.dueOwedByMe++;
        console.log(
          `  📥 LOAN RECEIVED   ${shortDate(txn.date)} ${fmtTk(txn.amount).padStart(12)}  "${(txn.description || "").substring(0, 50)}"`,
        );

        // ── Loan Repayment Paid → I pay back the counterparty ────────────────
      } else if (cid === CAT.LOAN_REPAYMENT_PAID) {
        let repayLeft = txn.amount;
        const linkedDues = [];

        while (repayLeft > 0 && owedByMe.length > 0) {
          const oldest = owedByMe[0];
          if (oldest.remaining <= 0) {
            owedByMe.shift();
            continue;
          }
          const consume = Math.min(repayLeft, oldest.remaining);
          oldest.remaining -= consume;
          repayLeft -= consume;
          oldest.ref.patch.due_remaining = oldest.remaining;
          if (oldest.remaining === 0) {
            oldest.ref.patch.due_settled_at = txn.date;
            owedByMe.shift();
          }
          linkedDues.push(oldest._id);
        }

        const overPay =
          repayLeft > 0 ? ` ⚠️  OVER-PAYMENT by ${fmtTk(repayLeft)}` : "";
        localUpdates.push({
          _id: txn._id,
          patch: {
            payment_status: "paid",
            parent_due_id: linkedDues[0] ?? null,
          },
        });
        localStats.payments++;
        console.log(
          `  💸 REPAYMENT PAID  ${shortDate(txn.date)} ${fmtTk(txn.amount).padStart(12)}  → linked to ${linkedDues.length} due(s)${overPay}`,
        );

        // ── Loan Given → counterparty owes me ────────────────────────────────
      } else if (cid === CAT.LOAN_GIVEN) {
        const ref = {
          _id: txn._id,
          patch: {
            payment_status: "due",
            due_group_id: txn._id.toString(),
            due_remaining: txn.amount,
            due_settled_at: null,
          },
        };
        owedByThem.push({
          _id: txn._id,
          amount: txn.amount,
          remaining: txn.amount,
          date: txn.date,
          desc: txn.description,
          ref,
        });
        localUpdates.push(ref);
        localStats.dueOwedByThem++;
        console.log(
          `  🤝 LOAN GIVEN      ${shortDate(txn.date)} ${fmtTk(txn.amount).padStart(12)}  "${(txn.description || "").substring(0, 50)}"`,
        );

        // ── Loan Repayment Received → counterparty pays me back ──────────────
      } else if (cid === CAT.LOAN_REPAYMENT_RECEIVED) {
        let repayLeft = txn.amount;
        const linkedDues = [];

        while (repayLeft > 0 && owedByThem.length > 0) {
          const oldest = owedByThem[0];
          if (oldest.remaining <= 0) {
            owedByThem.shift();
            continue;
          }
          const consume = Math.min(repayLeft, oldest.remaining);
          oldest.remaining -= consume;
          repayLeft -= consume;
          oldest.ref.patch.due_remaining = oldest.remaining;
          if (oldest.remaining === 0) {
            oldest.ref.patch.due_settled_at = txn.date;
            owedByThem.shift();
          }
          linkedDues.push(oldest._id);
        }

        const overPay =
          repayLeft > 0 ? ` ⚠️  OVER-PAYMENT by ${fmtTk(repayLeft)}` : "";
        localUpdates.push({
          _id: txn._id,
          patch: {
            payment_status: "paid",
            parent_due_id: linkedDues[0] ?? null,
          },
        });
        localStats.payments++;
        console.log(
          `  💰 REPAYMENT RECV  ${shortDate(txn.date)} ${fmtTk(txn.amount).padStart(12)}  → linked to ${linkedDues.length} due(s)${overPay}`,
        );
      }
    }

    // Per-counterparty summary
    const outMe = owedByMe.filter((d) => d.remaining > 0);
    const outThem = owedByThem.filter((d) => d.remaining > 0);
    const totalMe = outMe.reduce((s, d) => s + d.remaining, 0);
    const totalThem = outThem.reduce((s, d) => s + d.remaining, 0);

    console.log(`\n  📊 ${cp} summary:`);
    console.log(`     Loan Received dues  : ${localStats.dueOwedByMe}`);
    console.log(`     Loan Given dues     : ${localStats.dueOwedByThem}`);
    console.log(`     Payments linked     : ${localStats.payments}`);
    if (totalMe > 0) console.log(`     I still owe ${cp}  : ${fmtTk(totalMe)}`);
    if (totalThem > 0)
      console.log(`     ${cp} still owes me: ${fmtTk(totalThem)}`);
    if (totalMe === 0 && totalThem === 0) console.log(`     ✅ Fully settled`);

    allUpdates.push(...localUpdates);
    globalStats.dueOwedByMe += localStats.dueOwedByMe;
    globalStats.dueOwedByThem += localStats.dueOwedByThem;
    globalStats.payments += localStats.payments;
  }

  // ── Global summary ────────────────────────────────────────────────────────
  console.log(`\n\n════════════════════════════════════════════════════`);
  console.log(`📊 GLOBAL SUMMARY`);
  console.log(`════════════════════════════════════════════════════`);
  console.log(`   Counterparties processed  : ${byCounterparty.size}`);
  console.log(`   "Loan Received" dues      : ${globalStats.dueOwedByMe}`);
  console.log(`   "Loan Given" dues         : ${globalStats.dueOwedByThem}`);
  console.log(`   Payments linked           : ${globalStats.payments}`);
  console.log(`   Total DB updates          : ${allUpdates.length}`);

  if (allUpdates.length === 0) {
    console.log("\nℹ️  Nothing to write.");
    await mongoose.disconnect();
    return;
  }

  console.log(`\n⚠️  About to write ${allUpdates.length} updates to MongoDB.`);
  console.log("   Press Ctrl+C within 5 seconds to cancel…");
  await new Promise((r) => setTimeout(r, 5000));

  console.log("\n✍️  Applying updates…");
  const bulkOps = allUpdates.map((u) => ({
    updateOne: { filter: { _id: u._id }, update: { $set: u.patch } },
  }));

  const result = await Transaction.bulkWrite(bulkOps);
  console.log(`✅ Done! ${result.modifiedCount} transactions updated.\n`);

  await mongoose.disconnect();
  console.log("🔌 Disconnected.");
}

main().catch((err) => {
  console.error("❌  Fatal error:", err);
  mongoose.disconnect();
  process.exit(1);
});
