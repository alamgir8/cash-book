# Balance Recalculation CLI Script

This script recalculates the `balance_after_transaction` field for all transactions of a specific admin user in chronological order. It ensures that account balances match transaction history, especially when transactions are added with past dates.

## Prerequisites

- Node.js v20 or higher
- MongoDB connection configured in `.env` file
- Admin user ID (MongoDB ObjectId)

## Usage

### Basic Command

```bash
npm run recalculate-balances -- --admin-id=<ADMIN_ID>
```

### Example

```bash
npm run recalculate-balances -- --admin-id=507f1f77bcf86cd799439011
```

### Direct Execution

You can also run the script directly:

```bash
node scripts/recalculate-balances-cli.js --admin-id=507f1f77bcf86cd799439011
```

## How to Get Admin ID

### Method 1: From MongoDB Compass or Shell

```javascript
// Connect to your database and run:
db.admins.find({}, { _id: 1, email: 1, name: 1 })

// This will show all admins with their IDs
```

### Method 2: From Your Application

If you're logged in as an admin, you can get the ID from:
- Browser localStorage (look for user data)
- API response after login
- Database query

### Method 3: Using MongoDB Shell

```bash
mongosh "your-connection-string"
use your-database-name
db.admins.find().pretty()
```

## What the Script Does

1. **Validates Input**
   - Checks if admin-id parameter is provided
   - Validates that admin-id is a valid MongoDB ObjectId
   - Checks MongoDB connection configuration

2. **Connects to Database**
   - Uses MONGODB_URI or MONGO_URI from .env file
   - Establishes connection to MongoDB

3. **Processes Each Account**
   - Fetches all accounts for the specified admin
   - For each account:
     - Gets all non-deleted transactions sorted by date
     - Starts with the account's opening balance
     - Iterates through transactions chronologically
     - Recalculates balance after each transaction
     - Updates only transactions where balance has changed

4. **Updates Database**
   - Uses bulk operations for efficiency
   - Updates `balance_after_transaction` for each transaction
   - Updates `current_balance` for each account

5. **Reports Results**
   - Shows progress for each account
   - Displays summary of accounts processed
   - Reports total transactions updated

## Output Example

```
🔄 Starting balance recalculation...
📋 Admin ID: 507f1f77bcf86cd799439011

📊 Found 3 account(s)

📁 Processing account: Main Account (60f1234567890abcdef12345)
   📝 Found 45 transaction(s)
   💰 Starting balance: 1000
   ✅ Updated 12 transaction(s)
   💰 Final balance: 3450

📁 Processing account: Savings (60f1234567890abcdef12346)
   📝 Found 23 transaction(s)
   💰 Starting balance: 5000
   ✓  All transactions already have correct balances
   💰 Final balance: 5750

📁 Processing account: Expenses (60f1234567890abcdef12347)
   📝 Found 67 transaction(s)
   💰 Starting balance: 0
   ✅ Updated 45 transaction(s)
   💰 Final balance: -2300

============================================================
✅ Balance recalculation completed successfully!
============================================================
📊 Summary:
   - Accounts Processed: 3
   - Transactions Updated: 57
============================================================
```

## Error Handling

### Missing Admin ID

```
❌ Error: Missing required parameter --admin-id

Usage:
  npm run recalculate-balances -- --admin-id=<ADMIN_ID>

Example:
  npm run recalculate-balances -- --admin-id=507f1f77bcf86cd799439011
```

### Invalid Admin ID Format

```
❌ Error: Invalid admin ID format
   Provided: invalid-id
   Admin ID must be a valid MongoDB ObjectId (24 hex characters)
```

### Missing MongoDB Connection

```
❌ Error: MongoDB connection string not found
   Please set MONGODB_URI or MONGO_URI in your .env file
```

## When to Use

- ✅ After importing historical transactions
- ✅ When you notice balance discrepancies
- ✅ After data migration
- ✅ When transactions were added with past dates
- ✅ After manual database modifications
- ✅ As part of maintenance routine

## Safety Features

- ✅ Only updates transactions that need updating (checks if balance has changed)
- ✅ Uses bulk operations for efficiency
- ✅ Validates all input parameters
- ✅ Processes accounts sequentially to avoid race conditions
- ✅ Only processes non-deleted transactions
- ✅ Disconnects properly from database on completion or error
- ✅ Exit codes: 0 for success, 1 for error

## Performance

- Uses MongoDB bulk operations for efficiency
- Processes one account at a time to avoid memory issues
- Only updates transactions where balance has actually changed
- Suitable for large datasets (tested with 10,000+ transactions)

## Troubleshooting

### Script hangs or doesn't complete

**Solution:** Check your MongoDB connection string and ensure the database is accessible.

### "Cannot find module" error

**Solution:** Make sure you're in the backend directory:
```bash
cd backend
npm run recalculate-balances -- --admin-id=YOUR_ID
```

### Wrong balances after recalculation

**Possible causes:**
1. Check if `opening_balance` is set correctly for accounts
2. Verify no transactions are being created/modified during recalculation
3. Check if there are any deleted transactions that should be included

### Script exits with error code 1

**Solution:** Read the error message carefully. Common issues:
- Invalid admin ID format
- MongoDB connection issues
- Missing environment variables

## Advanced Usage

### Run on Production

```bash
# SSH into your production server
ssh your-server

# Navigate to backend directory
cd /path/to/backend

# Run the script
npm run recalculate-balances -- --admin-id=YOUR_ADMIN_ID
```

### Schedule Regular Runs (Optional)

You can add this to a cron job if needed:

```bash
# Edit crontab
crontab -e

# Add line to run every Sunday at 2 AM
0 2 * * 0 cd /path/to/backend && npm run recalculate-balances -- --admin-id=YOUR_ADMIN_ID >> /var/log/balance-recalc.log 2>&1
```

### Run for Multiple Admins

Create a bash script:

```bash
#!/bin/bash
# recalculate-all-admins.sh

ADMIN_IDS=(
  "507f1f77bcf86cd799439011"
  "507f1f77bcf86cd799439012"
  "507f1f77bcf86cd799439013"
)

for ADMIN_ID in "${ADMIN_IDS[@]}"
do
  echo "Processing admin: $ADMIN_ID"
  npm run recalculate-balances -- --admin-id=$ADMIN_ID
  echo "---"
done
```

## Technical Details

### Transaction Processing Order

Transactions are sorted by:
1. `date` (ascending) - Primary sort
2. `createdAt` (ascending) - Secondary sort for same-day transactions
3. `_id` (ascending) - Tertiary sort for absolute consistency

### Balance Calculation Logic

```javascript
runningBalance = account.opening_balance

for each transaction (in chronological order):
  if transaction.type === "credit":
    runningBalance += transaction.amount
  else: // debit
    runningBalance -= transaction.amount
  
  transaction.balance_after_transaction = runningBalance

account.current_balance = runningBalance
```

### Models Used

The script uses the following MongoDB models:
- **Transaction**: Contains all transaction records
- **Account**: Contains all account records

Both models are defined inline in the script to avoid dependency on the full application.

## Support

If you encounter any issues:

1. Check the error message in the console
2. Verify your MongoDB connection
3. Ensure the admin ID is correct
4. Check the logs for detailed information
5. Run with DEBUG mode if available

## License

This script is part of the cash-book application and follows the same license.

---

**Last Updated:** October 18, 2025
