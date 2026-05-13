/**
 * Migration Script: মসজিদ Loan Chain Restructure
 *
 * What this does:
 *  1. Finds all existing transactions with counterparty = "মসজিদ" (your user)
 *  2. Processes them chronologically using a FIFO queue:
 *     - Each "Loan Received" (credit) → payment_status = "due", due_remaining = amount,
 *       due_group_id = own _id
 *     - Each "Loan Repayment Paid" (debit) → links to oldest unpaid due transaction
 *       via parent_due_id, reduces that due's due_remaining
 *  3. Bulk repayments are split across multiple dues (oldest first)
 *  4. Saves all updates atomically
 *
 * Usage:
 *   MONGODB_URI=mongodb://... ADMIN_EMAIL=you@example.com node scripts/migrate-masjid-loans.js
 *
 *   Or with .env:
 *   node --env-file=.env scripts/migrate-masjid-loans.js   (Node 20+)
 *   OR: npm install dotenv && node -r dotenv/config scripts/migrate-masjid-loans.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const COUNTERPARTY = "মসজিদ";

// ─── Schema (minimal – only what we need) ────────────────────────────────────
const transactionSchema = new mongoose.Schema({}, { strict: false });
const Transaction = mongoose.model(
  "Transaction",
  transactionSchema,
  "transactions",
);

const adminSchema = new mongoose.Schema({}, { strict: false });
const Admin = mongoose.model("Admin", adminSchema, "admins");

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtTk(n) {
  return "৳" + Number(n).toLocaleString("en");
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!MONGO_URI) {
    console.error("❌  Set MONGODB_URI in your .env file");
    process.exit(1);
  }

  console.log("🔌 Connecting to MongoDB…");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected\n");

  // ── Find admin ──────────────────────────────────────────────────────────────
  const admin = await Admin.findOne({}).lean();
  if (!admin) {
    console.error("❌  No admin found in database");
    process.exit(1);
  }
  console.log(`👤 Admin: ${admin.email || admin._id}\n`);

  // ── Fetch all মসজিদ transactions sorted by date ───────────────────────────
  const txns = await Transaction.find({
    admin: admin._id,
    counterparty: COUNTERPARTY,
    is_deleted: { $ne: true },
  })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  if (txns.length === 0) {
    console.log("ℹ️  No মসজিদ transactions found. Nothing to migrate.");
    await mongoose.disconnect();
    return;
  }

  console.log(`📋 Found ${txns.length} মসজিদ transactions\n`);

  // ── Categorise ───────────────────────────────────────────────────────────────
  // "Loan Received" = credit → we owe মসজিদ → payment_status = "due"
  // "Loan Repayment Paid" = debit → we're paying মসজিদ back → payment against a due
  // Other debits (e.g. Utilities on Jan 27 = also a repayment) → treat as repayment too

  const dues = []; // unsettled due transactions, FIFO
  const updates = []; // {_id, $set patch}
  let stats = { dues: 0, payments: 0, skipped: 0 };

  for (const txn of txns) {
    const isBorrow = txn.type === "credit"; // loan received
    const isRepayment = txn.type === "debit"; // repayment

    if (isBorrow) {
      // Mark as a "due" loan
      const patch = {
        payment_status: "due",
        due_group_id: txn._id.toString(),
        due_remaining: txn.amount,
        due_settled_at: null,
      };
      dues.push({
        _id: txn._id,
        amount: txn.amount,
        remaining: txn.amount,
        date: txn.date,
        desc: txn.description,
      });
      updates.push({ _id: txn._id, patch });
      stats.dues++;
      console.log(
        `  📥 DUE   #${String(stats.dues).padStart(2)} ${txn.date?.toISOString?.()?.slice(0, 10) ?? txn.date} ${fmtTk(txn.amount).padStart(10)}  ${(txn.description || "").substring(0, 50)}`,
      );
    } else if (isRepayment) {
      let repayLeft = txn.amount;
      const linkedDues = [];

      // FIFO: consume oldest dues first
      while (repayLeft > 0 && dues.length > 0) {
        const oldest = dues[0];
        if (oldest.remaining <= 0) {
          dues.shift(); // fully settled, remove
          continue;
        }

        const consume = Math.min(repayLeft, oldest.remaining);
        oldest.remaining -= consume;
        repayLeft -= consume;

        // Build patch for the due transaction
        const dueUpdate = updates.find(
          (u) => u._id.toString() === oldest._id.toString(),
        );
        if (dueUpdate) {
          dueUpdate.patch.due_remaining = oldest.remaining;
          if (oldest.remaining === 0) {
            dueUpdate.patch.due_settled_at = txn.date;
            dueUpdate.patch.payment_status = "due"; // remains "due" category but settled
          }
        }

        linkedDues.push(oldest._id);

        if (oldest.remaining === 0) {
          dues.shift();
        }
      }

      // For the repayment transaction itself: link to the primary (oldest) due
      const primaryDueId = linkedDues[0] ?? null;
      const repayPatch = {
        payment_status: "paid",
        parent_due_id: primaryDueId,
      };
      updates.push({ _id: txn._id, patch: repayPatch });
      stats.payments++;

      const overPay =
        repayLeft > 0 ? ` ⚠️  OVER-PAYMENT by ${fmtTk(repayLeft)}` : "";
      console.log(
        `  💸 REPAY #${String(stats.payments).padStart(2)} ${txn.date?.toISOString?.()?.slice(0, 10) ?? txn.date} ${fmtTk(txn.amount).padStart(10)}  linked to ${linkedDues.length} due(s)${overPay}`,
      );
    } else {
      stats.skipped++;
      console.log(`  ⏭️  SKIP  ${txn._id} type=${txn.type}`);
    }
  }

  // Outstanding dues summary
  const outstanding = dues.filter((d) => d.remaining > 0);
  const totalOwed = outstanding.reduce((s, d) => s + d.remaining, 0);
  console.log(`\n📊 Summary:`);
  console.log(`   Due transactions created : ${stats.dues}`);
  console.log(`   Repayments linked        : ${stats.payments}`);
  console.log(
    `   Outstanding loans        : ${outstanding.length} (total ${fmtTk(totalOwed)} owed)`,
  );

  // ── Confirm before writing ───────────────────────────────────────────────────
  console.log(`\n⚠️  About to write ${updates.length} updates to MongoDB.`);
  console.log("   Press Ctrl+C within 5 seconds to cancel…");
  await new Promise((r) => setTimeout(r, 5000));

  // ── Apply updates in bulk ────────────────────────────────────────────────────
  console.log("\n✍️  Applying updates…");
  let written = 0;

  const bulkOps = updates.map((u) => ({
    updateOne: {
      filter: { _id: u._id },
      update: { $set: u.patch },
    },
  }));

  const result = await Transaction.bulkWrite(bulkOps);
  written = result.modifiedCount;

  console.log(`✅ Done! ${written} transactions updated.\n`);

  // ── Print final state of outstanding loans ────────────────────────────────
  if (outstanding.length > 0) {
    console.log("💰 Outstanding loans still owed to মসজিদ:");
    for (const d of outstanding) {
      console.log(
        `   ${d.date?.toISOString?.()?.slice(0, 10) ?? d.date}  ${fmtTk(d.amount).padStart(10)} borrowed, ${fmtTk(d.remaining).padStart(10)} remaining  — ${(d.desc || "").substring(0, 50)}`,
      );
    }
    console.log(`   TOTAL OWED: ${fmtTk(totalOwed)}`);
  } else {
    console.log("🎉 All loans fully settled!");
  }

  await mongoose.disconnect();
  console.log("\n🔌 Disconnected.");
}

main().catch((err) => {
  console.error("❌  Fatal error:", err);
  mongoose.disconnect();
  process.exit(1);
});
