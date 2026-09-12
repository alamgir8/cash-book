import { api, baseURL } from "@/lib/api";
import { getDb } from "@/db/client";
import { META_KEYS, getMeta, setMeta } from "@/db/meta";
import { LOCAL_SCHEMA_VERSION } from "@/db/types";
import { isCloudSyncEnabled } from "@/lib/local-first/flags";
import { resolveLastWriteWins } from "@/lib/local-first/conflicts";
import { createLocalId, nowIso } from "@/lib/local-first/ids";
import { applyServerTime, clampUpdatedAt } from "@/lib/local-first/clock";
import {
  errorCodeFromUnknown,
  trackLfEvent,
} from "@/lib/local-first/telemetry";
import { getOrCreateDeviceId } from "@/services/device";
import { recalculateBalances } from "@/db/balances";
import * as accountsRepo from "@/db/repos/accounts";
import * as categoriesRepo from "@/db/repos/categories";
import * as partiesRepo from "@/db/repos/parties";
import * as transactionsRepo from "@/db/repos/transactions";
import * as transfersRepo from "@/db/repos/transfers";
import type {
  LocalAccount,
  LocalCategory,
  LocalInvoice,
  LocalParty,
  LocalProduct,
  LocalStockMovement,
  LocalTransaction,
  LocalTransfer,
} from "@/db/types";

export type SyncChange = {
  entity:
    | "account"
    | "category"
    | "party"
    | "transaction"
    | "transfer"
    // Shop entities (Phase 13). Pushed parents-first: products → invoices →
    // movements, so server-side references resolve inside one batch.
    | "product"
    | "invoice"
    | "stock_movement";
  id: string;
  server_id: string | null;
  op: "upsert" | "delete";
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
  client_request_id: string | null;
  payload: Record<string, unknown>;
};

/** Local table backing each sync entity (single source of truth). */
const TABLE_FOR_ENTITY: Record<SyncChange["entity"], string> = {
  account: "accounts",
  category: "categories",
  party: "parties",
  transaction: "transactions",
  transfer: "transfers",
  product: "products",
  invoice: "invoices",
  stock_movement: "inventory_movements",
};

function tableForEntity(entity: SyncChange["entity"]): string {
  return TABLE_FOR_ENTITY[entity];
}

/** Shared in-flight sync — callers join instead of "already running". */
let syncInFlight: Promise<SyncResult> | null = null;
/** Migrate / wipe holds this so sync cannot race the local DB. */
let syncPaused = false;

const MAX_SYNC_WALL_MS = 3 * 60 * 1000;

export function isSyncPaused(): boolean {
  return syncPaused;
}

/** Block new sync cycles (migrate / wipe). Does not cancel the current one. */
export function setSyncPaused(paused: boolean): void {
  syncPaused = paused;
}

/** Wait for the current cycle (if any), then keep sync paused. */
export async function pauseSyncForMaintenance(
  waitMs = 60_000,
): Promise<void> {
  syncPaused = true;
  if (!syncInFlight) return;
  await Promise.race([
    syncInFlight.then(() => undefined).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, waitMs)),
  ]);
}

/** Look up Mongo server_id for a local UUID (or pass through if already server id). */
async function lookupServerId(
  db: Awaited<ReturnType<typeof getDb>>,
  table: "accounts" | "categories" | "parties" | "products" | "transactions",
  localOrServerId: string | null | undefined,
): Promise<string | null> {
  if (!localOrServerId) return null;
  const row = await db.getFirstAsync<{ server_id: string | null; id: string }>(
    `SELECT id, server_id FROM ${table}
     WHERE (id = ? OR server_id = ?) AND deleted_at IS NULL LIMIT 1`,
    localOrServerId,
    localOrServerId,
  );
  return row?.server_id ?? null;
}

/**
 * Offline rows store local UUIDs in FK columns. The server resolveRefId needs
 * either a Mongo ObjectId or meta_data.client_id — migrated cloud accounts
 * usually have neither mapped to the local UUID. Attach *_server_id hints so
 * push can resolve "Account reference not found" failures.
 */
