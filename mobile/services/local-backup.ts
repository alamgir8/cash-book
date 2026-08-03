import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { getDb, wipeAllLedgerData, wipeLedgerData } from "@/db/client";
import { LOCAL_SCHEMA_VERSION } from "@/db/types";
import * as accountsRepo from "@/db/repos/accounts";
import * as categoriesRepo from "@/db/repos/categories";
import * as partiesRepo from "@/db/repos/parties";
import * as transactionsRepo from "@/db/repos/transactions";
import * as transfersRepo from "@/db/repos/transfers";
import { META_KEYS, setMeta } from "@/db/meta";
import { checksumForData, verifyChecksum } from "@/lib/local-first/checksum";
import { upsertAccountFromSync } from "@/db/repos/accounts";
import { upsertCategoryFromSync } from "@/db/repos/categories";
import { upsertPartyFromSync } from "@/db/repos/parties";
import { upsertTransactionFromSync } from "@/db/repos/transactions";
import { upsertTransferFromSync } from "@/db/repos/transfers";
import type {
  LocalAccount,
  LocalCategory,
  LocalParty,
  LocalTransaction,
  LocalTransfer,
} from "@/db/types";

export const BACKUP_FORMAT = "hisabboi-backup";
export const BACKUP_VERSION = "3.0";

export type BackupV3 = {
  format: typeof BACKUP_FORMAT;
  version: string;
  schemaVersion: number;
  exportedAt: string;
  scope: { type: "personal" | "organization" | "all"; id: string | null };
  checksum: string;
  data: {
    accounts: LocalAccount[];
    categories: LocalCategory[];
    parties: LocalParty[];
    transactions: LocalTransaction[];
    transfers: LocalTransfer[];
  };
  summary: {
    accountsCount: number;
    categoriesCount: number;
    partiesCount: number;
    transactionsCount: number;
    transfersCount: number;
    totalBalance: number;
  };
};

export type BackupManifest = {
  format: typeof BACKUP_FORMAT;
  version: string;
  schemaVersion: number;
  exportedAt: string;
  checksum: string;
  fileName: string;
  byteSize: number;
  summary: BackupV3["summary"];
};

export async function exportLocalBackup(opts?: {
  /** When set, export only that org (or personal if null). Default: entire device DB. */
  organizationId?: string | null;
  /** @deprecated Use omit organizationId for full export. */
  allScopes?: boolean;
}): Promise<BackupV3> {
  const db = await getDb();
  const include = { includeArchived: true, includeDeleted: true };
  // Drive / share backups must include every org + personal. Scoped export
  // only when the caller passes organizationId explicitly (including null).
  const scoped = opts != null && "organizationId" in opts;
  const scope = scoped
    ? { organizationId: opts!.organizationId ?? null }
    : null;

  let accounts: LocalAccount[];
  let categories: LocalCategory[];
  let parties: LocalParty[];
  let transactions: LocalTransaction[];
  let transfers: LocalTransfer[];

  if (scope) {
    accounts = await accountsRepo.listAccounts(db, scope, include);
    categories = await categoriesRepo.listCategories(db, scope, include);
    parties = await partiesRepo.listParties(db, scope, include);
    transactions = await db.getAllAsync<LocalTransaction>(
      scope.organizationId
        ? `SELECT * FROM transactions WHERE organization_id = ?`
        : `SELECT * FROM transactions WHERE organization_id IS NULL OR organization_id = ''`,
      ...(scope.organizationId ? [scope.organizationId] : []),
    );
    transfers = await transfersRepo.listTransfers(db, scope, {
      includeDeleted: true,
    });
  } else {
    accounts = await db.getAllAsync<LocalAccount>(`SELECT * FROM accounts`);
    categories = await db.getAllAsync<LocalCategory>(`SELECT * FROM categories`);
    parties = await db.getAllAsync<LocalParty>(`SELECT * FROM parties`);
    transactions = await db.getAllAsync<LocalTransaction>(
      `SELECT * FROM transactions`,
    );
    transfers = await db.getAllAsync<LocalTransfer>(`SELECT * FROM transfers`);
  }

  const data = { accounts, categories, parties, transactions, transfers };
  // Round-trip so checksum matches JSON downloaded later from Drive/disk.
  const dataForChecksum = JSON.parse(JSON.stringify(data));
  const checksum = await checksumForData(dataForChecksum);
  const totalBalance = accounts
    .filter((a) => !a.deleted_at)
    .reduce((s, a) => s + Number(a.current_balance || 0), 0);

  const backup: BackupV3 = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    schemaVersion: LOCAL_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    scope: {
      type: scope
        ? scope.organizationId
          ? "organization"
          : "personal"
        : "all",
      id: scope?.organizationId ?? null,
    },
    checksum,
    data,
    summary: {
      accountsCount: accounts.length,
      categoriesCount: categories.length,
      partiesCount: parties.length,
      transactionsCount: transactions.length,
      transfersCount: transfers.length,
      totalBalance,
    },
  };

  await setMeta(db, META_KEYS.LAST_LOCAL_BACKUP_AT, backup.exportedAt);
  return backup;
}

