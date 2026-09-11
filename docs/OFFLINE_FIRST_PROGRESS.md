# Offline-first implementation progress

Branch: `feat/local-first-sync`

## Completed in this pass

### Phase 2 — Local DB foundation hardening
- Per-user SQLite isolation on logout / owner mismatch (`lib/local-first/owner.ts`)
- Schema v2: `sync_status`, `retry_count`, `last_sync_error` + indexes
- DAL routing for invoice/scheme/import/reports party+account reads
- Full wipe clears `meta` + `sync_conflicts`

### Phase 3 — Offline CRUD
- Core ledger already local-first when flags ON
- Post-mutation `requestSyncSoon` after all DAL writes
- UI never blocks on Mongo for ledger CRUD

### Phase 4 — Sync engine
- Debounced immediate sync after mutations
- Reconnect trigger (offline → online)
- Exponential backoff (5s → 15m)
- Backend `/health` probe separate from NetInfo
- Richer non-blocking status banner (offline / server unavailable / pending / failed)

### Phase 5 — Backend sync financial safety
- Transaction push applies account/party `$inc` (dues skipped)
- Delete reverts balances; due payments restore parent `due_remaining`
- Account/party push no longer trusts client `current_balance` on updates

### Phase 6 — Recovery / storage
- Configurable storage thresholds (`storage-monitor.ts`)
- Settings shows local DB size / warning hint
- Existing local backup + Drive restore unchanged

### Phase 7 — Tests
- Extended `npm run test:local-first` (DAL routing, sync status, scheduler, backend $inc, storage levels)

## How to use

1. Settings → On-device storage → enable
2. Migrate from cloud
3. Enable Cloud sync (optional)
4. Use the app offline; pending changes sync when backend returns

## Still deferred
- Offline invoices / products / schemes
- Org multi-writer sync
- SQLCipher
- Enabling local-first by default in production builds
