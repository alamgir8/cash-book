/**
 * Script to fix OrganizationMember indexes
 * This drops the old unique index and creates new partial indexes
 * Run: node scripts/fix-organization-member-indexes.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, "../.env") });

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cash-book";

async function fixIndexes() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected successfully!");

    const db = mongoose.connection.db;
    const collection = db.collection("organization_members");

    console.log("\n📋 Current indexes:");
    const indexes = await collection.indexes();
    indexes.forEach((index) => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // Drop the problematic unique index
    console.log('\n🗑️  Dropping old "organization_1_user_1" index...');
    try {
      await collection.dropIndex("organization_1_user_1");
      console.log("✅ Old index dropped successfully!");
    } catch (error) {
      if (error.codeName === "IndexNotFound") {
        console.log("⚠️  Index not found (already dropped or doesn't exist)");
      } else {
        throw error;
      }
    }

    // Create new partial indexes
    console.log("\n🔧 Creating new partial indexes...");

    // 1. Unique index for active members (user is not null)
    console.log("  Creating index for active members...");
    await collection.createIndex(
      { organization: 1, user: 1 },
      {
        name: "organization_1_user_1_active",
        unique: true,
        partialFilterExpression: { user: { $type: "objectId" } },
      }
    );
    console.log("  ✅ Active members index created");

    // 2. Unique index for pending email invitations
    console.log("  Creating index for pending email invitations...");
    await collection.createIndex(
      { organization: 1, pending_email: 1 },
      {
        name: "organization_1_pending_email_1",
        unique: true,
        partialFilterExpression: {
          pending_email: { $exists: true },
        },
      }
    );
    console.log("  ✅ Pending email index created");

    // 3. Unique index for pending phone invitations
    console.log("  Creating index for pending phone invitations...");
    await collection.createIndex(
      { organization: 1, pending_phone: 1 },
      {
        name: "organization_1_pending_phone_1",
        unique: true,
        partialFilterExpression: {
          pending_phone: { $exists: true },
        },
      }
    );
    console.log("  ✅ Pending phone index created");

    // 4. Keep the user_1_status_1 index
    console.log("  Creating user status index...");
    await collection.createIndex(
      { user: 1, status: 1 },
      {
        name: "user_1_status_1",
      }
    );
    console.log("  ✅ User status index created");

    console.log("\n📋 New indexes:");
    const newIndexes = await collection.indexes();
    newIndexes.forEach((index) => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
      if (index.partialFilterExpression) {
        console.log(
          `    Partial filter:`,
          JSON.stringify(index.partialFilterExpression)
        );
      }
    });

    console.log("\n✅ Index migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

fixIndexes();