export async function writeBackupToDocumentDir(
  backup: BackupV3,
): Promise<{ uri: string; fileName: string; manifest: BackupManifest }> {
  const stamp = backup.exportedAt.replace(/[:.]/g, "-");
  const fileName = `hisabboi-backup-${stamp}.json`;
  const file = new File(Paths.document, fileName);
  const body = JSON.stringify(backup, null, 2);
  await file.write(body);

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: backup.version,
    schemaVersion: backup.schemaVersion,
    exportedAt: backup.exportedAt,
    checksum: backup.checksum,
    fileName,
    byteSize: body.length,
    summary: backup.summary,
  };
  const manifestFile = new File(Paths.document, `manifest-${stamp}.json`);
  await manifestFile.write(JSON.stringify(manifest, null, 2));

  return { uri: file.uri, fileName, manifest };
}

export async function exportAndShareLocalBackup(): Promise<string> {
  const backup = await exportLocalBackup();
  const { uri, fileName } = await writeBackupToDocumentDir(backup);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/json",
      dialogTitle: "Save Hisab Boi Backup",
      UTI: "public.json",
    });
  }
  return fileName;
}

function isBackupV3(raw: any): raw is BackupV3 {
  return (
    raw &&
    (raw.format === BACKUP_FORMAT || raw.version === "3.0") &&
    raw.data &&
    typeof raw.checksum === "string"
  );
}

function isBackupV2(raw: any): boolean {
  return raw && raw.version && raw.data && !raw.checksum;
}

/**
 * Import backup. mode=replace wipes personal (or org) scope first.
 */
export async function importLocalBackup(
  raw: unknown,
  opts?: {
    mode?: "replace" | "merge";
    organizationId?: string | null;
    /** Wipe personal + all orgs (cloud migrate / full Drive restore). */
    wipeAll?: boolean;
    /** When true, skip checksum (used after Drive download already validated / legacy files). */
    skipChecksum?: boolean;
  },
): Promise<BackupV3["summary"]> {
  const mode = opts?.mode ?? "replace";
  const organizationId = opts?.organizationId ?? null;
  const wipeAll = Boolean(opts?.wipeAll);
  const db = await getDb();

  let accounts: any[] = [];
  let categories: any[] = [];
  let parties: any[] = [];
  let transactions: any[] = [];
  let transfers: any[] = [];

  if (isBackupV3(raw as any)) {
    const backup = raw as BackupV3;
    if (!opts?.skipChecksum) {
      const ok = await verifyChecksum(backup.data, backup.checksum);
      if (!ok) {
        // Older uploads can fail canonicalize round-trip — still import, warn.
        console.warn(
          "[backup] checksum mismatch — importing anyway (re-upload recommended)",
        );
      }
    }
    if (backup.schemaVersion > LOCAL_SCHEMA_VERSION) {
      throw new Error(
        `Backup schema ${backup.schemaVersion} is newer than this app (${LOCAL_SCHEMA_VERSION}). Update the app first.`,
      );
    }
    ({ accounts, categories, parties, transactions, transfers } = backup.data);
  } else if (isBackupV2(raw)) {
    const data = (raw as any).data;
    accounts = (data.accounts ?? []).map(mapV2Account);
    categories = (data.categories ?? []).map(mapV2Category);
    parties = (data.parties ?? []).map(mapV2Party);
    transactions = (data.transactions ?? []).map(mapV2Transaction);
    transfers = (data.transfers ?? []).map(mapV2Transfer);
  } else {
    throw new Error("Unrecognized backup format");
  }

  await db.withTransactionAsync(async () => {
    if (mode === "replace") {
      if (wipeAll) {
        await wipeAllLedgerData(db);
      } else {
        await wipeLedgerData(db, organizationId);
      }
    }

    for (const a of accounts) {
      await upsertAccountFromSync(db, normalizeAccountRow(a, organizationId));
    }
    for (const c of categories) {
      await upsertCategoryFromSync(db, normalizeCategoryRow(c, organizationId));
    }
    for (const p of parties) {
      await upsertPartyFromSync(db, normalizePartyRow(p, organizationId));
    }
    for (const t of transactions) {
      await upsertTransactionFromSync(
        db,
        normalizeTransactionRow(t, organizationId),
      );
    }
    for (const t of transfers) {
      await upsertTransferFromSync(db, normalizeTransferRow(t, organizationId));
    }

  });

  // Fix dues/loans that arrived with wrong payment_status or category type,
  // then recompute cash balances (paid only — dues excluded, like Mongo).
  await setMeta(db, META_KEYS.LEDGER_REPAIR_VERSION, null);
  const {
    repairLocalLedgerSemantics,
    LEDGER_REPAIR_VERSION,
  } = await import("@/lib/local-first/repair-ledger");
  await repairLocalLedgerSemantics(db);
  await setMeta(db, META_KEYS.LEDGER_REPAIR_VERSION, LEDGER_REPAIR_VERSION);

  const liveAccounts = wipeAll
    ? await db.getAllAsync<{ current_balance: number }>(
        `SELECT current_balance FROM accounts WHERE deleted_at IS NULL`,
      )
    : await accountsRepo.listAccounts(db, { organizationId });
  return {
    accountsCount: accounts.length,
    categoriesCount: categories.length,
    partiesCount: parties.length,
    transactionsCount: transactions.length,
    transfersCount: transfers.length,
    totalBalance: liveAccounts.reduce(
      (s, a) => s + Number(a.current_balance || 0),
      0,
    ),
  };
}

