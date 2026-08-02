# Local SQLite (`mobile/db`)

Uses **expo-sqlite** (SDK 57) per [Expo docs](https://docs.expo.dev/versions/latest/sdk/sqlite/).

## Patterns we follow

| Topic | Approach |
|--------|----------|
| Open | `SQLite.openDatabaseAsync('hisabboi_local.db')` |
| Journal | `PRAGMA journal_mode = WAL` |
| FKs | `PRAGMA foreign_keys = ON` |
| Schema version | `PRAGMA user_version` (not a custom table) |
| Bulk DDL | `db.execAsync(multiStatementSql)` |
| Atomic writes | `withExclusiveTransactionAsync` via `withDbTransaction()` |
| Expo Go | Supported (do **not** enable SQLCipher — not in Expo Go) |
| Encryption | `USE_SQLCIPHER = false` until a dev/production build adopts SQLCipher / Op-SQLite |

## Dev tips

- DB file: `hisabboi_local.db`
- Open lazily with `getDb()` when local-first is used
- Reset: `await deleteDatabaseFile()`
- Inspector: Expo CLI → Shift+M → **Open expo-sqlite**
