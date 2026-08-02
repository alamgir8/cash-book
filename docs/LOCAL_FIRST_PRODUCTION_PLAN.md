# Local-First Cash Book — Production Plan

**Goal:** Make the device local database the source of truth (WhatsApp-style). Backend + MongoDB become optional sync + auth. Google Drive stores dated, restorable snapshots so data survives phone wipe, local DB loss, and Mongo outages.

**Branch (when starting work):** `feat/local-first-sync`

**Status:** Implementation in progress on `feat/local-first-sync` (Phases 0–8 scaffolded; flags default OFF).

| Phase | Status |
|-------|--------|
| 0 Flags + inventory | Done |
| 1 SQLite schema + repos | Done |
| 2 Local writes (DAL) | Done (accounts/txns/transfers/categories) |
| 3 Local reads (personal) | Done (via DAL + hooks) |
| 4 Local backup v3 | Done |
| 5 Cloud → local migrate | Done |
| 6 Sync API + engine | Done (personal scope) |
| 7 Drive dated upload/restore | Done (physical iPhone OAuth + upload verified) |
| 8 Hardening / encryption | Done (scaffold; SQLCipher deferred; device QA in progress) |
| 9 Org multi-user | Deferred (cloud-primary) |

---

## 0. Success criteria (definition of “100% production ready”)

All of the following must be true before calling this done:

| # | Criterion |
|---|-----------|
| 1 | App works fully offline for personal cash book (accounts, categories, transactions, transfers, parties, reports for local data). |
| 2 | Every create/update/delete writes local DB first; UI never blocks on Mongo for normal use. |
| 3 | Optional cloud sync can be disabled; with sync off, zero Mongo writes for ledger data. |
| 4 | Sync (when enabled) is incremental, idempotent, conflict-safe, and recoverable after crash mid-sync. |
| 5 | Dated Drive (or share) backups restore to a working local DB without manual JSON editing. |
| 6 | Phone wipe → restore from Drive → balances and history match last backup (checksum verified). |
| 7 | Mongo wipe → next sync from devices rebuilds cloud copy (or user restores from Drive). |
| 8 | Existing users can migrate cloud → local once without duplicate transactions. |
| 9 | Org multi-user mode has an explicit supported policy (see §2.3) — not “undefined behavior.” |
| 10 | Automated tests cover local CRUD, migration, sync conflicts, backup/restore; manual QA checklist signed off. |
| 11 | Feature flags allow rollback to cloud-primary without data loss for users who have not migrated. |
| 12 | Observability: sync errors, backup failures, and schema migration failures are visible (logs + in-app status). |

---

## 1. Current baseline (do not skip)

Read these before Phase 1:

| Area | Reality today | Key paths |
|------|----------------|-----------|
| Mobile data | API-first via Axios + React Query (memory only) | `mobile/lib/api.ts`, `mobile/services/*`, `mobile/hooks/*` |
| Local storage | SecureStore (auth), AsyncStorage (prefs), JSON files (backup) — **no ledger DB** | `mobile/services/backup.ts`, `hooks/use-auto-backup.ts` |
| Backup | `GET /backup/export` → JSON v2.0; import via `POST /backup/import` | `backend/controllers/backup.controller.js` |
| “Google Drive” | OS share sheet only — **not** Drive OAuth/API | `components/settings/auto-backup-section.tsx` |
| Idempotency | `client_request_id` on Transaction / Transfer | `models/Transaction.js`, `models/Transfer.js` |
| Backup scope | Personal admin: accounts, categories, transactions, transfers, balanceSnapshots — **missing** parties, invoices, products, schemes, orgs | backup controller |

**Rule:** Every phase must leave the app shippable. Prefer feature flags over big-bang cutover.

---

## 2. Architecture decisions (lock these before coding)

### 2.1 Source of truth

```
Device SQLite (or equivalent)  =  PRIMARY for ledger data
MongoDB                        =  OPTIONAL replica / sync target
Google Drive snapshots         =  DISASTER RECOVERY (user-owned)
```