export async function importBackupFromPicker(): Promise<BackupV3["summary"]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) {
    throw new Error("No file selected");
  }
  const file = new File(result.assets[0].uri);
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON backup file");
  }
  return importLocalBackup(parsed, { mode: "replace" });
}

function idOf(row: any): string {
  return String(row.id || row._id || row._originalId);
}

function serverIdOf(row: any): string | null {
  if (row.server_id) return String(row.server_id);
  if (row._id) return String(row._id);
  if (row._originalId) return String(row._originalId);
  return null;
}

function orgIdOf(row: any): string | null {
  const v =
    row.organization_id ??
    row.organization?._id ??
    row.organization ??
    row._originalOrganizationId ??
    null;
  return v != null && v !== "" ? String(v) : null;
}

function mapV2Account(row: any): Partial<LocalAccount> {
  return {
    id: idOf(row),
    server_id: serverIdOf(row),
    name: row.name,
    description: row.description ?? null,
    kind: row.kind ?? "cash",
    opening_balance: Number(row.opening_balance ?? 0),
    current_balance: Number(row.current_balance ?? row.opening_balance ?? 0),
    currency_code: row.currency_code ?? null,
    currency_symbol: row.currency_symbol ?? null,
    archived: row.archived ? 1 : 0,
    archived_at: row.archived_at ?? null,
    created_at: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    updated_at: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
    deleted_at: null,
    dirty: 0,
    sync_version: 0,
    client_request_id: null,
    device_id: "migrate-v2",
    organization_id: orgIdOf(row),
  };
}

function mapV2Category(row: any): Partial<LocalCategory> {
  const type = inferCategoryType(row);
  const flow =
    row.flow ||
    (type === "loan_in" ||
    type === "income" ||
    type === "sell" ||
    type === "donation_in" ||
    type === "other_income" ||
    type === "adjustment_in"
      ? "credit"
      : "debit");
  return {
    id: idOf(row),
    server_id: serverIdOf(row),
    type,
    flow,
    name: row.name,
    description: row.description ?? null,
    color: row.color ?? null,
    archived: row.archived ? 1 : 0,
    archived_at: row.archived_at ?? null,
    created_at: row.createdAt ?? new Date().toISOString(),
    updated_at: row.updatedAt ?? new Date().toISOString(),
    deleted_at: null,
    dirty: 0,
    sync_version: 0,
    client_request_id: null,
    device_id: "migrate-v2",
    organization_id: orgIdOf(row),
  };
}

