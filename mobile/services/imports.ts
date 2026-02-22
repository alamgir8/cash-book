import { api } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportItem = {
  _id: string;
  row_index: number;
  date: string | null;
  description: string | null;
  counterparty: string | null;
  amount: number | null;
  type: "debit" | "credit";
  account_name?: string | null;
  notes?: string | null;
  account?: { _id: string; name: string; kind?: string } | string | null;
  category_id?: { _id: string; name: string; type: string } | string | null;
  party?: { _id: string; name: string; code?: string } | string | null;
  raw_date: string | null;
  raw_amount: string | null;
  raw_description: string | null;
  raw_counterparty: string | null;
  raw_type: string | null;
  raw_notes?: string | null;
  status: "pending" | "imported" | "skipped" | "failed";
  error_message?: string;
  transaction?: string;
};

export type ColumnMapping = {
  date?: string;
  description?: string;
  counterparty?: string;
  debit?: string;
  credit?: string;
  amount?: string;
  type?: string;
  balance?: string;
  notes?: string;
};

export type AccountColumnMapping = {
  column_name: string;
  account_id?: string;
};

export type ParseWarning = {
  code: string;
  title: string;
  message: string;
  suggestion?: string;
};

export type ImportRecord = {
  _id: string;
  original_filename: string;
  file_type: "pdf" | "xlsx" | "xls" | "csv";
  file_size?: number;
  import_mode: "standard" | "ledger";
  status:
    | "parsing"
    | "parsed"
    | "mapping"
    | "importing"
    | "completed"
    | "failed"
    | "cancelled";
  default_account?: { _id: string; name: string; kind?: string } | string;
  column_mapping?: ColumnMapping;
  account_columns?: AccountColumnMapping[];
  detected_columns?: string[];
  items: ImportItem[];
  total_rows: number;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  total_debit: number;
  total_credit: number;
  error_message?: string;
  parser_metadata?: Record<string, unknown>;
  parse_warnings?: ParseWarning[];
  createdAt: string;
  updatedAt?: string;
};

export type ImportListItem = Pick<
  ImportRecord,
  | "_id"
  | "original_filename"
  | "file_type"
  | "status"
  | "import_mode"
  | "total_rows"
  | "imported_count"
  | "failed_count"
  | "skipped_count"
  | "total_debit"
  | "total_credit"
  | "createdAt"
  | "default_account"
>;

export type ImportListResponse = {
  imports: ImportListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Upload and parse a file (PDF/XLSX/CSV).
 * Uses FormData for multipart upload.
 */
export const uploadAndParseFile = async (
  fileUri: string,
  fileName: string,
  fileMimeType: string,
  organizationId?: string,
  options?: {
    import_mode?: "auto" | "standard" | "ledger";
    default_type?: "credit" | "debit";
  },
): Promise<ImportRecord> => {
  const formData = new FormData();

  formData.append("file", {
    uri: fileUri,
    name: fileName,
    type: fileMimeType,
  } as any);

  if (organizationId) {
    formData.append("organization", organizationId);
  }

  if (options?.import_mode) {
    formData.append("import_mode", options.import_mode);
  }

  if (options?.default_type) {
    formData.append("default_type", options.default_type);
  }

  const { data } = await api.post("/imports/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 60000, // 60s for large files
  });

  return data.import;
};

/**
 * Get import details with all items.
 */
export const getImportDetail = async (
  importId: string,
): Promise<ImportRecord> => {
  const { data } = await api.get(`/imports/${importId}`);
  return data.import;
};

/**
 * List all imports.
 */
export const listImports = async (
  page = 1,
  limit = 20,
): Promise<ImportListResponse> => {
  const { data } = await api.get("/imports", {
    params: { page, limit },
  });
  return data;
};

/**
 * Update column mapping, default account, and account columns (ledger mode).
 */
export const updateImportMapping = async (
  importId: string,
  payload: {
    column_mapping?: ColumnMapping;
    default_account?: string;
    account_columns?: AccountColumnMapping[];
  },
): Promise<ImportRecord> => {
  const { data } = await api.put(`/imports/${importId}/mapping`, payload);
  return data.import;
};

/**
 * Update individual items.
 */
export const updateImportItems = async (
  importId: string,
  items: {
    itemId: string;
    account?: string;
    category_id?: string;
    party?: string;
    type?: "debit" | "credit";
    amount?: number;
    date?: string;
    description?: string;
    counterparty?: string;
    status?: "pending" | "skipped";
  }[],
): Promise<ImportRecord> => {
  const { data } = await api.put(`/imports/${importId}/items`, { items });
  return data.import;
};

/**
 * Execute the import (bulk create transactions).
 * For ledger mode, default_account is optional (uses account_columns mapping).
 */
export const executeImport = async (
  importId: string,
  payload: {
    default_account?: string;
    skip_duplicates?: boolean;
  },
): Promise<{
  import: ImportRecord;
  message: string;
}> => {
  const { data } = await api.post(`/imports/${importId}/execute`, payload, {
    timeout: 120000, // 2 minutes for large imports
  });
  return data;
};

/**
 * Delete an import record.
 */
export const deleteImportRecord = async (
  importId: string,
): Promise<{ message: string }> => {
  const { data } = await api.delete(`/imports/${importId}`);
  return data;
};
