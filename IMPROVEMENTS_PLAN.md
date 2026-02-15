# Cash Book App - Major Issues & Improvements Plan

## Executive Summary
The cash book application has identified 6 major issues that need immediate attention. This document outlines the current state, root causes, and detailed implementation strategies.

---

## Issue 1: Slow Loading Performance

### Current State
- Multiple queries loading simultaneously on app startup
- No lazy loading or code splitting implemented
- Large query payloads with no pagination optimization
- Organization loading blocks UI initialization

### Root Causes
1. **App Initialization (_layout.tsx)**
   - Fonts preloading takes time
   - Organization list loads synchronously on auth check
   - Multiple context providers initialize together

2. **Dashboard Query Inefficiency (index.tsx)**
   - Fetches accounts, categories, and transactions simultaneously
   - No pagination or limit on initial load
   - Transactions paginated at 20 items - slow on large datasets
   - PDF export service loads on mount

3. **API Configuration (lib/api.ts)**
   - Base URL detection has multiple fallback attempts
   - Timeout set to 15 seconds (can cause slow handoffs)

### Recommendations
- [ ] Implement query lazy loading with React Query
- [ ] Split organization loading from app startup
- [ ] Add pagination with "load more" pattern
- [ ] Implement request batching for related queries
- [ ] Add request timeout optimization
- [ ] Consider using React.lazy() for heavy components

---

## Issue 2: UX/UI Improvements Needed

### Current State
- Basic component styling with Tailwind
- No loading states or skeleton loaders
- Limited error feedback to user
- No success confirmations
- Inconsistent spacing and component sizing

### Specific Areas
1. **Auth Screens (sign-in.tsx, sign-up.tsx)**
   - Need better visual hierarchy
   - Loading indicator during auth
   - Better error messaging

2. **Dashboard (index.tsx)**
   - Need loading skeleton for transactions
   - Transaction card could be more informative
   - Empty states need improvement

3. **Filter Bar (filter-bar.tsx)**
   - Date picker UX needs refinement
   - Filter application feedback needed
   - Better visual for active filters

### Recommendations
- [ ] Implement skeleton loaders for all data lists
- [ ] Add haptic feedback for user actions
- [ ] Improve visual hierarchy with better typography
- [ ] Add success animations/confirmations
- [ ] Create consistent loading states across app

---

## Issue 3: Dashboard Filters Need Enhancement

### Current State
- **Filter Range Options**: daily, weekly, monthly, yearly
- **Available Filters**: date range, account, type, category, counterparty, search
- **Limitations**:
  - No saved filter presets
  - Single account selection only (no multi-select)
  - Limited financial scope filtering
  - Search functionality minimal

### Current Implementation (filter-bar.tsx:20-27)
```
Ranges: daily, weekly, monthly, yearly
```

### Recommendations
- [ ] Add multi-select for accounts
- [ ] Implement saved filter presets
- [ ] Add "last 30/60/90 days" quick filters
- [ ] Add financial scope filtering (income/expense/etc)
- [ ] Implement advanced search
- [ ] Add filter history
- [ ] Better visual for active filters

---

## Issue 4: Calculation & PDF Export Issues

### Current Analysis

#### Backend Calculations (utils/balance.js)
- Balance calculation uses descending order
- Risk of cumulative rounding errors
- No validation of transaction integrity

#### PDF Export (services/reports.ts - 2071 lines)
- Large service file suggests complexity
- Multiple calculation methods
- Potential data transformation errors

#### Current Issues to Investigate
1. **Balance Calculation Logic**
   - Verify descending balance calculation is correct
   - Check for edge cases (deleted transactions, reversed entries)
   - Validate account reconciliation

2. **PDF Export Data**
   - Verify all transactions included in export
   - Check totals calculation matches dashboard
   - Validate financial scope filtering in exports
   - Check date range application

3. **Transaction Types**
   - Debit/Credit terminology consistency
   - Transfer transactions handling
   - Invoice payment tracking

### Recommendations
- [ ] Audit balance calculation algorithm
- [ ] Add transaction validation on creation/update
- [ ] Verify PDF export totals match dashboard
- [ ] Add export audit trail
- [ ] Test edge cases (deleted items, date boundaries)
- [ ] Create calculation verification endpoint

---

## Issue 5: Session Persistence & Auto Logout

### Current Issue
Users are being logged out when they shouldn't be.

### Current State (useAuth.tsx)
- **Token Storage**: SecureStore (Expo)
- **Refresh Interval**: 30 minutes
- **Session Keys**: 
  - `cash-book-auth-session` (tokens)
  - `cash-book-auth-user` (user data)
  - `debit-credit-token` (legacy)

### Root Cause Analysis
The code has MULTIPLE auto-logout triggers:

1. **Unauthorized Handler** (useAuth.tsx:204-215)
   ```tsx
   // Clears session on ANY 401/403
   if (status === 401 || status === 403) {
     await clearSession();
   }
   ```

2. **Bootstrap Failure** (useAuth.tsx:300-310)
   ```tsx
   // Logs out if profile fetch fails (network issues!)
   if (!cachedUser && profileError) {
     await clearSession();
   }
   ```

3. **Refresh Token Failure** (useAuth.tsx:175-185)
   ```tsx
   // Clears session on refresh failure
   if (status === 401 || status === 403) {
     await clearSession();
   }
   ```

### The Real Problem
The app is treating **network errors** and **transient failures** as auth failures, causing unintended logouts.

### Recommendations
- [ ] **DO NOT** logout on network errors - keep session alive
- [ ] Only logout on explicit 401/403 with auth context
- [ ] Implement exponential backoff for retries
- [ ] Add offline mode support
- [ ] Reduce refresh interval or remove automatic refresh
- [ ] Only logout on **manual signOut()** action

---

## Issue 6: Password/PIN Visibility Toggle

### Current State
- Sign-in has `showPassword` and `showPin` state variables
- Sign-up has basic password visibility
- Some fields lack visibility toggle

### Current Implementation Issues
1. **Sign-in (sign-in.tsx:73)**
   - Has state for showPassword and showPin
   - Missing eye icon in UI for PIN field
   - Inconsistent implementation

2. **Sign-up (sign-up.tsx:44)**
   - Has showPassword state
   - Eye icon implementation present
   - Clean implementation

3. **Profile Edit & Other Fields**
   - password fields use `secureTextEntry` without toggle
   - No visual indicator for password security state

### Recommendations
- [ ] Create reusable `PasswordInput` component
- [ ] Add eye icon toggle to ALL password fields
- [ ] Ensure consistency across sign-in and sign-up
- [ ] Add to profile edit modal
- [ ] Add to member invitation modal
- [ ] Add visual feedback when toggled

---

## Priority Implementation Order

### Phase 1: Critical (Do First)
1. **Fix Session/Logout Issue** - Users losing sessions is critical
2. **Add Password Visibility Toggles** - Simple UX win
3. **Improve Loading Indicators** - Better UX feedback

### Phase 2: Important (Do Next)
4. **Optimize Query Performance** - Fundamental app slowness
5. **Enhance Dashboard Filters** - Core feature improvement
6. **Audit Calculations** - Data integrity

### Phase 3: Enhancement (Polish)
7. **Improve overall UX/UI** - Visual refinement
8. **Add advanced features** - Filter presets, saved searches

---

## Implementation Details by Issue

### Fix 1: Session Persistence
**Files to Modify**: `mobile/hooks/useAuth.tsx`
**Changes**:
- Remove auto-logout on network errors
- Add offline-first caching
- Reduce/remove auto-refresh interval
- Only logout on manual signOut()

### Fix 2: Password Visibility
**Files to Create/Modify**:
- Create: `mobile/components/password-input.tsx`
- Modify: `mobile/app/(auth)/sign-in.tsx`
- Modify: `mobile/app/(auth)/sign-up.tsx`
- Modify: `mobile/components/profile-edit-modal.tsx`
- Modify: `mobile/components/modals/add-member-modal.tsx`

### Fix 3: Loading Performance
**Files to Modify**:
- `mobile/app/_layout.tsx` - Lazy load organizations
- `mobile/app/(app)/index.tsx` - Pagination improvements
- `mobile/lib/queryClient.ts` - Cache configuration
- Create: `mobile/components/skeleton-loaders.tsx`

### Fix 4: Dashboard Filters
**Files to Modify**:
- `mobile/components/filter-bar.tsx` - Multi-select, presets
- `mobile/app/(app)/index.tsx` - Filter state management

### Fix 5: Calculation Audit
**Files to Review**:
- `backend/utils/balance.js`
- `backend/controllers/report.controller.js`
- `mobile/services/reports.ts`

---

## Metrics to Track After Implementation

1. **Performance**
   - First meaningful paint time
   - API response times
   - Cache hit rate

2. **UX**
   - Session retention (no unexpected logouts)
   - User engagement metrics
   - Error rate reduction

3. **Data Integrity**
   - Balance calculation accuracy
   - PDF export validation
   - Transaction reconciliation

---

## Testing Checklist

- [ ] Test login persistence across app restarts
- [ ] Test network disconnection handling
- [ ] Test password visibility toggle on all screens
- [ ] Test filter combinations
- [ ] Test PDF export accuracy
- [ ] Test loading states with slow network
- [ ] Test edge cases (deleted items, boundary dates)
- [ ] Test multi-account scenarios
- [ ] Test large transaction datasets
- [ ] Test biometric + manual login combinations