async function enrichTransactionPayload(
  db: Awaited<ReturnType<typeof getDb>>,
  row: LocalTransaction,
): Promise<Record<string, unknown>> {
  const payload = { ...(row as unknown as Record<string, unknown>) };
  const accountServerId = await lookupServerId(db, "accounts", row.account_id);
  if (accountServerId) payload.account_server_id = accountServerId;
  const categoryServerId = await lookupServerId(
    db,
    "categories",
    row.category_id,
  );
  if (categoryServerId) payload.category_server_id = categoryServerId;
  const partyServerId = await lookupServerId(db, "parties", row.party_id);
  if (partyServerId) payload.party_server_id = partyServerId;
  const forPartyServerId = await lookupServerId(
    db,
    "parties",
    row.for_party_id,
  );
  if (forPartyServerId) payload.for_party_server_id = forPartyServerId;
  if (row.parent_due_id) {
    const parentServerId = await lookupServerId(
      db,
      "transactions",
      row.parent_due_id,
    );
    if (parentServerId) payload.parent_due_server_id = parentServerId;
  }
  return payload;
}

async function enrichTransferPayload(
  db: Awaited<ReturnType<typeof getDb>>,
  row: LocalTransfer,
): Promise<Record<string, unknown>> {
  const payload = { ...(row as unknown as Record<string, unknown>) };
  const fromServer = await lookupServerId(db, "accounts", row.from_account_id);
  if (fromServer) payload.from_account_server_id = fromServer;
  const toServer = await lookupServerId(db, "accounts", row.to_account_id);
  if (toServer) payload.to_account_server_id = toServer;
  return payload;
}

/**
 * Collect dirty rows only (not the whole DB). Cap the *total* batch at
 * `limit` so we never exceed the server's MAX_PUSH_CHANGES (500).
 * Parent entities first so FKs resolve inside one push.
 */
