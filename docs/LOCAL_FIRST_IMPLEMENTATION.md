# Local-first implementation notes

Branch: `feat/local-first-sync`

## How to try it (physical iPhone / Debug)

Defaults: **on-device storage ON**, **cloud sync ON**, **dual-write OFF**.

1. Install a Debug / dev-client build (`npx expo run:ios --device`) — not Expo Go.
2. Point `mobile/.env.local` at production or your Mac LAN API, then restart Metro with `--clear`.
3. Sign in once while online.
4. Settings → On-device storage → **Migrate from cloud** (or **Re-download**) so SQLite is seeded. Until migrate finishes, Home/Accounts look empty.
5. Optional: enable Google Drive backups. Keep dual-write **OFF** for real offline use.

Cloud sync covers **personal + organization** ledger books (`/sync/pull?scope=all`). Shop / invoices / products stay online-only.

## Key paths

| Area | Path |
|------|------|
| Flags | `mobile/lib/local-first/flags.ts` |
| SQLite | `mobile/db/` |
| DAL | `mobile/data/` |
| Backup v3 | `mobile/services/local-backup.ts` |
| Migrate | `mobile/services/migrate-cloud.ts` |
| Sync engine | `mobile/sync/engine.ts` |
| Drive | `mobile/services/drive-backup.ts` |
| Settings UI | `mobile/components/settings/local-first-section.tsx` |
| Sync API | `backend/routes/sync.routes.js` |

## Tests

```bash
cd mobile && npm run test:local-first
```

## Drive OAuth

Store a Drive access token (scope `drive.file`) via `setDriveAccessToken` after Expo AuthSession. Client IDs belong in EAS secrets — not committed.

## Remaining hardening

- [ ] SQLCipher / DB encryption at rest
- [ ] Full Expo AuthSession Google connect button
- [ ] Offline invoices / products / schemes
- [ ] Device QA matrix in production plan §5
