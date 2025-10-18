# How to Find Your Admin ID

Your admin ID is a unique identifier in MongoDB that looks like this: `507f1f77bcf86cd799439011`

## Method 1: MongoDB Compass (Easiest)

1. **Open MongoDB Compass**
   - Download from: https://www.mongodb.com/products/compass

2. **Connect to Your Database**
   - Use your connection string from `.env` file
   - Click "Connect"

3. **Navigate to Admins Collection**
   - Find and click on your database name
   - Click on the `admins` collection

4. **Find Your User**
   - Look for your user by email or name
   - The `_id` field is your admin ID
   - Click the copy icon next to it

5. **Example:**
   ```json
   {
     "_id": "507f1f77bcf86cd799439011",  ← This is your Admin ID
     "email": "admin@example.com",
     "name": "John Doe"
   }
   ```

---

## Method 2: MongoDB Shell / mongosh

1. **Connect to MongoDB**
   ```bash
   mongosh "your-mongodb-connection-string"
   ```

2. **Switch to Your Database**
   ```bash
   use your-database-name
   ```

3. **Find All Admins**
   ```javascript
   db.admins.find({}, { _id: 1, email: 1, name: 1 }).pretty()
   ```

4. **Copy the ObjectId**
   ```javascript
   // Output will look like:
   {
     "_id": ObjectId("507f1f77bcf86cd799439011"),  ← Copy the string inside
     "email": "admin@example.com",
     "name": "John Doe"
   }
   ```

5. **Use only the string value:**
   ```
   507f1f77bcf86cd799439011
   ```

---

## Method 3: From Your Application (Browser)

1. **Login to Your App**
   - Open your cash-book application
   - Login with admin credentials

2. **Open Developer Tools**
   - Press F12 (or right-click → Inspect)
   - Go to "Console" tab

3. **Check Local Storage**
   ```javascript
   // Try these commands one by one:
   localStorage.getItem('user')
   localStorage.getItem('token')
   localStorage.getItem('admin')
   
   // Or see all storage:
   localStorage
   ```

4. **Decode JWT Token (if using JWT)**
   - Go to https://jwt.io
   - Paste your token
   - Look for user ID in the payload

5. **Check API Response**
   - Go to "Network" tab in DevTools
   - Look for login or user info API calls
   - Check the response for user/admin ID

---

## Method 4: Direct Database Query (Backend)

If you have access to the backend code:

1. **Create a temporary script:**
   ```javascript
   // temp-get-admin-id.js
   import mongoose from 'mongoose';
   import dotenv from 'dotenv';
   
   dotenv.config();
   
   const Admin = mongoose.model('Admin', new mongoose.Schema({
     email: String,
     name: String
   }), 'admins');
   
   async function main() {
     await mongoose.connect(process.env.MONGODB_URI);
     const admins = await Admin.find({}, { _id: 1, email: 1, name: 1 });
     console.log('Admins:', admins);
     await mongoose.disconnect();
   }
   
   main();
   ```

2. **Run it:**
   ```bash
   node temp-get-admin-id.js
   ```

3. **Copy the _id value**

---

## Method 5: Check Backend Logs

If you've logged in recently:

1. **Check Backend Logs**
   - Look for authentication logs
   - User ID might be logged on login

2. **Add Temporary Logging**
   - In your login endpoint, add:
   ```javascript
   console.log('Admin ID:', admin._id.toString());
   ```

3. **Login and Check Console**
   - Login to your app
   - Check backend terminal/logs
   - Copy the ID that appears

---

## Validation

Your admin ID should:
- ✅ Be exactly 24 characters long
- ✅ Only contain: 0-9 and a-f (hexadecimal)
- ✅ Look like: `507f1f77bcf86cd799439011`

Examples:
```
✅ VALID:   507f1f77bcf86cd799439011
✅ VALID:   60d5f4847f4c4c001f2f5e3a
❌ INVALID: 507f1f77 (too short)
❌ INVALID: invalid-id (not hex)
❌ INVALID: 507f1f77bcf86cd799439011xyz (too long/not hex)
```

---

## Quick Reference

Once you have your admin ID, use it like this:

```bash
# Navigate to backend directory
cd backend

# Run the recalculation script
npm run recalculate-balances -- --admin-id=507f1f77bcf86cd799439011
#                                            ↑
#                                    Paste your ID here
```

---

## Troubleshooting

### "Can't find any admins"
- Check you're connected to the right database
- Verify the `admins` collection exists
- Make sure you have admin users created

### "All IDs look weird"
- MongoDB IDs are in hexadecimal format
- They look random but are unique identifiers
- Just copy/paste the value exactly as shown

### "Multiple admins, which one?"
- Use the email or name to identify yourself
- Each admin has their own transactions/accounts
- Make sure you use YOUR admin ID

---

## Need More Help?

1. Check your database connection string in `.env`
2. Verify you have MongoDB access
3. Try MongoDB Compass (Method 1) - it's the easiest!
4. Ask your database administrator if you don't have access

---

**Remember:** Your admin ID is like your user ID in the database. It's safe to use and doesn't change.
