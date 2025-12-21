# Role-Based Access Control (RBAC) Implementation

## Overview
Implemented comprehensive role-based access control throughout the mobile app to show/hide features based on user permissions within their active organization.

## User Roles & Permissions

### 1. **Owner**
- Full access to all features
- Can manage members
- Can manage accounts
- Can manage categories
- Can create/edit transactions
- Can view reports & export PDFs
- Can backup & restore data
- Can manage parties & invoices

### 2. **Manager**
- Can manage accounts
- Can manage categories
- Can create/edit transactions
- Can view reports
- Can manage parties & invoices
- **Cannot** manage members
- **Cannot** backup/restore data

### 3. **Cashier**
- Can create transactions
- Can view reports
- **Cannot** manage accounts
- **Cannot** manage categories
- **Cannot** manage members
- **Cannot** manage parties/invoices
- **Cannot** backup/restore

### 4. **Viewer** (Read-Only)
- Can view dashboard
- Can view transactions (read-only)
- **Cannot** create/edit transactions
- **Cannot** access accounts tab
- **Cannot** manage any data
- **Cannot** export reports

## Features Controlled by RBAC

### Dashboard Screen (`index.tsx`)
- **Quick Actions**: Filtered based on permissions
  - Add Transaction: `canCreateTransactions`
  - Transfer Funds: `canCreateTransactions`
  - New Account: `canManageAccounts`
  - Export PDF: `canViewReports`
- **Floating Action Button**: Hidden if `!canCreateTransactions`
- **Edit Transaction**: Disabled with toast error if `!canCreateTransactions`
- **Dashboard Subtitle**: Shows organization name and role badge

### Tab Navigation (`_layout.tsx`)
- **Accounts Tab**: Hidden for viewers (`showLimitedTabs` check)
- **Transactions Tab**: Always visible (viewers can see, just not edit)
- **Dashboard & Settings**: Always visible

### Settings Screen (`settings.tsx`)
- **Profile Section**: Shows role badge when in organization
- **PDF Reports**: Only visible if `canViewReports`
  - All Transactions
  - By Category
  - By Counterparty
  - By Account
- **Backup & Restore**: Only visible for `isOwner`
- **Manage Categories**: Only visible if `canManageCategories`
- **Business Management Section**:
  - Organizations: Always visible
  - Customers & Suppliers: Only if `canManageParties`
  - Invoices: Only if `canManageInvoices`

## Permission Mapping

```typescript
// From useOrganization hook
const permissions = {
  canManageAccounts: hasPermission("manage_accounts"),
  canManageCategories: hasPermission("manage_categories"),
  canCreateTransactions: hasPermission("create_transactions"),
  canViewReports: hasPermission("view_reports"),
  canManageMembers: hasPermission("manage_members"),
  canManageInvoices: hasPermission("create_invoices") || hasPermission("edit_invoices"),
  canManageParties: hasPermission("manage_parties"),
};
```

## Role Hierarchy

```
Owner (All Permissions)
  ↓
Manager (All except member management & backup)
  ↓
Cashier (Transactions & Reports only)
  ↓
Viewer (Read-only access)
```

## UI/UX Enhancements

### 1. **Role Badge Display**
- Dashboard subtitle shows: `"Organization Name · Role"`
- Settings profile shows role badge with colored background

### 2. **Permission Denial Toast**
- When user without permission tries to edit transaction
- Shows: "Permission Denied - You don't have permission to edit transactions"

### 3. **Conditional Rendering**
- Components gracefully hide when user lacks permission
- Quick Actions section hides if no actions available
- Tabs dynamically show/hide based on role

### 4. **Personal Mode**
- Users not in organization have all permissions (personal accounts)
- `hasPermission()` returns `true` when `activeOrganization` is `null`

## Files Modified

### Mobile App
1. `/mobile/components/quick-actions.tsx`
   - Added `useOrganization` hook
   - Filter actions by permissions
   - Hide component if no actions available

2. `/mobile/app/(app)/_layout.tsx`
   - Added `useOrganization` hook
   - Conditional tab visibility
   - Hide Accounts tab for viewers

3. `/mobile/app/(app)/index.tsx`
   - Added `useOrganization` hook
   - Disable edit for users without permission
   - Hide floating action button for viewers
   - Show role in dashboard subtitle

4. `/mobile/app/(app)/settings.tsx`
   - Added `useOrganization` hook
   - Role badge in profile
   - Conditional sections (PDF, Backup, Categories, Parties, Invoices)

### Backend (Existing)
- `/backend/models/OrganizationMember.js` - Role & permissions schema
- `/backend/controllers/organization.controller.js` - Member management
- `/mobile/hooks/useOrganization.tsx` - Permission checks

## Testing Scenarios

### Test Case 1: Owner
- ✅ See all quick actions
- ✅ Access all tabs
- ✅ Edit transactions
- ✅ Export PDFs
- ✅ Backup/restore data
- ✅ Manage categories, parties, invoices

### Test Case 2: Manager
- ✅ See most quick actions (not member-related)
- ✅ Access all tabs
- ✅ Edit transactions
- ✅ Export PDFs
- ❌ Cannot backup/restore

### Test Case 3: Cashier
- ✅ See transaction quick actions
- ✅ Access transactions tab
- ✅ Create transactions
- ❌ Cannot manage accounts (no account tab, no "New Account" action)
- ❌ Cannot manage categories

### Test Case 4: Viewer
- ✅ See dashboard (no actions)
- ✅ View transactions (read-only)
- ❌ No quick actions visible
- ❌ No floating action button
- ❌ Cannot edit transactions (toast error)
- ❌ No accounts tab
- ❌ Cannot export PDFs
- ❌ Cannot access parties/invoices

## Security Notes

1. **Frontend checks are for UX only** - Backend validates all permissions
2. **Personal mode** - Users not in organization have full access to their data
3. **Organization context** - Permissions only apply within organization context
4. **Dynamic updates** - Switching organizations updates permissions immediately

## Future Enhancements

1. Custom role creation with granular permissions
2. Permission inheritance for sub-organizations
3. Audit logs for permission changes
4. Temporary permission grants with expiration
5. Permission request workflow for users
