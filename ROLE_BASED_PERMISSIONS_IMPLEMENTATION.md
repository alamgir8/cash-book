# Role-Based Permissions Implementation

## Overview

Implemented comprehensive role-based access control (RBAC) for the Cash Book application, enabling two types of users:

1. **Direct Sign-up Users** - Automatically treated as owners with full access
2. **Added Members** - Limited access based on their assigned role (owner, manager, cashier, viewer)

## Key Features

### 1. Personal Mode vs Organization Mode

- **Personal Mode**: Users without an active organization have full access to all features (they own their data)
- **Organization Mode**: Users' access is controlled by their role and permissions within the active organization

### 2. Automatic Organization Loading

Organizations are now loaded automatically on app startup (after successful authentication), ensuring role-based permissions work immediately throughout the app.

**Implementation**: `OrganizationLoader` component in `/mobile/app/_layout.tsx`

### 3. Permission Checking System

All screens now check permissions before showing add/edit/delete/export actions:

- **Accounts Screen**: Add, Edit buttons (requires `manage_accounts`)
- **Transactions Screen**: Edit, Export buttons (requires `edit_transactions`, `export_data`)
- **Categories Screen**: Add, Edit, Delete buttons (requires `manage_categories`)
- **Invoices Screen**: Create, Edit buttons (requires `create_invoices`, `edit_invoices`)
- **Parties Screen**: Add, Edit, Delete buttons (requires `manage_customers`, `manage_suppliers`)
- **Organizations Screen**: Edit, Members, Delete actions (requires owner/manager role)
- **Settings Screen**: Conditional sections based on permissions

## Files Modified

### Frontend (Mobile)

#### Core Files

1. **`/mobile/app/_layout.tsx`**
   - Added `OrganizationLoader` component to load organizations on app startup
   - Organizations fetch when user is authenticated
   - Clears organizations on logout

2. **`/mobile/hooks/useOrganization.tsx`**
   - Updated `hasPermission` to check object-based permissions
   - Added permission flags: `canExportData`, `canBackupRestore`, `isPersonalMode`
   - Personal mode (no active org) grants all permissions

3. **`/mobile/services/organizations.ts`**
   - Updated `Organization` and `OrganizationSummary` interfaces to include `role` and `permissions`
   - Changed `permissions` from `string[]` to `OrganizationPermissions` object

#### Screen Files

4. **`/mobile/app/(app)/accounts.tsx`**
   - Added `useOrganization` hook
   - Conditional Add button in header
   - Conditional Edit button in account list
   - Updated empty state message based on permissions

5. **`/mobile/app/(app)/transactions.tsx`**
   - Added `canExportData` permission check
   - Conditional Export PDF button
   - Conditional Edit action in transaction cards

6. **`/mobile/app/(app)/categories.tsx`**
   - Added `canManageCategories` permission check
   - Conditional Add button
   - Conditional Edit/Delete buttons in category list

7. **`/mobile/app/(app)/invoices.tsx`**
   - Added `canManageInvoices` permission check
   - Conditional Create button
   - Updated empty state with permission-aware messages

8. **`/mobile/app/(app)/parties.tsx`**
   - Added `canManageParties` permission check
   - Conditional Add button
   - Conditional Edit/Delete buttons in party list
   - Updated empty state messages

9. **`/mobile/app/(app)/organizations.tsx`**
   - Role-based action buttons (Edit, Members, Delete)
   - Dynamic role badge display
   - Only owners can edit/delete organizations
   - Owners and managers can view members

10. **`/mobile/app/(app)/settings.tsx`**
    - Conditional PDF Reports section (`canViewReports` || `canExportData`)
    - Conditional Backup section (`canBackupRestore`)
    - Conditional Manage Categories button (`canManageCategories`)
    - Business Management section checks permissions

#### Component Files

11. **`/mobile/components/settings/profile-section.tsx`**
    - Shows organization name when in organization mode
    - Displays role badge with color coding (owner, manager, cashier, viewer)
    - Shows "Personal Mode" badge when no active organization

### Backend (Already Correct)

The backend already returns proper `role` and `permissions` for each organization:

- **`/backend/controllers/organization.controller.js`**
  - `getMyOrganizations` returns role and permissions for each organization
  - Permissions are objects with boolean values (from `ROLE_PERMISSIONS` constants)

## Permission Levels

### Owner (Full Access)
- All permissions enabled
- Can manage organization settings
- Can add/remove members
- Can delete organization

### Manager (Management Access)
- Can manage members (add/remove/edit)
- Can view all reports
- Can manage accounts, categories, parties
- Cannot delete organization
- Cannot change organization settings

### Cashier (Operations Access)
- Can create transactions
- Can view transactions and invoices
- Can manage customers/suppliers
- Cannot edit/delete transactions
- Cannot export data or access reports

### Viewer (Read-only Access)
- Can only view transactions and invoices
- No create/edit/delete permissions
- Cannot export data
- Cannot access settings or management features

## User Experience

### For Direct Sign-up Users (Owners)
1. Sign up directly through the app
2. Automatically treated as owner in personal mode
3. Full access to all features
4. Can create organizations and invite team members

### For Added Members
1. Admin creates their account in Organization → Members
2. They receive credentials (email/phone + password)
3. Log in with provided credentials
4. See only features allowed by their role
5. Cannot access restricted features (buttons are hidden)

## Testing Scenarios

### Test 1: Owner Access (Personal Mode)
- User signs up directly
- Should see all features and actions
- Can create/edit/delete everything

### Test 2: Owner in Organization
- User creates an organization
- Switches to organization mode
- Still has full access (owner role)

### Test 3: Manager Access
- Owner adds a manager
- Manager logs in
- Can manage members, accounts, categories
- Cannot delete organization
- Cannot change organization settings

### Test 4: Cashier Access
- Owner adds a cashier
- Cashier logs in
- Can create transactions
- Cannot edit/delete transactions
- Cannot export reports
- Cannot access Settings → Categories

### Test 5: Viewer Access
- Owner adds a viewer
- Viewer logs in
- Can only view transactions and invoices
- No add/edit/delete buttons visible
- Cannot export data

## Benefits

✅ **Security**: Users can only perform actions allowed by their role
✅ **UX**: Clean UI - users don't see options they can't use
✅ **Flexibility**: Supports both personal use and team collaboration
✅ **Scalability**: Easy to add new permissions or roles
✅ **Consistency**: Permission checks applied uniformly across all screens

## Technical Implementation Details

### Permission Check Pattern

```typescript
// In screen component
const { canManageAccounts } = useOrganization();

// Conditional rendering
{canManageAccounts && (
  <ActionButton onPress={handleAdd} />
)}
```

### Personal Mode Logic

```typescript
const isPersonalMode = !activeOrganization;
const hasPermission = (permission) => {
  if (!activeOrganization) return true; // Personal mode - all access
  if (activeOrganization.role === "owner") return true;
  return activeOrganization.permissions?.[permission] === true;
};
```

### Organization Loading

```typescript
// Loads on app startup when authenticated
useEffect(() => {
  if (state.status === "authenticated") {
    const orgs = await organizationsApi.list();
    setOrganizations(orgs.map(o => ({
      id: o._id,
      role: o.role || "owner",
      permissions: o.permissions || {}
    })));
  }
}, [state.status]);
```

## Conclusion

The role-based permissions system is now fully implemented and integrated throughout the application. Users experience a tailored interface based on their role, with proper security enforced both on the frontend (UI visibility) and backend (API validation).
