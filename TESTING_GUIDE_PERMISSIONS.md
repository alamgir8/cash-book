# Testing Guide: Role-Based Permissions

## Setup

### Test User Accounts

You'll need to create test accounts with different roles to verify the permission system works correctly.

## Test Scenarios

### Scenario 1: Personal Mode (Direct Sign-up User)

**Steps:**
1. Sign up with a new account (e.g., `owner@test.com`)
2. Log in
3. Navigate to each screen

**Expected Results:**
- ✅ Dashboard: Can create transactions (+ button visible)
- ✅ Accounts: Can add/edit accounts
- ✅ Transactions: Can edit transactions, export PDF
- ✅ Categories: Can add/edit/delete categories
- ✅ Settings: All sections visible (Profile, Security, PDF Reports, Backup, Business Management)
- ✅ Parties: Can add/edit/delete parties
- ✅ Invoices: Can create/edit invoices

**Verification:**
- Profile section shows "Personal Mode" badge
- All action buttons are visible

---

### Scenario 2: Organization Owner

**Steps:**
1. Log in as owner account
2. Create an organization (Settings → Organizations → Create)
3. Switch to the new organization
4. Navigate to each screen

**Expected Results:**
- ✅ Same permissions as Personal Mode
- ✅ Organizations screen shows "Owner" badge
- ✅ Can edit organization settings
- ✅ Can manage members (add/remove/edit)
- ✅ Can delete organization

**Verification:**
- Profile section shows organization name and "Owner" role badge
- All management actions available in Organizations screen

---

### Scenario 3: Manager Role

**Setup:**
1. Log in as owner
2. Go to Organizations → Select organization → Members
3. Add a member with role "Manager"
   - Display Name: "Test Manager"
   - Email: `manager@test.com`
   - Phone: `1234567890`
   - Password: `Test@123`
   - Role: Manager
4. Log out
5. Log in as manager (`manager@test.com` / `Test@123`)

**Expected Results:**
- ✅ Dashboard: Can view transactions
- ✅ Accounts: Can add/edit accounts
- ✅ Transactions: Can view, but cannot edit/delete
- ✅ Categories: Can manage categories
- ✅ Settings: Can see most sections, but not organization settings changes
- ✅ Organizations: Can view members, cannot edit org settings, cannot delete org
- ✅ Parties: Can manage parties
- ✅ Invoices: Can create/view invoices

**Verification:**
- Profile section shows "Manager" badge (blue color)
- Can see "Members" button in Organizations screen
- Cannot see "Edit" or "Delete" organization buttons

---

### Scenario 4: Cashier Role

**Setup:**
1. Log in as owner
2. Add a member with role "Cashier"
   - Display Name: "Test Cashier"
   - Email: `cashier@test.com`
   - Password: `Test@123`
   - Role: Cashier
3. Log out
4. Log in as cashier

**Expected Results:**
- ✅ Dashboard: Can create transactions
- ✅ Accounts: Can view only (no add/edit buttons)
- ✅ Transactions: Can view, cannot edit, cannot export
- ✅ Categories: Cannot access (hidden in Settings)
- ✅ Settings: Limited sections (no Categories, no Backup)
- ✅ Parties: Can view/manage customers and suppliers
- ✅ Invoices: Can create invoices

**Verification:**
- Profile section shows "Cashier" badge (green color)
- No "Edit" buttons on accounts list
- No "Export PDF" button in Transactions
- Settings → Categories option not visible
- Organizations screen shows limited actions

---

### Scenario 5: Viewer Role

**Setup:**
1. Log in as owner
2. Add a member with role "Viewer"
   - Display Name: "Test Viewer"
   - Email: `viewer@test.com`
   - Password: `Test@123`
   - Role: Viewer
3. Log out
4. Log in as viewer

**Expected Results:**
- ❌ Dashboard: No add transaction button
- ❌ Accounts: Can view only, no add/edit buttons
- ❌ Transactions: Can view only, no edit, no export
- ❌ Categories: Cannot access
- ❌ Settings: Very limited (only Profile, Security, App Info)
- ❌ Parties: Can view only, no add/edit/delete
- ❌ Invoices: Can view only, no create button
- ❌ Organizations: Can view only, no management actions