### 2.2 Local database technology (recommended)

| Choice | Recommendation | Why |
|--------|----------------|-----|
| **Primary pick** | `expo-sqlite` (new async API) or **Op-SQLite** | Native, SQL, works with Expo, good for ledger queries |
| Alternative | WatermelonDB | Better if you need sync primitives + large lists out of the box |
| Avoid for v1 | Realm (licensing/complexity), AsyncStorage (not a DB), MMKV alone (KV only) |

**Decision to record in PR #1:** pick one DB library and stick to it for all entities.

### 2.3 Product modes (explicit)

| Mode | Sync | Who | Production rule |
|------|------|-----|-----------------|
| **A. Personal local-first** | Optional, few times/day or manual | Single user | **Ship this first** |
| **B. Personal multi-device** | Required when 2nd device trusts account | Same user | Last-write-wins per row + `updated_at` + `device_id` |
| **C. Organization shared** | Keep **cloud-primary** for v1 *or* “owner device is authority” | Multi-user | Do **not** claim full offline multi-writer in v1 |

**Recommended v1 scope:** Modes A + B. Mode C stays on existing API until a later phase.

### 2.4 Conflict policy (Mode B)

For each synced row:

1. Compare `updated_at` (ISO, device clock skew capped via server time on sync handshake).
2. If equal timestamp → higher `device_id` string wins (deterministic).
3. Soft-deleted (`deleted_at` set) wins over undelete if delete is newer.
4. Never silently drop the losing version: keep in `sync_conflicts` table / log for support.

Balances are **derived** from transactions locally after every mutate and after sync apply — do not sync `current_balance` as authoritative without recalculating.

### 2.5 Backup format versioning

Extend current JSON; do not break v2.0 restore.

| Field | Purpose |
|-------|---------|
| `format` | `"hisabboi-backup"` |
| `version` | `"3.0"` for local-first full snapshot |
| `schemaVersion` | Integer matching local SQLite migrations |
| `exportedAt` | ISO timestamp |
| `scope` | `{ type: "personal" \| "organization", id }` |
| `checksum` | SHA-256 of canonical `data` payload |
| `data` | All entities needed for full restore |
| `summary` | Counts + total balance |

Drive layout:

```text
HisabBoi/
  backups/
    {userIdOrEmailHash}/
      2026-08-03/
        hisabboi-backup-2026-08-03T130000Z.json
        manifest.json
```

`manifest.json`: `{ version, schemaVersion, exportedAt, checksum, fileName, byteSize, summary }`.

---

## 3. Work phases (execute in order)

Each phase has: **goal → steps → exit criteria → rollback**.  
Do not start phase N+1 until exit criteria of N are checked.

---

### Phase 0 — Branch, flags, inventory

**Goal:** Safe workspace and clear inventory.

**Steps**

1. Create branch from latest `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feat/local-first-sync
   ```
2. Add feature flags (AsyncStorage or remote config later):
   - `LOCAL_FIRST_ENABLED` (default `false` in production until Phase 6)
   - `CLOUD_SYNC_ENABLED` (default `false`)
   - `DRIVE_BACKUP_ENABLED` (default `false`)
3. Document entity inventory in this folder as a short checklist (update §Appendix A as you go):
   - Must be local for v1: Account, Category, Transaction, Transfer, Party, BalanceSnapshot (optional)
   - Defer or cloud-only for v1: Invoice, Product, Stock, CollectionScheme, multi-member Organization writes
4. Add CI job or script placeholder: `mobile` unit tests for DB layer (even if empty).

**Exit criteria**

- [ ] Branch exists; flags exist and gate no behavior yet.
- [ ] Entity list agreed (Appendix A filled).

**Rollback:** Delete branch / leave flags off.

---

### Phase 1 — Local schema + repository layer (no UI switch)

**Goal:** SQLite schema, migrations, typed repositories. App still uses API.

**Steps**

