import { LOCAL_SCHEMA_VERSION } from "../types";

/**
 * Migration 001 — core local-first ledger tables.
 * Applied via PRAGMA user_version (Expo SQLite docs pattern).
 * Never edit after merge; add 002_*.ts instead.
 */
export const MIGRATION_001_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  server_id TEXT,
  organization_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'cash',
  opening_balance REAL NOT NULL DEFAULT 0,
  current_balance REAL NOT NULL DEFAULT 0,
  currency_code TEXT,
  currency_symbol TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  sync_version INTEGER NOT NULL DEFAULT 0,
  client_request_id TEXT,
  device_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_accounts_org ON accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounts_dirty ON accounts(dirty);
CREATE INDEX IF NOT EXISTS idx_accounts_server ON accounts(server_id);
CREATE INDEX IF NOT EXISTS idx_accounts_updated ON accounts(updated_at);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  server_id TEXT,
  organization_id TEXT,
  type TEXT NOT NULL,
  flow TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  sync_version INTEGER NOT NULL DEFAULT 0,
  client_request_id TEXT,
  device_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_org ON categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_categories_dirty ON categories(dirty);
CREATE INDEX IF NOT EXISTS idx_categories_server ON categories(server_id);

CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY NOT NULL,
  server_id TEXT,
  organization_id TEXT,
  type TEXT NOT NULL DEFAULT 'customer',
  name TEXT NOT NULL,
  code TEXT,
  phone TEXT,
  email TEXT,
  address_json TEXT,
  opening_balance REAL NOT NULL DEFAULT 0,
  current_balance REAL NOT NULL DEFAULT 0,
  credit_limit REAL,
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  sync_version INTEGER NOT NULL DEFAULT 0,
  client_request_id TEXT,
  device_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_parties_org ON parties(organization_id);