function mapV2Party(row: any): Partial<LocalParty> {
  return {
    id: idOf(row),
    server_id: serverIdOf(row),
    type: row.type ?? "customer",
    name: row.name,
    code: row.code ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    address_json: row.address ? JSON.stringify(row.address) : null,
    opening_balance: Number(row.opening_balance ?? 0),
    current_balance: Number(row.current_balance ?? 0),
    credit_limit: row.credit_limit ?? null,
    notes: row.notes ?? null,
    archived: row.archived ? 1 : 0,
    archived_at: row.archived_at ?? null,
    created_at: row.createdAt ?? new Date().toISOString(),
    updated_at: row.updatedAt ?? new Date().toISOString(),
    deleted_at: null,
    dirty: 0,
    sync_version: 0,
    client_request_id: null,
    device_id: "migrate-v2",
    organization_id: orgIdOf(row),
  };
}

function refId(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (c === undefined || c === null || c === "") continue;
    if (typeof c === "object" && c && "_id" in (c as object)) {
      const id = (c as { _id?: unknown })._id;
      if (id != null && id !== "") return String(id);
      continue;
    }
    return String(c);
  }
  return null;
}

function resolvePaymentStatus(row: any): "paid" | "due" {
  // Payments linked to a parent due are always paid.
  const parent = refId(row.parent_due_id, row._originalParentDueId);
  if (parent) return "paid";

  const remaining = row.due_remaining;
  const remainingNum =
    remaining != null && remaining !== "" ? Number(remaining) : null;

  // Trust explicit status from source (API / backup export).
  if (row.payment_status === "due") {
    // Settled / zero-remaining dues are cash-paid even if status lagged.
    if (row.due_settled_at) return "paid";
    if (remainingNum != null && remainingNum <= 0) return "paid";
    return "due";
  }
  if (row.payment_status === "paid") return "paid";

  // Infer from chain fields ONLY when payment_status was missing/empty.
  if (
    remainingNum != null &&
    remainingNum > 0 &&
    !row.due_settled_at
  ) {
    return "due";
  }

  return "paid";
}

function inferCategoryType(row: any): string {
  if (row.type && String(row.type).trim()) return String(row.type);
  const name = String(row.name || "").toLowerCase();
  if (name.includes("loan repayment paid")) return "loan_in";
  if (name.includes("loan repayment received")) return "loan_out";
  if (name.includes("loan given")) return "loan_out";
  if (name.includes("loan received")) return "loan_in";
  return row.flow === "credit" ? "income" : "expense";
}

function mapV2Transaction(row: any): Partial<LocalTransaction> {
  const accountId =
    refId(
      row.account_id,
      row.account,
      row._originalAccountId,
    ) || "";
  const categoryId = refId(
    row.category_id,
    row.category,
    row._originalCategoryId,
  );
  const partyId = refId(row.party_id, row.party, row._originalPartyId);
  const forPartyId = refId(
    row.for_party_id,
    row.for_party,
    row._originalForPartyId,
  );
  return {
    id: idOf(row),
    server_id: serverIdOf(row),
    organization_id: orgIdOf(row),
    account_id: accountId,
    category_id: categoryId,
    party_id: partyId,
    for_party_id: forPartyId,
    type: row.type,
    amount: Number(row.amount),
    date: new Date(row.date).toISOString(),
    description: row.description ?? null,
    keyword: row.keyword ?? row.comment ?? null,
    counterparty: row.counterparty ?? null,
    vendor: row.vendor ?? null,
    payment_status: resolvePaymentStatus(row),
    due_date: row.due_date ? new Date(row.due_date).toISOString() : null,
    due_group_id: refId(row.due_group_id, row._originalDueGroupId),
    parent_due_id: refId(row.parent_due_id, row._originalParentDueId),
    due_remaining:
      row.due_remaining != null && row.due_remaining !== ""
        ? Number(row.due_remaining)
        : null,
    due_settled_at: row.due_settled_at
      ? new Date(row.due_settled_at).toISOString()
      : null,
    meta_data_json: row.meta_data ? JSON.stringify(row.meta_data) : null,
    balance_after_transaction: row.balance_after_transaction ?? null,
    party_balance_after: row.party_balance_after ?? null,
    transfer_id: row.transfer_id ? String(row.transfer_id) : null,
    transfer_direction: row.transfer_direction ?? null,
    attachments_json: row.attachments
      ? JSON.stringify(row.attachments)
      : null,
    created_at: row.createdAt ?? new Date().toISOString(),
    updated_at: row.updatedAt ?? new Date().toISOString(),
    deleted_at: row.is_deleted
      ? row.deleted_at || new Date().toISOString()
      : null,
    dirty: 0,
    sync_version: 0,
    client_request_id: row.client_request_id ?? null,
    device_id: "migrate-v2",
  };
}