1. Install chosen SQLite library; configure Expo plugins if needed.
2. Create `mobile/db/`:
   - `migrations/` — numbered SQL migrations (`001_init.sql`, …)
   - `client.ts` — open DB, run migrations on launch
   - `schema.ts` — table TypeScript types
   - `repos/` — one repo per entity (`accountsRepo`, `transactionsRepo`, …)
3. Common columns on every synced table:

   | Column | Type | Notes |
   |--------|------|-------|
   | `id` | TEXT PK | UUID (generate client-side; stop relying only on Mongo `_id`) |
   | `server_id` | TEXT NULL | Mongo `_id` when known |
   | `organization_id` | TEXT NULL | null = personal |
   | `created_at` / `updated_at` | TEXT | ISO |
   | `deleted_at` | TEXT NULL | soft delete |
   | `dirty` | INTEGER | 1 = needs push |
   | `sync_version` | INTEGER | monotonic per row optional |
   | `client_request_id` | TEXT NULL | unique where used |
   | `device_id` | TEXT | last writer |

4. Implement migrations runner with `schema_version` table; never edit old migration files after merge.
5. Unit tests: migrate empty DB; insert/update/soft-delete account; query by org scope.
6. Add `mobile/db/README.md` — how to open DB in debugger, reset DB in dev.

**Exit criteria**

- [ ] Fresh install runs migrations to latest.
- [ ] Repo CRUD works in tests without network.
- [ ] App launch unchanged with flag off.

**Rollback:** Remove DB module; flag unused.

---

### Phase 2 — Local write path behind flag (dual-write optional)

**Goal:** When `LOCAL_FIRST_ENABLED`, mutations write local DB; optionally still hit API (dual-write) for safety during dogfood.

**Steps**

1. Introduce a **data access layer** (DAL) used by hooks:
   - `mobile/data/accounts.ts` etc. — chooses local vs API by flag.
2. For transactions:
   - Insert local row with UUID + `client_request_id`.
   - Update account/party balances in a **single SQLite transaction**.
   - Mark `dirty = 1`.
3. Dual-write mode (dogfood only): after local commit, call existing API with same `client_request_id`; on API success set `server_id` and `dirty = 0`.
4. Keep React Query: either
   - Prefer: local queries as source + invalidate on write, or
   - Temporary: hydrate React Query from local repos.
5. Wire NetInfo: show “Offline — changes saved on device” banner when local-first and offline.
6. Instrument: log write failures; never leave partial balance updates (use SQL transactions).

**Exit criteria**

- [x] With flag on (dev build): create/edit/delete transaction works offline; balances correct.
- [ ] Kill app mid-write → reopen → no corrupt balances (use SQL txn tests).
- [x] Flag off → existing API behavior identical.
- [x] Offline banner when local-first + NetInfo offline.

**Rollback:** Flag off; dual-write unused.

---

### Phase 3 — Read path fully local (personal scope)

**Goal:** Lists, detail, dashboard, reports for personal mode read from SQLite.

**Steps**

1. Replace personal-mode fetches for accounts, categories, transactions, transfers, parties with repo queries.
2. Pagination: SQL `LIMIT/OFFSET` or keyset on `date, id`.
3. Search: SQL indexes on description, party name, date.
4. Recalculate balances utility (mirrors backend reconciliation) — run after restore and after sync apply.
5. Empty states + “Migrate from cloud” entry point (Phase 5).

**Exit criteria**

- [x] Airplane mode: personal accounts/categories/parties/transactions CRUD via DAL (reports/PDF still server).
- [ ] Performance: 10k transactions list scrolls acceptably (measure on mid device).
- [x] Flag off: unchanged.

**Rollback:** Flag off.

---

### Phase 4 — Backup / restore against local DB (before Drive)

**Goal:** Snapshot and restore work **without** Mongo.

**Steps**

1. Implement `exportLocalBackup(): BackupV3` reading all local tables for active scope.
2. Implement `importLocalBackup(file, { mode: "replace" | "merge" })`:
   - **replace** (recommended restore): wipe scope tables → import → recalculate balances.
   - **merge**: only for advanced; document conflicts.
