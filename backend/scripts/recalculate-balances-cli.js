#!/usr/bin/env node

/**
 * Balance Recalculation Script
 *
 * This script recalculates balance_after_transaction for all transactions
 * of a specific admin user in chronological order.
 *
 * Usage:
 *   npm run recalculate-balances -- --admin-id=<ADMIN_ID>
 *   npm run recalculate-balances -- --admin-id=507f1f77bcf86cd799439011
 *
 * Or directly:
 *   node scripts/recalculate-balances-cli.js --admin-id=507f1f77bcf86cd799439011
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", ".env") });

// Import models
const { Schema } = mongoose;

// Define Transaction Schema
const transactionSchema = new Schema(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    account: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["debit", "credit"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    balance_after_transaction: {
      type: Number,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Define Account Schema
const accountSchema = new Schema(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    opening_balance: {
      type: Number,
      default: 0,
    },
    current_balance: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Transaction = mongoose.model(
  "Transaction",
  transactionSchema,
  "transactions"
);
const Account = mongoose.model("Account", accountSchema, "accounts");

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};

  for (const arg of args) {
    if (arg.startsWith("--")) {
      const [key, value] = arg.substring(2).split("=");
      params[key] = value;
    }
  }

  return params;
}

// Validate MongoDB ObjectId
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Main recalculation function
async function recalculateBalances(adminId) {
  console.log("\n🔄 Starting balance recalculation...");
  console.log(`📋 Admin ID: ${adminId}\n`);

  // Get all accounts for this admin
  const accounts = await Account.find({ admin: adminId })
    .select("_id name opening_balance")
    .lean();

  if (accounts.length === 0) {
    console.log("⚠️  No accounts found for this admin");
    return {
      accountsProcessed: 0,
      transactionsUpdated: 0,
    };
  }

  console.log(`📊 Found ${accounts.length} account(s)\n`);

  let totalTransactionsUpdated = 0;

  // Process each account separately
  for (const account of accounts) {
    console.log(`\n📁 Processing account: ${account.name} (${account._id})`);

    // Get all non-deleted transactions for this account, sorted chronologically
    const transactions = await Transaction.find({
      admin: adminId,
      account: account._id,
      is_deleted: { $ne: true },
    })
      .sort({ date: 1, createdAt: 1, _id: 1 })
      .select("_id type amount balance_after_transaction date")
      .lean();

    if (transactions.length === 0) {
      console.log("   ℹ️  No transactions found");
      continue;
    }

    console.log(`   📝 Found ${transactions.length} transaction(s)`);

    // Start with the account's opening balance
    const accountDoc = await Account.findById(account._id);
    let runningBalance = Number(
      accountDoc.opening_balance ?? accountDoc.current_balance ?? 0
    );

    console.log(`   💰 Starting balance: ${runningBalance}`);

    // Recalculate balance for each transaction
    const bulkOps = [];
    let accountTransactionsUpdated = 0;

    for (const txn of transactions) {
      const oldBalance = txn.balance_after_transaction;

      // Apply the transaction to the running balance
      if (txn.type === "credit") {
        runningBalance += Number(txn.amount ?? 0);
      } else {
        runningBalance -= Number(txn.amount ?? 0);
      }

      // Only update if the balance has changed
      if (oldBalance !== runningBalance) {
        bulkOps.push({
          updateOne: {
            filter: { _id: txn._id },
            update: { $set: { balance_after_transaction: runningBalance } },
          },
        });
        accountTransactionsUpdated++;
      }
    }

    // Execute bulk updates if there are any
    if (bulkOps.length > 0) {
      await Transaction.bulkWrite(bulkOps);
      totalTransactionsUpdated += accountTransactionsUpdated;
      console.log(`   ✅ Updated ${accountTransactionsUpdated} transaction(s)`);
    } else {
      console.log("   ✓  All transactions already have correct balances");
    }

    // Update account's current balance
    accountDoc.current_balance = runningBalance;
    await accountDoc.save();
    console.log(`   💰 Final balance: ${runningBalance}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Balance recalculation completed successfully!");
  console.log("=".repeat(60));
  console.log("📊 Summary:");
  console.log(`   - Accounts Processed: ${accounts.length}`);
  console.log(`   - Transactions Updated: ${totalTransactionsUpdated}`);
  console.log("=".repeat(60) + "\n");

  return {
    accountsProcessed: accounts.length,
    transactionsUpdated: totalTransactionsUpdated,
  };
}

// Main execution
async function main() {
  try {
    const params = parseArgs();

    // Validate admin ID parameter
    if (!params["admin-id"]) {
      console.error("\n❌ Error: Missing required parameter --admin-id");
      console.log("\nUsage:");
      console.log("  npm run recalculate-balances -- --admin-id=<ADMIN_ID>");
      console.log("\nExample:");
      console.log(
        "  npm run recalculate-balances -- --admin-id=507f1f77bcf86cd799439011"
      );
      console.log("");
      process.exit(1);
    }

    const adminId = params["admin-id"];

    // Validate ObjectId format
    if (!isValidObjectId(adminId)) {
      console.error("\n❌ Error: Invalid admin ID format");
      console.error(`   Provided: ${adminId}`);
      console.error(
        "   Admin ID must be a valid MongoDB ObjectId (24 hex characters)"
      );
      console.log("");
      process.exit(1);
    }

    // Check if MongoDB URI is configured
    if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
      console.error("\n❌ Error: MongoDB connection string not found");
      console.error("   Please set MONGODB_URI or MONGO_URI in your .env file");
      console.log("");
      process.exit(1);
    }

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    console.log("\n🔌 Connecting to MongoDB...");

    await mongoose.connect(mongoUri);

    console.log("✅ Connected to MongoDB successfully");

    // Run recalculation
    await recalculateBalances(adminId);

    // Disconnect
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error occurred during recalculation:");
    console.error(error);
    console.log("");

    // Disconnect if connected
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }

    process.exit(1);
  }
}

// Run the script
main();