function mapV2Transfer(row: any): Partial<LocalTransfer> {
  return {
    id: idOf(row),
    server_id: serverIdOf(row),
    organization_id: orgIdOf(row),
    from_account_id: String(
      row.from_account_id ||
        row.from_account?._id ||
        row.from_account ||
        row._originalFromAccountId,
    ),
    to_account_id: String(
      row.to_account_id ||
        row.to_account?._id ||
        row.to_account ||
        row._originalToAccountId,
    ),
    amount: Number(row.amount),
    date: new Date(row.date).toISOString(),
    description: row.description ?? null,
    keyword: row.keyword ?? null,
    counterparty: row.counterparty ?? null,
    meta_data_json: row.meta_data ? JSON.stringify(row.meta_data) : null,
    debit_transaction_id: String(
      row.debit_transaction_id ||
        row.debit_transaction?._id ||
        row.debit_transaction ||
        row._originalDebitTransactionId,
    ),
    credit_transaction_id: String(
      row.credit_transaction_id ||
        row.credit_transaction?._id ||
        row.credit_transaction ||
        row._originalCreditTransactionId,
    ),
    created_at: row.createdAt ?? new Date().toISOString(),
    updated_at: row.updatedAt ?? new Date().toISOString(),
    deleted_at: null,
    dirty: 0,
    sync_version: 0,
    client_request_id: row.client_request_id ?? null,
    device_id: "migrate-v2",
  };
}

function normalizeAccountRow(
  row: any,
  organizationId: string | null,
): LocalAccount {
  const mapped = mapV2Account(row) as LocalAccount;
  return {
    ...mapped,
    organization_id: mapped.organization_id ?? organizationId ?? null,
    id: idOf(row),
  };
}

function normalizeCategoryRow(
  row: any,
  organizationId: string | null,
): LocalCategory {
  const mapped = mapV2Category(row) as LocalCategory;
  return {
    ...mapped,
    organization_id: mapped.organization_id ?? organizationId ?? null,
    id: idOf(row),
  };
}

function normalizePartyRow(
  row: any,
  organizationId: string | null,
): LocalParty {
  const mapped = mapV2Party(row) as LocalParty;
  return {
    ...mapped,
    organization_id: mapped.organization_id ?? organizationId ?? null,
    id: idOf(row),
  };
}

function normalizeTransactionRow(
  row: any,
  organizationId: string | null,
): LocalTransaction {
  // Always run through mapV2Transaction so party/for/vendor/keyword defaults apply
  // even when a partial LocalTransaction-shaped row is present.
  const mapped = mapV2Transaction(row) as LocalTransaction;
  const base = {
    ...mapped,
    ...(row.id || row.server_id
      ? {
          id: row.id ? String(row.id) : mapped.id,
          server_id: row.server_id ?? mapped.server_id,
          dirty: row.dirty ?? mapped.dirty,
          sync_version: row.sync_version ?? 0,
          device_id: row.device_id ?? mapped.device_id,
          created_at: row.created_at ?? mapped.created_at,
          updated_at: row.updated_at ?? mapped.updated_at,
          deleted_at:
            row.deleted_at !== undefined ? row.deleted_at : mapped.deleted_at,
          attachments_json:
            row.attachments_json ?? mapped.attachments_json,
          meta_data_json: row.meta_data_json ?? mapped.meta_data_json,
        }
      : {}),
  } as LocalTransaction;
  return {
    ...base,
    organization_id: base.organization_id ?? organizationId ?? null,
    id: idOf(row),
    payment_status: resolvePaymentStatus({ ...row, ...base }),
    description: base.description ?? null,
    keyword: base.keyword ?? null,
    vendor: base.vendor ?? null,
    counterparty: base.counterparty ?? null,
    due_remaining:
      base.due_remaining !== undefined && base.due_remaining !== null
        ? Number(base.due_remaining)
        : row.due_remaining != null
          ? Number(row.due_remaining)
          : null,
  };
}

function normalizeTransferRow(
  row: any,
  organizationId: string | null,
): LocalTransfer {
  const mapped = mapV2Transfer(row) as LocalTransfer;
  return {
    ...mapped,
    organization_id: mapped.organization_id ?? organizationId ?? null,
    id: idOf(row),
  };
}