**Verification:**
- Profile section shows "Viewer" badge (gray color)
- Minimal UI - mostly view-only
- Empty states show "Contact your organization admin" messages
- No action buttons visible across the app

---

## Permission Matrix

| Feature | Owner | Manager | Cashier | Viewer |
|---------|-------|---------|---------|--------|
| Create Transactions | ✅ | ✅ | ✅ | ❌ |
| Edit Transactions | ✅ | ✅ | ❌ | ❌ |
| Delete Transactions | ✅ | ✅ | ❌ | ❌ |
| View Transactions | ✅ | ✅ | ✅ | ✅ |
| Manage Accounts | ✅ | ✅ | ❌ | ❌ |
| Manage Categories | ✅ | ✅ | ❌ | ❌ |
| Create Invoices | ✅ | ✅ | ✅ | ❌ |
| Edit Invoices | ✅ | ✅ | ❌ | ❌ |
| View Invoices | ✅ | ✅ | ✅ | ✅ |
| Manage Parties | ✅ | ✅ | ✅ | ❌ |
| View Reports | ✅ | ✅ | ❌ | ❌ |
| Export Data | ✅ | ✅ | ❌ | ❌ |
| Backup/Restore | ✅ | ❌ | ❌ | ❌ |
| Manage Members | ✅ | ✅ | ❌ | ❌ |
| Manage Organization | ✅ | ❌ | ❌ | ❌ |

---

## Visual Verification Checklist

### Profile Section (Settings Screen)

- [ ] Personal Mode: Shows "Personal Mode" badge
- [ ] Owner: Shows organization name + purple "OWNER" badge
- [ ] Manager: Shows organization name + blue "MANAGER" badge
- [ ] Cashier: Shows organization name + green "CASHIER" badge
- [ ] Viewer: Shows organization name + gray "VIEWER" badge

### Settings Screen Sections

**Owner/Personal Mode:**
- [ ] Profile Section
- [ ] Security Section
- [ ] PDF Reports Section
- [ ] Backup Section
- [ ] Manage Categories button
- [ ] Business Management Section
- [ ] App Info Section

**Manager:**
- [ ] Profile Section
- [ ] Security Section
- [ ] PDF Reports Section
- [ ] Manage Categories button
- [ ] Business Management Section
- [ ] App Info Section

**Cashier:**
- [ ] Profile Section
- [ ] Security Section
- [ ] Business Management Section (limited)
- [ ] App Info Section

**Viewer:**
- [ ] Profile Section
- [ ] Security Section
- [ ] App Info Section

### Empty State Messages

- [ ] Viewer sees: "Contact your organization admin..." messages
- [ ] Cashier/Manager see: Standard empty state messages
- [ ] Owner sees: Action buttons to create items

---

## API Verification

Use the browser console or React Native debugger to verify:

1. **Organizations API Response:**
```javascript
// Should include role and permissions
{
  _id: "...",
  name: "My Business",
  role: "manager",
  permissions: {
    manage_accounts: true,
    manage_categories: true,
    create_transactions: true,
    edit_transactions: false,
    // ... other permissions
  }
}
```

2. **Organization Context:**
```javascript
// Check in React DevTools
activeOrganization: {
  id: "...",
  role: "manager",
  permissions: { ... }
}
```

3. **Permission Checks:**
```javascript
// In console
hasPermission("manage_accounts") // Should return true/false based on role
```

---

## Common Issues & Solutions

### Issue: All buttons showing regardless of role
**Solution:** Ensure organizations loaded on startup. Check browser/RN console for "Failed to load organizations" errors.

### Issue: Personal mode not working
**Solution:** Verify `activeOrganization` is null when no org selected. Check OrganizationContext value.

### Issue: Wrong permissions applied
**Solution:** Check backend response includes correct `role` and `permissions` object. Verify ROLE_PERMISSIONS constants in backend.

### Issue: UI not updating after switching organizations
**Solution:** Ensure `switchOrganization` properly updates context and re-renders components.

---

## Success Criteria

✅ All role-based UI elements show/hide correctly
✅ Empty states display appropriate messages for each role
✅ Profile section shows correct role badge
✅ No console errors when navigating between screens
✅ Organizations load automatically on app startup
✅ Personal mode grants full access
✅ Backend API returns role and permissions correctly