3. Validate: `version`, `schemaVersion`, `checksum` before import.
4. Auto-backup: rewrite `use-auto-backup` to dump **local** DB to `auto-backup-*.json` (keep last N, e.g. 7).
5. Settings UI: Create backup / Restore — operate on local files; unlock flow can stay.
6. Migration path from backup v2.0: importer maps Mongo-shaped fields → local UUID/`server_id`.
7. Tests: export → wipe DB → import → deep-equal summary + sample txns + balances.

**Exit criteria**

- [ ] Restore from local JSON works offline.
- [ ] Corrupt/missing checksum rejected with clear error.
- [ ] v2.0 cloud export files still importable (compatibility test).

**Rollback:** Keep old API backup behind flag for cloud-primary users.

---

### Phase 5 — One-time cloud → local migration

**Goal:** Existing users pull once from Mongo into SQLite safely.

**Steps**

1. On first enable of local-first (or explicit “Download my data”):
   - Call enhanced export (or new `GET /sync/snapshot`) including **all Phase-1 entities** (extend backup beyond current 5 collections — see Appendix A).
2. Import into SQLite in one SQL transaction; set `server_id`, `dirty = 0`.
3. Persist `migration_completed_at` + cloud `exportedAt` in meta table.
4. Idempotent: if already migrated, skip unless “Force re-download” (destructive confirm).
5. Backend: extend export to include parties (minimum); document deferred entities.
6. QA: user with 1k+ txns migrates; balances match server reconciliation endpoint.

**Exit criteria**

- [ ] Migrated balances match `/api/reconciliation` (or equivalent) within rounding rules.
- [ ] Re-running migration does not duplicate rows.
- [ ] Failure mid-migration leaves DB empty or previous state — not half-applied (transaction).

**Rollback:** Clear local DB + flag off; user continues on API.

---

### Phase 6 — Incremental sync API (optional cloud)

**Goal:** Periodic push/pull without full backup each time.

**Steps**

1. Backend new routes (auth required), e.g.:
   - `POST /api/sync/handshake` → `{ serverTime, minSchemaVersion }`
   - `POST /api/sync/push` → body: `{ changes: [...] }` → apply with `client_request_id` / `server_id` upsert; return accepted/rejected
   - `GET /api/sync/pull?since=ISO&scope=` → changes newer than cursor
   - `POST /api/sync/ack` → confirm pull cursor
2. Mongo models: ensure every synced entity has `updatedAt`, soft delete field aligned with local `deleted_at`.
3. Mobile sync engine `mobile/sync/engine.ts`:
   - Mutex: only one sync at a time
   - Steps: handshake → push dirty → pull → apply → ack → clear dirty
   - Crash-safe: store `sync_run_id` + stage in meta; resume or retry cleanly
4. Schedule:
   - Manual “Sync now”
   - Background: on foreground + every N hours (configurable; default 6–12h) when Wi‑Fi / unmetered if desired — implemented in `mobile/sync/scheduler.ts` (6h + AppState active)
   - After K local mutations (optional)
5. Conflict application per §2.4; surface “Sync issue” in Settings with last error.
6. Rate limit sync endpoints; payload size caps; batch (e.g. 500 rows).
7. Tests: two devices interleaved edits; offline queue then sync; duplicate push idempotent.

**Exit criteria**

- [x] Sync disabled → no sync network calls (scheduler + engine gate on `CLOUD_SYNC_ENABLED`).
- [ ] Sync enabled → Mongo reflects local within one successful run (**requires Vercel deploy of `/sync`**).
- [ ] Mongo emptied → device push recreates data (or documented restore-from-Drive path).
- [ ] Mid-sync kill → next run does not corrupt or duplicate.
- [x] Foreground / interval scheduler present.
- [x] Account/Category `meta_data.client_id` + server LWW on push; client honors `rejected[]`.
- [x] Transfer delete soft-marks transfer (`meta_data.deleted_at`) + linked txs.

