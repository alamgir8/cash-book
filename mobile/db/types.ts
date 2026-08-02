/** Current local SQLite schema version (bump when adding migrations). */
export const LOCAL_SCHEMA_VERSION = 1;

export const DB_NAME = "hisabboi_local.db";

export type SyncableColumns = {
  id: string;
  server_id: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  dirty: number;
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

export type ScopeFilter = {
  organizationId?: string | null;
  /** When true, ignore organization_id and read the whole local ledger. */
  allOrganizations?: boolean;
};