async function collectDirtyChanges(limit = 500): Promise<SyncChange[]> {
  const db = await getDb();
  const changes: SyncChange[] = [];
  let remaining = Math.max(0, limit);

  const takeRows = async <T>(
    sql: string,
    map: (row: T) => SyncChange | Promise<SyncChange>,
  ) => {
    if (remaining <= 0) return;
    const rows = await db.getAllAsync<T>(sql, remaining);
    for (const row of rows) {
      if (remaining <= 0) break;
      changes.push(await map(row));
      remaining -= 1;
    }
  };

  await takeRows<LocalAccount>(
    `SELECT * FROM accounts WHERE dirty = 1 ORDER BY updated_at ASC LIMIT ?`,
    (row) => ({
      entity: "account",
      id: row.id,
      server_id: row.server_id,
      op: row.deleted_at ? "delete" : "upsert",
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      device_id: row.device_id,
      client_request_id: row.client_request_id,
      payload: row as unknown as Record<string, unknown>,
    }),
  );

  await takeRows<LocalCategory>(
    `SELECT * FROM categories WHERE dirty = 1 ORDER BY updated_at ASC LIMIT ?`,
    (row) => ({
      entity: "category",
      id: row.id,
      server_id: row.server_id,
      op: row.deleted_at ? "delete" : "upsert",
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      device_id: row.device_id,
      client_request_id: row.client_request_id,
      payload: row as unknown as Record<string, unknown>,
    }),
  );

  await takeRows<LocalParty>(
    `SELECT * FROM parties WHERE dirty = 1 ORDER BY updated_at ASC LIMIT ?`,
    (row) => ({
      entity: "party",
      id: row.id,
      server_id: row.server_id,
      op: row.deleted_at ? "delete" : "upsert",
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      device_id: row.device_id,
      client_request_id: row.client_request_id,
      payload: row as unknown as Record<string, unknown>,
    }),
  );

  if (remaining > 0) {
    const txns = await transactionsRepo.listDirtyTransactions(db, remaining);
    for (const row of txns) {
      if (remaining <= 0) break;
      changes.push({
        entity: "transaction",
        id: row.id,
        server_id: row.server_id,
        op: row.deleted_at ? "delete" : "upsert",
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
        device_id: row.device_id,
        client_request_id: row.client_request_id,
        payload: await enrichTransactionPayload(db, row),
      });
      remaining -= 1;
    }
  }

  await takeRows<LocalTransfer>(
    `SELECT * FROM transfers WHERE dirty = 1 ORDER BY updated_at ASC LIMIT ?`,
    async (row) => ({
      entity: "transfer",
      id: row.id,
      server_id: row.server_id,
      op: row.deleted_at ? "delete" : "upsert",
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      device_id: row.device_id,
      client_request_id: row.client_request_id,
      payload: await enrichTransferPayload(db, row),
    }),
  );

  // ── Shop entities (Phase 13) ─────────────────────────────────────────────
  // Order matters: products before invoices/movements so the server can resolve
  // references inside a single batch. The backend treats an invoice push as
  // side-effect free, so stock/cash are never double-counted.

  await takeRows<LocalProduct>(
    `SELECT * FROM products WHERE dirty = 1 ORDER BY updated_at ASC LIMIT ?`,
    (row) => ({
      entity: "product",
      id: row.id,
      server_id: row.server_id,
      op: row.deleted_at ? "delete" : "upsert",
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      device_id: row.device_id,
      client_request_id: row.client_request_id,
      payload: row as unknown as Record<string, unknown>,
    }),
  );

  if (remaining > 0) {
    const invoices = await db.getAllAsync<LocalInvoice>(
      `SELECT * FROM invoices WHERE dirty = 1 ORDER BY updated_at ASC LIMIT ?`,
      remaining,
    );
    for (const row of invoices) {
      if (remaining <= 0) break;
      const items = await db.getAllAsync<any>(
        `SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY rowid ASC`,
        row.id,
      );
      const payments = await db.getAllAsync<any>(
        `SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY rowid ASC`,
        row.id,
      );
      const enrichedItems = [];
      for (const item of items) {
        let productServerId: string | null = null;
        if (item.product_id) {
          const p = await db.getFirstAsync<{ server_id: string | null }>(
            `SELECT server_id FROM products WHERE id = ?`,
            item.product_id,
          );
          productServerId = p?.server_id ?? null;
        }
        enrichedItems.push({ ...item, product_server_id: productServerId });
      }

      changes.push({
        entity: "invoice",
        id: row.id,
        server_id: row.server_id,
        op: row.deleted_at ? "delete" : "upsert",
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
        device_id: row.device_id,
        client_request_id: row.client_request_id,
        payload: {
          ...(row as unknown as Record<string, unknown>),
          items: enrichedItems,
          payments,
        },
      });
      remaining -= 1;
    }
  }

  await takeRows<LocalStockMovement>(
    `SELECT * FROM inventory_movements WHERE dirty = 1 ORDER BY created_at ASC LIMIT ?`,
    (row) => ({
      entity: "stock_movement",
      id: row.id,
      server_id: row.server_id,
      op: row.deleted_at ? "delete" : "upsert",
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      device_id: row.device_id,
      client_request_id: row.client_request_id,
      payload: row as unknown as Record<string, unknown>,
    }),
  );

  return changes;
}

/** Server MAX_PUSH_CHANGES — keep client batches at or under this. */
const MAX_PUSH_BATCH = 500;
/** Cap rounds so a huge dirty flood cannot loop forever in one cycle. */
const MAX_PUSH_ROUNDS = 40;

async function markClean(
  entity: SyncChange["entity"],
  id: string,
  serverId?: string | null,
) {
  const db = await getDb();
  const table = tableForEntity(entity);
  if (serverId) {
    await db.runAsync(
      `UPDATE ${table} SET dirty = 0, sync_status = 'synced',
        retry_count = 0, last_sync_error = NULL, server_id = ? WHERE id = ?`,
      serverId,
      id,
    );
  } else {
    await db.runAsync(
      `UPDATE ${table} SET dirty = 0, sync_status = 'synced',
        retry_count = 0, last_sync_error = NULL WHERE id = ?`,
      id,
    );
  }
}

