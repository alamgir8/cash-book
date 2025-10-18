# Quick Start: Balance Recalculation Script

## Step-by-Step Guide

### Step 1: Find Your Admin ID

#### Option A: Using MongoDB Compass

1. Open MongoDB Compass
2. Connect to your database
3. Navigate to the `admins` collection
4. Find your user and copy the `_id` field
5. It will look like: `507f1f77bcf86cd799439011`

#### Option B: Using API/Browser Console

1. Log in to your application
2. Open Developer Tools (F12)
3. Go to Console tab
4. Run: `localStorage.getItem('user')` or check your auth token payload
5. Copy the admin ID from the response

#### Option C: Using MongoDB Shell

```bash
mongosh "your-mongodb-connection-string"
use your-database-name
db.admins.find({}, { _id: 1, email: 1, name: 1 }).pretty()
```

Copy the `_id` value for your admin user.

---

### Step 2: Open Terminal in Backend Directory

```bash
cd /path/to/your/project/backend
```

Or in your IDE, open a terminal in the backend folder.

---

### Step 3: Run the Script

```bash
npm run recalculate-balances -- --admin-id=YOUR_ADMIN_ID_HERE
```

**Example:**
```bash
npm run recalculate-balances -- --admin-id=507f1f77bcf86cd799439011
```

**Important:** Don't forget the `--` before `--admin-id`!

---

### Step 4: Wait for Completion

The script will show progress like:

```
🔄 Starting balance recalculation...
📋 Admin ID: 507f1f77bcf86cd799439011

🔌 Connecting to MongoDB...
✅ Connected to MongoDB successfully

📊 Found 3 account(s)

📁 Processing account: Main Account (60f1234...)
   📝 Found 45 transaction(s)
   💰 Starting balance: 1000
   ✅ Updated 12 transaction(s)
   💰 Final balance: 3450

...

✅ Balance recalculation completed successfully!
📊 Summary:
   - Accounts Processed: 3
   - Transactions Updated: 57

🔌 Disconnected from MongoDB
```

---

### Step 5: Verify Results

1. Open your app
2. Go to the Accounts tab
3. Check that balances now match transaction history
4. Verify the "Net Flow" matches the account balance

---

## Common Issues

### Issue: "Missing required parameter --admin-id"

**Fix:** Make sure you include `--` before `--admin-id`:
```bash
npm run recalculate-balances -- --admin-id=YOUR_ID
#                            ^^ Don't forget these!
```

### Issue: "Invalid admin ID format"

**Fix:** Admin ID must be a 24-character hexadecimal string. Check that you copied it correctly:
- ✅ Good: `507f1f77bcf86cd799439011` (24 hex chars)
- ❌ Bad: `507f1f77` (too short)
- ❌ Bad: `507f1f77bcf86cd799439011xyz` (not hex)

### Issue: "MongoDB connection string not found"

**Fix:** Make sure your `.env` file has either:
```env
MONGODB_URI=mongodb://...
# or
MONGO_URI=mongodb://...
```

### Issue: "Cannot find module"

**Fix:** Make sure you're in the backend directory:
```bash
pwd  # Should show .../backend
cd backend  # If not in backend, navigate to it
npm run recalculate-balances -- --admin-id=YOUR_ID
```

---

## What Happens After Running?

- ✅ All `balance_after_transaction` values are recalculated
- ✅ Account `current_balance` is updated to match final transaction balance
- ✅ Balance discrepancies are fixed
- ✅ Your app will now show correct balances

---

## Tips

1. **Run this after:**
   - Adding many historical transactions
   - Importing data from another system
   - Noticing balance discrepancies

2. **Safe to run multiple times:**
   - The script only updates what needs updating
   - It won't cause problems if run repeatedly

3. **Backup first (optional but recommended):**
   ```bash
   mongodump --uri="your-connection-string" --db=your-db-name
   ```

4. **Can run on production:**
   - The script is safe to run on live data
   - It uses efficient bulk operations
   - No downtime required

---

## Need Help?

1. Check the full README: `backend/scripts/README.md`
2. Look at error messages - they usually tell you what's wrong
3. Make sure MongoDB is running and accessible
4. Verify your admin ID is correct

---

## Success Checklist

- [ ] Found admin ID from database
- [ ] In backend directory
- [ ] Ran command with correct format
- [ ] Script completed successfully
- [ ] Verified balances in app
- [ ] Balances now match transaction history

---

**That's it! Your balances should now be properly calculated. 🎉**