CREATE INDEX IF NOT EXISTS idx_parties_dirty ON parties(dirty);
CREATE INDEX IF NOT EXISTS idx_parties_name ON parties(name);
CREATE INDEX IF NOT EXISTS idx_parties_server ON parties(server_id);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  server_id TEXT,
  organization_id TEXT,
  account_id TEXT NOT NULL,
  category_id TEXT,
  party_id TEXT,
  for_party_id TEXT,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  description TEXT,
  keyword TEXT,
  counterparty TEXT,
  vendor TEXT,
  payment_status TEXT NOT NULL DEFAULT 'paid',
  due_date TEXT,
  due_group_id TEXT,
  parent_due_id TEXT,
  due_remaining REAL,
  due_settled_at TEXT,
  meta_data_json TEXT,
  balance_after_transaction REAL,
  party_balance_after REAL,
  transfer_id TEXT,
  transfer_direction TEXT,
  attachments_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  sync_version INTEGER NOT NULL DEFAULT 0,
  client_request_id TEXT,
  device_id TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_tx_org_date ON transactions(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_tx_account_date ON transactions(account_id, date);
CREATE INDEX IF NOT EXISTS idx_tx_dirty ON transactions(dirty);
CREATE INDEX IF NOT EXISTS idx_tx_server ON transactions(server_id);
CREATE INDEX IF NOT EXISTS idx_tx_client_req ON transactions(client_request_id);
CREATE INDEX IF NOT EXISTS idx_tx_party ON transactions(party_id, date);
CREATE INDEX IF NOT EXISTS idx_tx_deleted ON transactions(deleted_at);

CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY NOT NULL,
  server_id TEXT,
  organization_id TEXT,
  from_account_id TEXT NOT NULL,
  to_account_id TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  description TEXT,
  keyword TEXT,
  counterparty TEXT,
  meta_data_json TEXT,
  debit_transaction_id TEXT NOT NULL,
  credit_transaction_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  sync_version INTEGER NOT NULL DEFAULT 0,
  client_request_id TEXT,
  device_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transfers_org_date ON transfers(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_transfers_dirty ON transfers(dirty);
CREATE INDEX IF NOT EXISTS idx_transfers_server ON transfers(server_id);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  existing_json TEXT NOT NULL,
  incoming_json TEXT NOT NULL,
  decision TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_entity ON sync_conflicts(entity, entity_id);
`;

export type Migration = {
  version: number;
  name: string;
  sql: string;
};

/**
 * Migration 002 — sync status / retry metadata + missing updated_at indexes.
 * Existing dirty rows are backfilled to pending_* / synced.
 */
export const MIGRATION_002_SQL = `
ALTER TABLE accounts ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending_create';
ALTER TABLE accounts ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN last_sync_error TEXT;

ALTER TABLE categories ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending_create';
ALTER TABLE categories ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN last_sync_error TEXT;

ALTER TABLE parties ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending_create';
ALTER TABLE parties ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE parties ADD COLUMN last_sync_error TEXT;

ALTER TABLE transactions ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending_create';
ALTER TABLE transactions ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN last_sync_error TEXT;

ALTER TABLE transfers ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending_create';
ALTER TABLE transfers ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE transfers ADD COLUMN last_sync_error TEXT;

UPDATE accounts SET sync_status = 'synced' WHERE dirty = 0;
UPDATE accounts SET sync_status = 'pending_delete' WHERE dirty = 1 AND deleted_at IS NOT NULL;
UPDATE accounts SET sync_status = 'pending_update' WHERE dirty = 1 AND deleted_at IS NULL AND server_id IS NOT NULL;
UPDATE accounts SET sync_status = 'pending_create' WHERE dirty = 1 AND deleted_at IS NULL AND (server_id IS NULL OR server_id = '');

UPDATE categories SET sync_status = 'synced' WHERE dirty = 0;
UPDATE categories SET sync_status = 'pending_delete' WHERE dirty = 1 AND deleted_at IS NOT NULL;
UPDATE categories SET sync_status = 'pending_update' WHERE dirty = 1 AND deleted_at IS NULL AND server_id IS NOT NULL;
UPDATE categories SET sync_status = 'pending_create' WHERE dirty = 1 AND deleted_at IS NULL AND (server_id IS NULL OR server_id = '');

UPDATE parties SET sync_status = 'synced' WHERE dirty = 0;
UPDATE parties SET sync_status = 'pending_delete' WHERE dirty = 1 AND deleted_at IS NOT NULL;
UPDATE parties SET sync_status = 'pending_update' WHERE dirty = 1 AND deleted_at IS NULL AND server_id IS NOT NULL;
UPDATE parties SET sync_status = 'pending_create' WHERE dirty = 1 AND deleted_at IS NULL AND (server_id IS NULL OR server_id = '');

UPDATE transactions SET sync_status = 'synced' WHERE dirty = 0;
UPDATE transactions SET sync_status = 'pending_delete' WHERE dirty = 1 AND deleted_at IS NOT NULL;
UPDATE transactions SET sync_status = 'pending_update' WHERE dirty = 1 AND deleted_at IS NULL AND server_id IS NOT NULL;
UPDATE transactions SET sync_status = 'pending_create' WHERE dirty = 1 AND deleted_at IS NULL AND (server_id IS NULL OR server_id = '');

UPDATE transfers SET sync_status = 'synced' WHERE dirty = 0;
UPDATE transfers SET sync_status = 'pending_delete' WHERE dirty = 1 AND deleted_at IS NOT NULL;
UPDATE transfers SET sync_status = 'pending_update' WHERE dirty = 1 AND deleted_at IS NULL AND server_id IS NOT NULL;
UPDATE transfers SET sync_status = 'pending_create' WHERE dirty = 1 AND deleted_at IS NULL AND (server_id IS NULL OR server_id = '');

CREATE INDEX IF NOT EXISTS idx_parties_updated ON parties(updated_at);
CREATE INDEX IF NOT EXISTS idx_tx_updated ON transactions(updated_at);
CREATE INDEX IF NOT EXISTS idx_transfers_updated ON transfers(updated_at);
CREATE INDEX IF NOT EXISTS idx_accounts_sync_status ON accounts(sync_status);
CREATE INDEX IF NOT EXISTS idx_categories_sync_status ON categories(sync_status);
CREATE INDEX IF NOT EXISTS idx_parties_sync_status ON parties(sync_status);
CREATE INDEX IF NOT EXISTS idx_tx_sync_status ON transactions(sync_status);
CREATE INDEX IF NOT EXISTS idx_transfers_sync_status ON transfers(sync_status);
`;

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "001_init",
    sql: MIGRATION_001_SQL,
  },
  {
    version: 2,
    name: "002_sync_status",
    sql: MIGRATION_002_SQL,
  },
];

export function getLatestSchemaVersion(): number {
  return LOCAL_SCHEMA_VERSION;
}