async function applyIncoming(change: SyncChange) {
  const db = await getDb();
  const payload = change.payload as any;

  // Prefer local UUID id; fall back to row with matching server_id
  let existing =
    change.entity === "account"
      ? await accountsRepo.getAccountById(db, change.id)
      : change.entity === "category"
        ? await categoriesRepo.getCategoryById(db, change.id)
        : change.entity === "party"
          ? await partiesRepo.getPartyById(db, change.id)
          : change.entity === "transaction"
            ? await transactionsRepo.getTransactionById(db, change.id)
            : change.entity === "transfer"
              ? await transfersRepo.getTransferById(db, change.id)
              : null;

  // Shop rows: resolve by local id first, then server id.
  if (!existing && change.entity === "product") {
    existing = await db.getFirstAsync<any>(
      `SELECT * FROM products WHERE id = ? OR server_id = ? LIMIT 1`,
      change.id,
      change.server_id ?? change.id,
    );
  }
  if (!existing && change.entity === "invoice") {
    existing = await db.getFirstAsync<any>(
      `SELECT * FROM invoices WHERE id = ? OR server_id = ? LIMIT 1`,
      change.id,
      change.server_id ?? change.id,
    );
  }
  if (!existing && change.entity === "stock_movement") {
    existing = await db.getFirstAsync<any>(
      `SELECT * FROM inventory_movements WHERE id = ? OR server_id = ? LIMIT 1`,
      change.id,
      change.server_id ?? change.id,
    );
  }

  if (!existing && change.server_id) {
    const table = tableForEntity(change.entity);
    existing = await db.getFirstAsync<any>(
      `SELECT * FROM ${table} WHERE server_id = ? OR id = ? LIMIT 1`,
      change.server_id,
      change.server_id,
    );
  }

  const localId = existing?.id || change.id || payload.id || change.server_id;
  if (payload && localId) {
    payload.id = localId;
    if (change.server_id) payload.server_id = change.server_id;
  }

  if (existing) {
    const decision = resolveLastWriteWins(
      {
        id: existing.id,
        updated_at: existing.updated_at,
        deleted_at: existing.deleted_at,
        device_id: existing.device_id,
      },
      {
        id: change.id,
        updated_at: change.updated_at,
        deleted_at: change.deleted_at,
        device_id: change.device_id,
      },
    );

    if (decision.winner === "existing") {
      // Still restore a missing opening from cloud — LWW must not leave
      // opening_balance stuck at 0 while Mongo has the real opening.
      if (
        change.entity === "account" &&
        payload?.opening_balance != null &&
        Math.abs(Number(existing.opening_balance) || 0) < 0.0001 &&
        Math.abs(Number(payload.opening_balance)) > 0.0001
      ) {
        // Opening only when Mongo has a real opening. Wallet cash is aligned
        // afterward via reconcileAccountOpeningsFromCloud (current − paidNet).
        await db.runAsync(
          `UPDATE accounts SET opening_balance = ? WHERE id = ?`,
          Number(payload.opening_balance),
          existing.id,
        );
      }
      await db.runAsync(
        `INSERT INTO sync_conflicts (id, entity, entity_id, existing_json, incoming_json, decision, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        await createLocalId(),
        change.entity,
        change.id,
        JSON.stringify(existing),
        JSON.stringify(change),
        decision.reason,
        nowIso(),
      );
      return;
    }
  }

  const row = { ...payload, dirty: 0 };
  if (change.entity === "account") await accountsRepo.upsertAccountFromSync(db, row);
  if (change.entity === "category")
    await categoriesRepo.upsertCategoryFromSync(db, row);
  if (change.entity === "party") await partiesRepo.upsertPartyFromSync(db, row);
  if (change.entity === "transaction")
    await transactionsRepo.upsertTransactionFromSync(db, row);
  if (change.entity === "transfer")
    await transfersRepo.upsertTransferFromSync(db, row);

  // Shop entities (Phase 13). Pulled rows are written with dirty = 0.
  if (change.entity === "product") {
    const { upsertProductFromSync } = await import("@/db/repos/products");
    await upsertProductFromSync(db, row as any);
  }
  if (change.entity === "stock_movement") {
    const { upsertMovementFromSync } = await import(
      "@/db/repos/stock-movements"
    );
    await upsertMovementFromSync(db, row as any);
  }
  if (change.entity === "invoice") {
    const invoicesRepo = await import("@/db/repos/invoices");
    const invoiceRow = { ...row } as any;
    const items = Array.isArray(invoiceRow.items) ? invoiceRow.items : [];
    const payments = Array.isArray(invoiceRow.payments)
      ? invoiceRow.payments
      : [];
    delete invoiceRow.items;
    delete invoiceRow.payments;
    await invoicesRepo.upsertInvoiceFromSync(db, invoiceRow);
    // Replace child rows so a re-pull cannot duplicate them.
    await db.runAsync(
      `DELETE FROM invoice_items WHERE invoice_id = ?`,
      invoiceRow.id,
    );
    await db.runAsync(
      `DELETE FROM invoice_payments WHERE invoice_id = ?`,
      invoiceRow.id,
    );
    for (const it of items) {
      // The server sends the Mongo product id; the local column must hold the
      // LOCAL product id, or product links/stock lookups break after a pull.
      let localProductId: string | null = null;
      if (it.product_id || it.product_server_id) {
        const local = await db.getFirstAsync<{ id: string }>(
          `SELECT id FROM products WHERE server_id = ? OR id = ? LIMIT 1`,
          it.product_server_id ?? it.product_id,
          it.product_server_id ?? it.product_id,
        );
        localProductId = local?.id ?? null;
      }
      await invoicesRepo.upsertInvoiceItemFromSync(db, {
        ...it,
        id: it.id ? String(it.id) : `${invoiceRow.id}:item:${items.indexOf(it)}`,
        invoice_id: invoiceRow.id,
        product_id: localProductId,
      });
    }
    for (const p of payments) {
      await invoicesRepo.upsertInvoicePaymentFromSync(db, {
        ...p,
        id: p.id
          ? String(p.id)
          : `${invoiceRow.id}:pay:${payments.indexOf(p)}`,
        invoice_id: invoiceRow.id,
      });
    }
  }

  // Ensure pull-applied rows are marked synced (INSERT defaults are pending_*).
  if (localId) {
    await markClean(change.entity, localId, change.server_id ?? null);
  }
}

export type SyncResult = {
  ok: boolean;
  pushed: number;
  pulled: number;
  serverTime?: string;
  error?: string;
};

/**
 * Crash-safe sync: handshake → push → pull → ack → recalculate.
 * Concurrent callers share one in-flight promise (no "already running" toast).
 */
export async function runSync(): Promise<SyncResult> {
  if (!isCloudSyncEnabled()) {
    return { ok: false, pushed: 0, pulled: 0, error: "Cloud sync disabled" };
  }
  if (syncPaused) {
    return {
      ok: false,
      pushed: 0,
      pulled: 0,
      error: "Sync paused while migrating — try again in a moment",
    };
  }
  if (syncInFlight) return syncInFlight;

  const run = (async (): Promise<SyncResult> => {
  const db = await getDb();
  const runId = await createLocalId();
  let watchdog: ReturnType<typeof setTimeout> | null = null;

  try {
    watchdog = setTimeout(() => {
      console.warn("[sync] wall-clock budget exceeded — cycle may be stuck");
    }, MAX_SYNC_WALL_MS);
    await setMeta(db, META_KEYS.SYNC_RUN_ID, runId);
    await setMeta(db, META_KEYS.SYNC_STAGE, "handshake");

    const device_id = await getOrCreateDeviceId();
    const { data: handshake } = await api.post<{
      serverTime: string;
      minSchemaVersion: number;
    }>(
      "/sync/handshake",
      {
        device_id,
        schemaVersion: LOCAL_SCHEMA_VERSION,
      },
      { timeout: 30000 },
    );

    if (handshake.minSchemaVersion > LOCAL_SCHEMA_VERSION) {
      throw new Error("App update required before sync");
    }

    const offsetMs = applyServerTime(handshake.serverTime);
    await setMeta(db, META_KEYS.CLOCK_OFFSET_MS, String(offsetMs));

    await setMeta(db, META_KEYS.SYNC_STAGE, "push");
    // Dirty rows only — push in ≤500 batches until the outbox is drained
    // (or we hit the round cap). Never uploads the whole SQLite file.
    let acceptedTotal = 0;
    const rejectedAll: Array<{ id: string; reason: string }> = [];
    for (let round = 0; round < MAX_PUSH_ROUNDS; round++) {
      const dirty = await collectDirtyChanges(MAX_PUSH_BATCH);
      if (!dirty.length) break;

      const changes = dirty.map((c) => ({
        ...c,
        updated_at: clampUpdatedAt(c.updated_at, handshake.serverTime),
        deleted_at: c.deleted_at
          ? clampUpdatedAt(c.deleted_at, handshake.serverTime)
          : null,
      }));
      const { data: pushResult } = await api.post<{
        accepted: Array<{ id: string; server_id?: string }>;
        rejected: Array<{ id: string; reason: string }>;
      }>(
        "/sync/push",
        { changes, device_id },
        { timeout: 60000 },
      );

      const accepted = pushResult.accepted ?? [];
      const rejected = pushResult.rejected ?? [];
      acceptedTotal += accepted.length;

      for (const a of accepted) {
        const match = changes.find((c) => c.id === a.id);
        if (match) await markClean(match.entity, a.id, a.server_id ?? null);
      }

      if (rejected.length) {
        rejectedAll.push(...rejected);
        for (const r of rejected) {
          const match = changes.find((c) => c.id === r.id);
          if (!match) continue;
          const table = tableForEntity(match.entity);
          await db.runAsync(
            `UPDATE ${table} SET sync_status = 'failed',
              retry_count = retry_count + 1,
              last_sync_error = ?
             WHERE id = ?`,
            r.reason || "rejected",
            r.id,
          );
        }
      }

      // No progress this round — stop to avoid spinning on permanent rejects.
      if (accepted.length === 0) break;
      // Partial batch means more dirty may remain; continue looping.
      if (dirty.length < MAX_PUSH_BATCH && rejected.length === 0) break;
    }

    if (rejectedAll.length) {
      const sample = rejectedAll
        .slice(0, 3)
        .map((r) => `${r.id}: ${r.reason}`)
        .join("; ");
      await setMeta(
        db,
        META_KEYS.LAST_SYNC_ERROR,
        `${rejectedAll.length} push rejected — ${sample}`,
      );
    }

    const rejected = rejectedAll;
    const pushedCount = acceptedTotal;

    await setMeta(db, META_KEYS.SYNC_STAGE, "pull");
    // Scope v2: personal + organization books. Reset cursor once so org rows
    // created before the last personal-only sync are not skipped.
    // Do NOT mark scope version until ack succeeds — failed full pulls must retry.
    const scopeVersion = await getMeta(db, META_KEYS.SYNC_SCOPE_VERSION);
    const upgradingScope = scopeVersion !== "2";
    if (upgradingScope) {
      await setMeta(db, META_KEYS.LAST_SYNC_CURSOR, "1970-01-01T00:00:00.000Z");
    }
    const since =
      (await getMeta(db, META_KEYS.LAST_SYNC_CURSOR)) ||
      "1970-01-01T00:00:00.000Z";
    // Full historical pulls of org + personal can exceed 30s on LAN.
    const { data: pull } = await api.get<{
      changes: SyncChange[];
      cursor: string;
    }>("/sync/pull", {
      params: { since, scope: "all" },
      timeout: 120000,
    });

    for (const change of pull.changes ?? []) {
      await applyIncoming(change);
    }

    await setMeta(db, META_KEYS.SYNC_STAGE, "ack");
    await api.post(
      "/sync/ack",
      { cursor: pull.cursor, run_id: runId },
      { timeout: 30000 },
    );
    await setMeta(db, META_KEYS.LAST_SYNC_CURSOR, pull.cursor);
    await setMeta(db, META_KEYS.LAST_SYNC_AT, handshake.serverTime);
    if (upgradingScope) {
      await setMeta(db, META_KEYS.SYNC_SCOPE_VERSION, "2");
    }
    if (!rejected.length) {
      await setMeta(db, META_KEYS.LAST_SYNC_ERROR, null);
    }
    await setMeta(db, META_KEYS.SYNC_STAGE, "done");

    // Restore openings then rewrite Balance-after (delta sync never uploads
    // the whole DB — this is local math only).
    if (pushedCount > 0 || (pull.changes?.length ?? 0) > 0) {
      try {
        const { reconcileAccountOpeningsFromCloud } = await import(
          "@/lib/local-first/reconcile-account-openings"
        );
        await reconcileAccountOpeningsFromCloud(db);
      } catch (e) {
        if (__DEV__) console.warn("[sync] opening reconcile skipped", e);
      }
      try {
        await recalculateBalances(db, { allOrganizations: true });
      } catch (e) {
        console.warn("[sync] balance recalc skipped", e);
      }
    }

    // Settings/profile writes live outside the sync entity enum — push them
    // on the same cycle so an offline save lands as soon as we're reachable.
    try {
      const { flushPendingOps } = await import(
        "@/lib/local-first/settings-sync"
      );
      await flushPendingOps();
    } catch (e) {
      if (__DEV__) console.warn("[sync] settings flush skipped", e);
    }

    // Shop stock is rebuildable from movements — keep the cache consistent.
    try {
      const { recalculateProductStock } = await import("@/db/stock");
      await recalculateProductStock(db, { allOrganizations: true });
    } catch (e) {
      if (__DEV__) console.warn("[sync] product stock reconcile skipped", e);
    }

    const pushed = pushedCount;
    const pulled = pull.changes?.length ?? 0;

    if (rejected.length) {
      void trackLfEvent("sync_fail", {
        code: "push_partial",
        count: rejected.length,
        count2: pushed,
      });
      const sample = rejected
        .slice(0, 2)
        .map((r) => r.reason)
        .filter(Boolean)
        .join("; ");
      return {
        ok: false,
        pushed,
        pulled,
        serverTime: handshake.serverTime,
        error: sample
          ? `${rejected.length} change(s) rejected: ${sample}`
          : `${rejected.length} change(s) rejected — will retry`,
      };
    }

    void trackLfEvent("sync_success", { count: pushed, count2: pulled });

    return {
      ok: true,
      pushed,
      pulled,
      serverTime: handshake.serverTime,
    };
  } catch (e: any) {
    const status = e?.response?.status;
    const raw = e?.response?.data?.message || e?.message || "Sync failed";
    const notDeployed =
      status === 404 || /resource not found/i.test(String(raw));
    const isTimeout =
      e?.code === "ECONNABORTED" || /timeout/i.test(String(raw));
    const isNetwork =
      !e?.response &&
      (/network error/i.test(String(raw)) || e?.code === "ERR_NETWORK");
    const message = notDeployed
      ? "Cloud sync API not on this server yet (deploy backend /sync routes)"
      : status === 401 || status === 403
        ? "Session expired — sign in again, then tap Sync"
        : isTimeout
          ? `Sync timed out talking to ${baseURL}. Large first sync can take a minute — tap Sync now again.`
          : isNetwork
            ? `Cannot reach API at ${baseURL}. Check Wi‑Fi / EXPO_PUBLIC_BASE_URL and that the backend is running.`
            : String(raw);
    await setMeta(db, META_KEYS.LAST_SYNC_ERROR, message);
    // 404 is expected until production deploys /sync — don't spam telemetry/console.
    if (!notDeployed) {
      void trackLfEvent("sync_fail", { code: errorCodeFromUnknown(e) });
      if (__DEV__) console.warn("[sync]", message);
    }
    return { ok: false, pushed: 0, pulled: 0, error: message };
  } finally {
    if (watchdog) clearTimeout(watchdog);
  }
  })();

  syncInFlight = run;
  void run.finally(() => {
    if (syncInFlight === run) syncInFlight = null;
  });
  return run;
}

export async function getSyncStatus() {
  const db = await getDb();
  return {
    lastSyncAt: await getMeta(db, META_KEYS.LAST_SYNC_AT),
    lastError: await getMeta(db, META_KEYS.LAST_SYNC_ERROR),
    stage: await getMeta(db, META_KEYS.SYNC_STAGE),
    cursor: await getMeta(db, META_KEYS.LAST_SYNC_CURSOR),
  };
}