**Rollback:** `CLOUD_SYNC_ENABLED=false`; local + Drive still safe.

---

### Phase 7 — Google Drive dated snapshots

**Goal:** Automatic, dated, restorable backups on Drive (user’s storage).

**Steps**

1. Google Cloud project: OAuth client (iOS + Android + Expo redirect); Drive scope `drive.file` (app-created files only).
2. Mobile: auth session for Google; store tokens in SecureStore — `expo-auth-session` + paste-token fallback (`drive-auth.ts`).
3. Upload pipeline:
   - Build local backup v3 + `manifest.json`
   - Create folder tree `HisabBoi/backups/{scope}/{date}/`
   - Upload; store `drive_file_id` + local checksum in meta
4. Retention: keep last N days (e.g. 30) or last N files; optional “pin” backup.
5. Restore UI: list remote manifests by date → download → checksum → `importLocalBackup(replace)`.
6. Schedule: daily + before risky ops (optional) + after successful migration.
7. Fallback: if Drive auth unavailable, keep share-sheet + local auto-backup (already Phase 4). Settings separates Device backups vs Drive API.
8. Privacy copy in Settings: “Backups stay in your Google account; we don’t host them.”

**Exit criteria**

- [x] Auto upload creates dated folder + valid restore (requires Connect Drive first) — daily scheduler + manual upload + retention (30).
- [x] Settings UX: no duplicate export/restore; Device backups ≠ Drive API.
- [x] Tampered file fails checksum on Drive restore.
- [x] Restore UI: pick dated Drive backup after Google auth.
- [x] Works when Mongo is down (Drive path independent of `/sync`).
- [x] Physical-device QA: Sign in with Google + Upload dated backup (Debug build on iPhone).
- [ ] Physical-device QA: Restore from Drive on wipe/fresh install.

**Rollback:** Disable Drive flag; local files + share sheet remain.

---

### Phase 8 — Hardening, security, production cutover

**Goal:** Production readiness without known classes of issues.

**Steps**

1. **Security**
   - Encrypt local DB at rest if library supports (SQLCipher / Op-SQLite encryption) — strongly recommended for cash data.
   - Biometric gate already exists; ensure restore + Drive connect require auth.
   - Never log PII/transaction amounts in production logs.
2. **Clock skew:** handshake uses server time; clamp local `updated_at` if skewed beyond threshold.
3. **Attachments:** local-first saves receipt images/PDFs under app documents (`attachments/`) with ImagePicker compression; metadata in `attachments_json`. Drive JSON still excludes binary media (zip later).
4. **Storage pressure:** warn when device free space low before backup.
5. **Feature flag rollout:** internal dogfood → TestFlight/Play internal → % rollout → default on for new installs; existing users opt-in “Switch to on-device storage.”
6. **Support playbooks:** restore from Drive; reset local DB; force re-migrate; disable sync.
7. **Monitoring:** client events `sync_success`, `sync_fail`, `backup_fail`, `migration_fail` (privacy-safe).
8. **Docs:** update root `README.md` with local-first mode, Drive setup, env vars.
9. **Performance:** indexes review; vacuum/analyze schedule; large import progress UI.
10. **Legal:** backup/export data handling in privacy policy if you ship publicly.

**Implemented in code (this phase)**

- [x] Privacy-safe `trackLfEvent` (`sync_*`, `backup_*`, `migration_*`, `drive_*`) — no amounts/PII.
- [x] Sync handshake stores clock offset; push clamps far-future `updated_at` (`MAX_CLOCK_SKEW_MS`).
- [x] Weekly `VACUUM` / `ANALYZE` on warm (`maybeVacuumLocalDb`).
- [x] Low free-space confirm before device + Drive backups.
- [x] Device biometrics/passcode gate for restore, Drive connect, re-migrate.
- [x] Attachments: v1 JSON/Drive excludes large media (documented in README).
- [x] Support playbook: `docs/LOCAL_FIRST_SUPPORT.md`; root README local-first section.
- [x] Offline-first reads when LF on (ignore org + cloud toggle for UI); wait for flags before React Query.
- [x] Daily local-day job: Mongo sync + Drive backup after midnight when app is active.
- [ ] Deploy backend `/api/sync/*` to production (currently 404 on Vercel) — **blocks multi-device Mongo sync**.
- [ ] SQLCipher / encrypted DB — **deferred** (`USE_SQLCIPHER = false` for Expo Go); enable on production/dev build before public cutover.
- [ ] Privacy policy legal copy — product/legal when shipping publicly.
- [ ] Physical-device QA matrix (§5) sign-off.

