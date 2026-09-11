/** Current local SQLite schema version (bump when adding migrations). */
export const LOCAL_SCHEMA_VERSION = 5;

export const DB_NAME = "hisabboi_local.db";

export type SyncStatus =
  | "pending_create"
  | "pending_update"
  | "pending_delete"
  | "synced"
  | "failed";

export type SyncableColumns = {
  id: string;
  server_id: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  dirty: number;
  /** Present after schema v2; optional for older in-memory payloads. */
  sync_status?: SyncStatus;
  retry_count?: number;
  last_sync_error?: string | null;
  sync_version: number;
  client_request_id: string | null;
  device_id: string;
};

export type LocalAccount = SyncableColumns & {
  name: string;
  description: string | null;
  kind: string;
  opening_balance: number;
  current_balance: number;
  currency_code: string | null;
  currency_symbol: string | null;
  archived: number;
  archived_at: string | null;
};

export type LocalCategory = SyncableColumns & {
  type: string;
  flow: string;
  name: string;
  description: string | null;
  color: string | null;
  archived: number;
  archived_at: string | null;
};

export type LocalParty = SyncableColumns & {
  type: string;
  name: string;
  code: string | null;
  phone: string | null;
  email: string | null;
  address_json: string | null;
  opening_balance: number;
  current_balance: number;
  credit_limit: number | null;
  notes: string | null;
  archived: number;
  archived_at: string | null;
};

export type LocalTransaction = SyncableColumns & {
  account_id: string;
  category_id: string | null;
  party_id: string | null;
  for_party_id: string | null;
  type: "debit" | "credit";
  amount: number;
  date: string;
  description: string | null;
  keyword: string | null;
  counterparty: string | null;
  vendor: string | null;
  payment_status: "paid" | "due";
  due_date: string | null;
  due_group_id: string | null;
  parent_due_id: string | null;
  due_remaining: number | null;
  due_settled_at: string | null;
  meta_data_json: string | null;
  balance_after_transaction: number | null;
  party_balance_after: number | null;
  transfer_id: string | null;
  transfer_direction: "outgoing" | "incoming" | null;
  attachments_json: string | null;
};

export type LocalTransfer = SyncableColumns & {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  date: string;
  description: string | null;
  keyword: string | null;
  counterparty: string | null;
  meta_data_json: string | null;
  debit_transaction_id: string;
  credit_transaction_id: string;
};

/**
 * Shop product (Phase 2). Mirrors `backend/models/Product.js` field names so
 * sync mapping stays trivial. `cost_price = purchase_price + additional_cost`.
 */
export type LocalProduct = SyncableColumns & {
  admin_id: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  category_id: string | null;
  brand: string | null;
  unit: string;
  image_uri: string | null;
  purchase_price: number;
  additional_cost: number;
  cost_price: number;
  sale_price: number;
  tax_rate: number;
  current_stock: number;
  opening_stock: number;
  low_stock_threshold: number;
  track_inventory: number;
  supplier_party_id: string | null;
  is_active: number;
  meta_data_json: string | null;
};

/** Stock movement audit row (foundation for Phase 4). */
export type LocalStockMovement = SyncableColumns & {
  product_id: string;
  admin_id: string | null;
  type:
    | "purchase"
    | "sale"
    | "purchase_return"
    | "sale_return"
    | "adjustment_in"
    | "adjustment_out"
    | "opening_stock";
  quantity: number;
  unit_cost: number;
  stock_after: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  date: string;
};

/**
 * Organization (= Shop) read cache. Keyed by the Mongo org id so it matches
 * `organization_id` on every ledger/shop row. Not a sync entity — it is a
 * refreshable mirror of the cloud org so shop settings work offline.
 */
export type LocalOrganization = {
  id: string;
  server_id: string | null;
  name: string;
  business_type: string | null;
  currency_code: string | null;
  currency_symbol: string | null;
  invoice_prefix: string | null;
  invoice_next_number: number;
  tax_rate: number;
  allow_negative_balance: number;
  role: string | null;
  permissions_json: string | null;
  settings_json: string | null;
  address_json: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

/** Invoice header (sale | purchase). Mirrors backend `Invoice` field names. */
export type LocalInvoice = SyncableColumns & {
  admin_id: string | null;
  invoice_number: string;
  /** Local-only sequence used to allocate `invoice_number` offline. */
  number_seq: number | null;
  type: "sale" | "purchase";
  status: "draft" | "pending" | "partial" | "paid" | "overdue" | "cancelled";
  party_id: string | null;
  party_name: string | null;
  party_phone: string | null;
  party_address: string | null;
  date: string;
  due_date: string | null;
  subtotal: number;
  total_discount: number;
  total_tax: number;
  shipping_charge: number;
  adjustment: number;
  adjustment_description: string | null;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  terms: string | null;
  internal_notes: string | null;
  linked_transaction_ids_json: string | null;
};

export type LocalInvoiceItem = {
  id: string;
  invoice_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  discount: number;
  discount_type: "fixed" | "percent";
  tax_rate: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  /** Cost basis captured at sale time — never recomputed from today's catalog. */
  unit_cost_at_sale: number | null;
  barcode_snapshot: string | null;
  category_id: string | null;
  notes: string | null;
  created_at: string;
};

export type LocalInvoicePayment = {
  id: string;
  invoice_id: string;
  date: string;
  amount: number;
  method: string | null;
  account_id: string | null;
  transaction_id: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

/**
 * Local mirror of server-owned settings that are NOT sync entities
 * (admin profile, preferences). Lets Settings save instantly offline.
 * NOTE: login PIN is never stored here — it is a credential.
 */
export type LocalSettingsCache = {
  key: string;
  value_json: string;
  updated_at: string;
  dirty: number;
  last_sync_error: string | null;
};

/**
 * Generic outbox for writes whose entities are outside the sync enum
 * (profile, organization). Flushed opportunistically when online.
 */
export type LocalPendingOp = {
  id: string;
  entity: "profile" | "organization" | "organization_create" | "organization_delete";
  entity_id: string | null;
  payload_json: string;
  created_at: string;
  attempts: number;
  last_error: string | null;
};

export type ScopeFilter = {
  organizationId?: string | null;
  /** When true, ignore organization_id and read the whole local ledger. */
  allOrganizations?: boolean;
  /**
   * When true with organizationId, also include personal rows
   * (NULL/empty organization_id) left behind by legacy migrate.
   */
  includePersonal?: boolean;
};
