# Offline-first implementation progress

Branch: `feat/local-first-sync`

## Defaults (current)

| Flag | Default |
|------|---------|
| Use on-device database | **ON** |
| Cloud sync | **ON** |
| Dual-write | **OFF** |
| Drive backups | OFF |

Fresh install still needs **Migrate from cloud** once (empty SQLite until then).

## Completed

### Phase 2 — Local DB foundation
- Per-user SQLite isolation on logout / owner mismatch
- Schema v2: `sync_status`, `retry_count`, `last_sync_error` + indexes
- DAL routing for invoice/scheme/import/reports party+account reads

### Phase 3 — Offline CRUD
- Ledger reads/writes SQLite when LF on
- Post-mutation `requestSyncSoon`; UI never blocks on Mongo for ledger CRUD

### Phase 4 — Sync engine
- Debounced sync, reconnect, exponential backoff, `/health` probe
- Status banner: offline / server unavailable / pending / failed
- Pull `scope=all` (personal + org books)

### Phase 5 — Backend sync financial safety
- Transaction push applies account/party `$inc`; dues skipped
- Account/party push does not trust client `current_balance` on updates

### Phase 6 — Recovery / storage
- Storage thresholds + Settings hints; local + Drive backup paths

### Phase 7 — Tests
- `npm run test:local-first`

## Device QA (Debug on iPhone)

1. `npx expo run:ios --device` (USB, phone unlocked) — not Expo Go
2. `EXPO_PUBLIC_BASE_URL` → Vercel or Mac LAN; Metro `--dev-client --clear`
3. Sign in → Settings → Migrate from cloud
4. Airplane mode: add/edit ledger; reopen online → Sync now

## Still deferred
- Offline invoices / products / schemes — **planned:** full offline shop CRUD in [`SHOP_LOCAL_FIRST_MASTER.md`](./SHOP_LOCAL_FIRST_MASTER.md)
- SQLCipher
- Multi-writer org conflict UX