**Exit criteria**

- [ ] All §0 success criteria checked.
- [ ] QA checklist (§5) completed on iOS + Android physical devices.
- [ ] Rollback plan tested once (flag off / cloud-primary still works for non-migrated).

---

### Phase 9 — Org multi-user (later; do not block v1)

**Out of scope for first production local-first release** unless product requires it.

Options when ready:

1. Keep org ledgers **cloud-primary** (current API).
2. Or: single “book owner” device is authority; members online-only.
3. Or: full CRDT / operational transform (high cost — avoid until needed).

---

## 4. Backend changes checklist (by phase)

| Phase | Backend work |
|-------|----------------|
| 0–3 | None required (or minimal logging) |
| 4 | Optional: accept backup v3 on import for cloud-primary users |
| 5 | Extend `/backup/export` (or `/sync/snapshot`) to include parties (+ agreed entities) |
| 6 | New `/api/sync/*` routes, indexes on `updatedAt`, soft-delete alignment, rate limits |
| 7 | None (Drive is client ↔ Google) |
| 8 | Sync metrics / admin health if desired |

Keep existing CRUD APIs until Mode C and non-migrated users are retired.

---

## 5. Testing & QA matrix

### 5.1 Automated (minimum)

- [ ] Migration 001…N apply cleanly; upgrade from N-1
- [ ] SQL transaction atomicity on multi-table writes
- [ ] Backup export/import round-trip + checksum
- [ ] v2.0 → v3.0 import compatibility
- [ ] Sync push idempotency (`client_request_id`)
- [x] Sync conflict LWW cases (table-driven)
- [ ] Dirty flag cleared only after ack

### 5.2 Manual device QA

| Case | Pass? |
|------|-------|
| Airplane mode full day of entries | |
| Force-quit during save | |
| Force-quit during sync | |
| Two devices same account, edit different txns | |
| Two devices edit same txn | |
| Migrate from existing cloud account | |
| Restore Drive backup on new install | |
| Mongo unreachable; app usable; Drive backup still runs | |
| Low storage warning | |
| Flag off after dogfood (non-migrated user) | |

### 5.3 Data correctness

- [ ] Reconciliation: sum(transactions) == account balances for all accounts
- [ ] Transfer creates linked debit+credit and both sides match
- [ ] Soft-deleted txn excluded from balances
- [ ] Party balances consistent after sync

---

## 6. Risk register

| Risk | Mitigation |
|------|------------|
| Dual source of truth bugs | Single DAL; flag; no mixed reads |
| Duplicate txns after sync | `client_request_id` + unique indexes local & server |
| Clock skew conflicts | Server time handshake |
| Incomplete backup (missing parties) | Extend export before migration Phase 5 |
| User thinks Drive is automatic today | Explicit OAuth + status “Last backup: …” |
| Org cashiers offline diverge | Defer Mode C; show “Online required for org” |
| Encrypted DB + forgotten unlock | Document recovery = Drive restore only |
| Large JSON OOM | Stream/zip; raise limits carefully; cap records like current 100k |
| Expo Go native ABI mismatch | Keep `react-native`, `react-native-reanimated`, `react-native-worklets` pinned to the set the installed Expo Go build ships; do not run `expo install --check --fix` while testing on Expo Go |

### Dependency pinning note (Expo Go)

