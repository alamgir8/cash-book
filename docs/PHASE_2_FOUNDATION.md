# Local-first Phase 2 — foundation hardening

Completed on branch `feat/local-first-sync`.

## What changed

1. **Per-user SQLite isolation**
   - Logout / switch-account calls `resetLocalLedgerForUserChange()` (deletes `hisabboi_local.db` + `Documents/attachments`).
   - On every authenticated session, `ensureLocalLedgerOwner(adminId)` binds `meta.owner_admin_id` or wipes if another user owned the file.
   - Local-first flags (`@lf_*`) are kept as device preferences.

2. **Schema v2 — sync metadata**
   - Migration `002_sync_status` adds `sync_status`, `retry_count`, `last_sync_error` to all five ledger tables.
   - Indexes on `updated_at` (parties/txns/transfers) and `sync_status`.
   - Repos set `pending_update` / `pending_delete` on mutate; sync engine sets `synced` / `failed`.

3. **Complete wipe**
   - `wipeAllLedgerData` now also clears `sync_conflicts` and `meta`.

4. **DAL coverage**
   - Invoice create, scheme detail, import account create, and PDF reports now use `dal*` for accounts/parties (still cloud for invoice/scheme APIs themselves).

## Auth / offline behavior (locked)

| Scenario | Behavior |
|----------|----------|
| Offline after prior login | Cached user + local ledger OK if LF migrated |
| Token expired + offline | Stay local-authenticated; cloud features fail quietly |
| Logout | Wipe SQLite + attachments; clear tokens |
| Reinstall | Empty DB; migrate or restore after login |
| Different user on same device | Owner mismatch wipe before use |

## Not in Phase 2 (done later)

- Enabling local-first by default → **done** (LF + cloud sync default ON; dual-write OFF)
- Offline invoices/products → still deferred
- Backend financial apply on sync push → Phase 5 (done on branch)
- Storage % thresholds UI → Phase 6 (done on branch)
- Org books in sync pull → done (`scope=all`)
