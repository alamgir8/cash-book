# Local-First Entity Inventory (Phase 0)

Agreed scope for v1. Keep org multi-user on cloud API until Phase 9.

| Entity | Local v1 | Backup v3 | Sync v1 | Notes |
|--------|----------|-----------|---------|-------|
| Account | ✅ | ✅ | ✅ | Personal scope first |
| Category | ✅ | ✅ | ✅ | |
| Transaction | ✅ | ✅ | ✅ | Soft delete via `deleted_at` |
| Transfer | ✅ | ✅ | ✅ | Links debit/credit txn ids |
| Party | ✅ | ✅ | ✅ | Server export must include parties |
| BalanceSnapshot | optional | optional | optional | Recomputable |
| Meta / sync cursors | ✅ | ❌ | N/A | Local only |
| Sync conflicts log | ✅ | ❌ | N/A | Local support log |
| Organization (meta) | read cache later | optional | later | Mode C deferred |
| Org members | ❌ | ❌ | ❌ | Cloud-primary |
| Invoice | ❌ | ❌ | ❌ | Deferred |
| Product / Stock | ❌ | ❌ | ❌ | Deferred |
| Collection schemes | ❌ | ❌ | ❌ | Deferred |
| Attachments | local files later | zip later | later | Not in JSON v3 body |
| Auth tokens | SecureStore | ❌ | N/A | |

**DB library decision:** `expo-sqlite` (SDK 57 async API).