Installing `expo-sqlite` via `npx expo install` also bumped `expo` 57.0.8→57.0.9,
`react-native` 0.86.0→0.86.2, `react-native-reanimated` 4.5.0→4.5.1 and
`react-native-worklets` 0.10.0→0.10.1. The Expo Go build on the simulator is
57.0.5 and links the older worklets native library, so the newer JS crashed the
app with `SIGSEGV` inside `JSIWorkletsModuleProxy::toOptimizedObject`
(bad access on a NaN-boxed HermesValue) right after the bundle finished loading.

Keep those four packages at the versions Expo Go was built against. `expo-sqlite`
and `expo-crypto` are pinned exactly (`57.0.1`) for the same reason. Version
upgrades belong to a development-build task, not the Expo Go workflow.

---

## 7. Suggested implementation order (tickets)

Use one PR per bullet when possible (reviewable, revertible):

1. `chore: branch + feature flags + docs pointer`
2. `feat(db): sqlite schema migrations + account/category repos`
3. `feat(db): transaction/transfer/party repos + balance updates`
4. `feat(data): DAL + local writes behind LOCAL_FIRST_ENABLED`
5. `feat(data): local reads for personal dashboard/lists`
6. `feat(backup): local v3 export/import + auto-backup`
7. `feat(migrate): cloud snapshot → local one-shot`
8. `feat(api): sync handshake/push/pull/ack`
9. `feat(sync): mobile sync engine + settings UI`
10. `feat(drive): OAuth + dated upload/list/restore`
11. `chore: encryption, QA, README, rollout flags` — hardening scaffold landed; SQLCipher + physical QA remain

---

## 8. How to start (when ready)

```bash
git checkout main
git pull origin main
git checkout -b feat/local-first-sync
```

Then open Phase 0 checklist and complete only Phase 0 in the first PR.

**Do not** implement Drive or sync before local CRUD + local backup round-trip — that order prevents “synced garbage” and undrestorable states.

---

## Appendix A — Entity inventory (fill during Phase 0)

| Entity | Local v1 | In backup v3 | Sync v1 | Notes |
|--------|----------|--------------|---------|-------|
| Account | ✅ | ✅ | ✅ | |
| Category | ✅ | ✅ | ✅ | |
| Transaction | ✅ | ✅ | ✅ | |
| Transfer | ✅ | ✅ | ✅ | |
| Party | ✅ | ✅ | ✅ | Must add to server export |
| BalanceSnapshot | optional | optional | optional | Can recompute |
| Organization (meta) | read cache | optional | later | |
| Org members | ❌ | ❌ | ❌ | Cloud |
| Invoice | ❌ defer | ❌ | ❌ | |
| Product / Stock | ❌ defer | ❌ | ❌ | |
| Collection schemes | ❌ defer | ❌ | ❌ | |
| Attachments / files | local files | zip later | later | |
| Auth / tokens | SecureStore | ❌ | N/A | |

---

## Appendix B — Sync change record shape (draft)

```json
{
  "entity": "transaction",
  "id": "uuid",
  "server_id": "64f...",
  "op": "upsert",
  "updated_at": "2026-08-03T07:00:00.000Z",
  "deleted_at": null,
  "device_id": "…",
  "client_request_id": "…",
  "payload": { }
}
```

---

## Appendix C — Settings UX (minimum)

- Storage: On-device (Local-first) — On/Off + migration CTA  
- Cloud sync: On/Off + Sync now + Last synced + Last error  
- Backup: Last local backup · Backup now · Restore from file  
- Google Drive: Connect · Last Drive backup · Restore from Drive · Retention  

---

## Document history

| Date | Change |
|------|--------|
| 2026-08-03 | Initial production plan from architecture discussion |
| 2026-08-03 | Phase 8 hardening scaffold (telemetry, clock skew, vacuum, storage/biometric gates, docs) |
| 2026-08-03 | Drive OAuth+upload verified on device; sync LWW/client_id; Drive path observability; more pure tests |

---

**Owner:** Engineering  
**Review before Phase 1:** Product (Mode A/B/C), Security (DB encryption + Drive scopes), QA (matrix §5)
