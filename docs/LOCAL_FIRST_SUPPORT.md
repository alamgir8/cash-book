# Local-first support playbook

Quick runbook for dogfood / TestFlight support. Product flags live under **Settings → On-device storage**.

## Restore from Google Drive

1. User signs in to the app (same account that owned the data).
2. Settings → On-device storage → enable **Local-first** if off.
3. Connect Google Drive (Sign in with Google or paste token). Device auth is required.
4. **Restore from Drive (pick date)** → choose dated file → authenticate → confirm replace.
5. Home / Accounts should reload from SQLite. Balances recalculate after import.

If checksum fails: do not retry with a different file blindly — ask for the matching day’s backup or a device JSON share.

## Restore from device / shared JSON

1. Unlock restore mode in Settings (or local-first path).
2. Authenticate when prompted.
3. Pick a `hisabboi-backup-*.json` (v3) or legacy cloud export.
4. Confirm counts in the success toast.

## Reset local DB (empty phone ledger)

Use only when the user accepts data loss on device (Drive/cloud copy must exist).

Dev / support path:

```ts
import { deleteDatabaseFile } from "@/db/client";
import { setLocalFirstFlags } from "@/lib/local-first/flags";

await deleteDatabaseFile();
await setLocalFirstFlags({
  migrationCompletedAt: null,
  // leave localFirstEnabled as-is or turn off for cloud-primary rollback
});
```

Then **Migrate** again from cloud, or restore from Drive.

## Force re-migrate (cloud → local)

1. Settings → On-device storage → **Re-download from cloud** (destructive).
2. Device auth required when already migrated.
3. This replaces personal SQLite rows with `/backup/export` (+ parties).

## Disable sync / go offline-only

1. Turn **Cloud sync** OFF.
2. Turn **Dual-write** OFF (must be off for real offline).
3. Optional: turn **Drive backups** OFF to stop uploads (local auto-backup still works).

With sync off, personal ledger writes stay on device; Mongo is not updated for ledger rows. Pull-to-refresh uses SQLite (not Mongo) — even when Cloud sync is ON, the UI stays offline-first and sync runs in the background. If an **organization** is selected, v1 still shows **personal** on-device data and a banner — org multi-user remains cloud-primary (Phase 9).

**Daily auto jobs:** once per local calendar day (after midnight), when the app is opened/foregrounded: Mongo sync (if Cloud sync ON) and Drive dated backup (if Drive ON). iOS/Android cannot guarantee a true midnight wake while the app is killed; the job runs on next open and every 15 minutes while active.

Long-run without cloud sync: yes for personal books, as long as you keep **Drive** (or device) backups. Phone wipe without a backup cannot be recovered from Mongo if sync was never enabled.

## Rollback to cloud-primary (non-migrated / dogfood)

1. Turn **Local-first** OFF.
2. Lists go back to API. Users who already migrated keep SQLite data on disk until wiped — they should export/Drive first.
3. Do **not** treat flag-off as deleting Drive backups.

## Sync API missing (404)

Production must deploy backend `/api/sync/*` from this branch. Until then, Sync shows a friendly error and the scheduler backs off. Local CRUD and Drive still work.

Smoke after deploy (replace `TOKEN` with a logged-in Bearer JWT):

```bash
curl -sS -X POST https://cash-book-seven.vercel.app/api/sync/handshake \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"device_id":"smoke","schemaVersion":1}'
```

Expect JSON with `serverTime` (not 404 HTML).

## Drive upload succeeded but folder missing

1. Confirm toast shows a path like `HisabBoi/backups/...` (not only “Drive connected”).
2. Search Drive for `HisabBoi` or `hisabboi-backup`.
3. If Settings shows “insufficient … scopes”, disconnect Drive, add `drive.file` under Google Cloud → Data Access, sign in again.

## Common false alarms

| Symptom | Likely cause |
|---------|----------------|
| Empty Home after enabling local-first | Migrate not run yet |
| “Still hits network” | Dual-write still ON |
| Drive Sign-in fails in Expo Go | Use `expo run:ios` / Android dev build |
| Backup Now ≠ Drive | Device document dir only |

## Privacy-safe events

Client stores recent codes only (`sync_fail`, `backup_fail`, …) via `trackLfEvent` — no amounts or names. Useful for “what failed last?” without reading console PII.
