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

/**
 * Migration 003 — shop foundation (Phase 2).
 * - products: offline catalog with cost basis + org isolation.
 * - inventory_movements: audit foundation so stock never changes untracked.
 * - organizations: read cache of Google-free shop settings (prefix/currency/tax).
 *
 * Additive only. Never edit 001/002.
 */
export const MIGRATION_003_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  server_id TEXT,
  organization_id TEXT,
  admin_id TEXT,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  description TEXT,
  category_id TEXT,
  brand TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs',
  image_uri TEXT,
  purchase_price REAL NOT NULL DEFAULT 0,
  additional_cost REAL NOT NULL DEFAULT 0,
  cost_price REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  current_stock REAL NOT NULL DEFAULT 0,
  opening_stock REAL NOT NULL DEFAULT 0,
  low_stock_threshold REAL NOT NULL DEFAULT 0,
  track_inventory INTEGER NOT NULL DEFAULT 1,
  supplier_party_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  meta_data_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  sync_version INTEGER NOT NULL DEFAULT 0,
  client_request_id TEXT,
  device_id TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending_create',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_sync_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_dirty ON products(dirty);
CREATE INDEX IF NOT EXISTS idx_products_server ON products(server_id);
CREATE INDEX IF NOT EXISTS idx_products_updated ON products(updated_at);
CREATE INDEX IF NOT EXISTS idx_products_sync_status ON products(sync_status);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- Barcode nullable but unique per org when set (NULL org handled in repo code).
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_org_barcode
  ON products(organization_id, barcode)
  WHERE barcode IS NOT NULL AND barcode != '';

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY NOT NULL,
  server_id TEXT,
  organization_id TEXT,
  product_id TEXT NOT NULL,
  admin_id TEXT,
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL DEFAULT 0,
  stock_after REAL NOT NULL DEFAULT 0,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  sync_version INTEGER NOT NULL DEFAULT 0,
  client_request_id TEXT,
  device_id TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending_create',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_sync_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_movements_product_date ON inventory_movements(product_id, date);
CREATE INDEX IF NOT EXISTS idx_movements_org_date ON inventory_movements(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_movements_dirty ON inventory_movements(dirty);
CREATE INDEX IF NOT EXISTS idx_movements_server ON inventory_movements(server_id);
CREATE INDEX IF NOT EXISTS idx_movements_sync_status ON inventory_movements(sync_status);
-- Idempotency: a movement op key must never be applied twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_movements_client_req
  ON inventory_movements(client_request_id)
  WHERE client_request_id IS NOT NULL AND client_request_id != '';

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY NOT NULL,
  server_id TEXT,
  name TEXT NOT NULL,
  business_type TEXT,
  currency_code TEXT,
  currency_symbol TEXT,
  invoice_prefix TEXT,
  invoice_next_number INTEGER NOT NULL DEFAULT 1,
  tax_rate REAL NOT NULL DEFAULT 0,
  allow_negative_balance INTEGER NOT NULL DEFAULT 0,
  role TEXT,
  permissions_json TEXT,
  settings_json TEXT,
  address_json TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_organizations_updated ON organizations(updated_at);
`;

/**
 * Migration 004 — invoices (Phase 5).
 * Header + normalized items + payments so purchases/sales work offline with
 * stock, dues and linked ledger transactions.
 */
export const MIGRATION_004_SQL = `
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY NOT NULL,
  server_id TEXT,
  organization_id TEXT,
  admin_id TEXT,
  invoice_number TEXT NOT NULL,
  number_seq INTEGER,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  party_id TEXT,
  party_name TEXT,
  party_phone TEXT,
  party_address TEXT,
  date TEXT NOT NULL,
  due_date TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  total_discount REAL NOT NULL DEFAULT 0,
  total_tax REAL NOT NULL DEFAULT 0,
  shipping_charge REAL NOT NULL DEFAULT 0,
  adjustment REAL NOT NULL DEFAULT 0,
  adjustment_description TEXT,
  grand_total REAL NOT NULL DEFAULT 0,
  amount_paid REAL NOT NULL DEFAULT 0,
  balance_due REAL NOT NULL DEFAULT 0,
  notes TEXT,
  terms TEXT,
  internal_notes TEXT,
  linked_transaction_ids_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  sync_version INTEGER NOT NULL DEFAULT 0,
  client_request_id TEXT,
  device_id TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending_create',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_sync_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoices_org_date ON invoices(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_org_type_date ON invoices(organization_id, type, date);
CREATE INDEX IF NOT EXISTS idx_invoices_party ON invoices(party_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_dirty ON invoices(dirty);
CREATE INDEX IF NOT EXISTS idx_invoices_server ON invoices(server_id);
CREATE INDEX IF NOT EXISTS idx_invoices_sync_status ON invoices(sync_status);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_id TEXT NOT NULL,
  product_id TEXT,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT,
  unit_price REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  discount_type TEXT NOT NULL DEFAULT 'fixed',
  tax_rate REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  unit_cost_at_sale REAL,
  barcode_snapshot TEXT,
  category_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_id TEXT NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  method TEXT,
  account_id TEXT,
  transaction_id TEXT,
  reference TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
`;

/**
 * Migration 005 — offline settings (Phase: settings offline).
 * - settings_cache: local mirror of server-owned settings that are not sync
 *   entities (admin profile, preferences) so Settings saves offline.
 * - pending_ops: outbox for writes outside the sync entity enum
 *   (profile, organization). Flushed when the backend is reachable.
 */
export const MIGRATION_005_SQL = `
CREATE TABLE IF NOT EXISTS settings_cache (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0,
  last_sync_error TEXT
);

CREATE TABLE IF NOT EXISTS pending_ops (
  id TEXT PRIMARY KEY NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_ops_entity ON pending_ops(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_pending_ops_created ON pending_ops(created_at);
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
  {
    version: 3,
    name: "003_shop",
    sql: MIGRATION_003_SQL,
  },
  {
    version: 4,
    name: "004_invoices",
    sql: MIGRATION_004_SQL,
  },
  {
    version: 5,
    name: "005_offline_settings",
    sql: MIGRATION_005_SQL,
  },
];

export function getLatestSchemaVersion(): number {
  return LOCAL_SCHEMA_VERSION;
}
