# Local-first implementation notes

Branch: `feat/local-first-sync`

## How to try it (safe — flags default OFF)

1. Run backend + mobile as usual (cloud mode unchanged).
2. Open **Settings → On-device storage**.
3. Enable **Use on-device database**.
4. Tap **Migrate from cloud** (personal data).
5. Optionally enable **Cloud sync** / **Google Drive backups**.

Org-shared books stay on the API in v1.

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

## Remaining hardening (Phase 8)

- [ ] SQLCipher / DB encryption at rest
- [ ] Full Expo AuthSession Google connect button
- [ ] Background sync scheduler (foreground + interval)
- [ ] Account-detail / category hooks fully on DAL when local-first
- [ ] Device QA matrix in production plan §5
