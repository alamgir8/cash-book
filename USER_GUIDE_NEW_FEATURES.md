# How to Use the New Features

## 1. Transfer Modal Keyboard Fix

The keyboard will now stay open when you interact with the amount field in the transfer modal. Simply:

1. Tap the "Transfer" button from the dashboard
2. Select source and destination accounts
3. Tap on the "Amount" field
4. Enter the amount - the keyboard will remain visible even when scrolling

---

## 2. Edit Transaction Feature

You can now edit any existing transaction:

### From the Dashboard:

1. View your transactions list
2. Find the transaction you want to edit
3. Tap the "Edit" button at the bottom of the transaction card
4. The transaction form will open with all fields pre-filled
5. Make your changes (amount, description, category, account, etc.)
6. Tap "Update Transaction" to save
7. The transaction and all related balances will be updated automatically

### What You Can Edit:
- ✅ Transaction amount
- ✅ Transaction type (credit/debit)
- ✅ Account
- ✅ Category
- ✅ Date
- ✅ Description
- ✅ Comment/keyword
- ✅ Counterparty

### Important Notes:
- Editing a transaction will automatically recalculate the `balance_after_transaction`
- If you change the account, both the old and new account balances will be adjusted
- Deleted transactions cannot be edited (you need to restore them first)

---

## 3. Balance Recalculation Script

If you notice any discrepancies in your account balances (especially after adding transactions with past dates), you can run the balance recalculation script.

### When to Use:
- After importing historical transactions
- When balance doesn't match transaction history
- After data migration
- When you notice inconsistencies in account balances

### How to Run:

#### Option 1: Using cURL (Command Line)

```bash
curl -X POST https://your-api-url.com/api/transactions/recalculate-balances \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

#### Option 2: From Browser Console

1. Open your app in the browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Run:

```javascript
fetch('/api/transactions/recalculate-balances', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token'), // or however you store the token
    'Content-Type': 'application/json',
  },
})
.then(res => res.json())
.then(data => console.log('✅ Done!', data))
.catch(err => console.error('❌ Error:', err));
```

#### Option 3: Add a Button in Settings (Recommended for Admin)

You can add a button in your settings screen:

```typescript
// In your settings component
const handleRecalculateBalances = async () => {
  try {
    const { data } = await api.post('/transactions/recalculate-balances');
    Toast.show({
      type: 'success',
      text1: 'Balances Recalculated Successfully',
      text2: `Processed ${data.accountsProcessed} accounts, updated ${data.transactionsUpdated} transactions`,
    });
  } catch (error) {
    Toast.show({
      type: 'error',
      text1: 'Recalculation Failed',
      text2: 'Please try again later',
    });
  }
};

// Then add a button
<TouchableOpacity onPress={handleRecalculateBalances}>
  <Text>Recalculate Balances</Text>
</TouchableOpacity>
```

### What It Does:
1. Gets all your accounts
2. For each account:
   - Fetches all transactions in chronological order
   - Starts from the opening balance
   - Recalculates the balance after each transaction
   - Updates the `balance_after_transaction` field
   - Updates the account's current balance
3. Returns a summary of how many accounts and transactions were processed

### Expected Response:

```json
{
  "message": "Balance recalculation completed successfully",
  "accountsProcessed": 5,
  "transactionsUpdated": 127
}
```

### Performance Notes:
- Uses bulk operations for efficiency
- Only updates transactions where the balance has changed
- Safe to run multiple times (idempotent)
- Processes accounts sequentially to avoid race conditions

---

## Troubleshooting

### Transfer Modal Keyboard Still Dismissing?
- Make sure you're on the latest version
- Try restarting the app
- Check if you're running on iOS or Android (behavior may differ slightly)

### Edit Transaction Not Working?
- Ensure you have internet connection
- Check that the transaction isn't deleted
- Verify you have permission to edit transactions
- Look for error messages in the app

### Balance Recalculation Failed?
- Check your authentication token is valid
- Ensure you're an admin user
- Check the backend logs for errors
- Try again with a smaller number of transactions

### Balance Still Incorrect After Recalculation?
- Check if there are any pending transactions
- Verify the opening balance of your accounts is correct
- Look for any deleted transactions that should be included
- Check the backend logs for any errors during recalculation

---

## Support

If you encounter any issues with these new features, please:

1. Check the error messages in the app
2. Look at the browser/app console for errors
3. Check the backend logs
4. Report the issue with:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Screenshots if applicable
   - Error messages
