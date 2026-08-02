import { api } from "@/lib/api";
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
  LocalParty,
  LocalTransaction,
  LocalTransfer,
} from "@/db/types";

export type SyncChange = {
  entity:
    | "account"
    | "category"
    | "party"
    | "transaction"
    | "transfer";
  id: string;
  server_id: string | null;
  op: "upsert" | "delete";
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
  client_request_id: string | null;
  payload: Record<string, unknown>;
};

let syncLock = false;

async function collectDirtyChanges(limit = 500): Promise<SyncChange[]> {
  const db = await getDb();
  const changes: SyncChange[] = [];

  const accounts = await db.getAllAsync<LocalAccount>(
    `SELECT * FROM accounts WHERE dirty = 1 ORDER BY updated_at ASC LIMIT ?`,
    limit,
  );
  for (const row of accounts) {
    changes.push({
      entity: "account",
      id: row.id,
      server_id: row.server_id,
      op: row.deleted_at ? "delete" : "upsert",
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      device_id: row.device_id,
      client_request_id: row.client_request_id,
      payload: row as unknown as Record<string, unknown>,
    });
  }

  const categories = await db.getAllAsync<LocalCategory>(
    `SELECT * FROM categories WHERE dirty = 1 ORDER BY updated_at ASC LIMIT ?`,
    limit,
  );
  for (const row of categories) {
    changes.push({
      entity: "category",
      id: row.id,
      server_id: row.server_id,
      op: row.deleted_at ? "delete" : "upsert",
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      device_id: row.device_id,
      client_request_id: row.client_request_id,
      payload: row as unknown as Record<string, unknown>,
    });
  }

  const parties = await db.getAllAsync<LocalParty>(
    `SELECT * FROM parties WHERE dirty = 1 ORDER BY updated_at ASC LIMIT ?`,
    limit,
  );
  for (const row of parties) {
    changes.push({
      entity: "party",
      id: row.id,
      server_id: row.server_id,
      op: row.deleted_at ? "delete" : "upsert",
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      device_id: row.device_id,
      client_request_id: row.client_request_id,
      payload: row as unknown as Record<string, unknown>,
    });
  }

  const txns = await transactionsRepo.listDirtyTransactions(db, limit);
  for (const row of txns) {
    changes.push({
      entity: "transaction",
      id: row.id,
      server_id: row.server_id,
      op: row.deleted_at ? "delete" : "upsert",
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      device_id: row.device_id,
      client_request_id: row.client_request_id,
      payload: row as unknown as Record<string, unknown>,
    });
  }

  const transfers = await db.getAllAsync<LocalTransfer>(
    `SELECT * FROM transfers WHERE dirty = 1 ORDER BY updated_at ASC LIMIT ?`,
    limit,
  );
  for (const row of transfers) {
    changes.push({
      entity: "transfer",
      id: row.id,
      server_id: row.server_id,
      op: row.deleted_at ? "delete" : "upsert",
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      device_id: row.device_id,
      client_request_id: row.client_request_id,
      payload: row as unknown as Record<string, unknown>,
    });
  }

  return changes;
}

async function markClean(
  entity: SyncChange["entity"],
  id: string,
  serverId?: string | null,
) {
  const db = await getDb();
  const table =
    entity === "account"
      ? "accounts"
      : entity === "category"
        ? "categories"
        : entity === "party"
          ? "parties"
          : entity === "transaction"
            ? "transactions"
            : "transfers";
  if (serverId) {
    await db.runAsync(
      `UPDATE ${table} SET dirty = 0, server_id = ? WHERE id = ?`,
      serverId,
      id,
    );
  } else {
    await db.runAsync(`UPDATE ${table} SET dirty = 0 WHERE id = ?`, id);
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
            : await transfersRepo.getTransferById(db, change.id);

  if (!existing && change.server_id) {
    const table =
      change.entity === "account"
        ? "accounts"
        : change.entity === "category"
          ? "categories"
          : change.entity === "party"
            ? "parties"
            : change.entity === "transaction"
              ? "transactions"
              : "transfers";
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
 */
export async function runSync(): Promise<SyncResult> {
  if (!isCloudSyncEnabled()) {
    return { ok: false, pushed: 0, pulled: 0, error: "Cloud sync disabled" };
  }
  if (syncLock) {
    return { ok: false, pushed: 0, pulled: 0, error: "Sync already running" };
  }

  syncLock = true;
  const db = await getDb();
  const runId = await createLocalId();

  try {
    await setMeta(db, META_KEYS.SYNC_RUN_ID, runId);
    await setMeta(db, META_KEYS.SYNC_STAGE, "handshake");

    const device_id = await getOrCreateDeviceId();
    const { data: handshake } = await api.post<{
      serverTime: string;
      minSchemaVersion: number;
    }>("/sync/handshake", {
      device_id,
      schemaVersion: LOCAL_SCHEMA_VERSION,
    });

    if (handshake.minSchemaVersion > LOCAL_SCHEMA_VERSION) {
      throw new Error("App update required before sync");
    }

    const offsetMs = applyServerTime(handshake.serverTime);
    await setMeta(db, META_KEYS.CLOCK_OFFSET_MS, String(offsetMs));

    await setMeta(db, META_KEYS.SYNC_STAGE, "push");
    const dirty = await collectDirtyChanges();
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
    }>("/sync/push", { changes, device_id });

    for (const a of pushResult.accepted ?? []) {
      const match = changes.find((c) => c.id === a.id);
      if (match) await markClean(match.entity, a.id, a.server_id ?? null);
    }

    await setMeta(db, META_KEYS.SYNC_STAGE, "pull");
    const since =
      (await getMeta(db, META_KEYS.LAST_SYNC_CURSOR)) ||
      "1970-01-01T00:00:00.000Z";
    const { data: pull } = await api.get<{
      changes: SyncChange[];
      cursor: string;
    }>("/sync/pull", { params: { since, scope: "personal" } });

    for (const change of pull.changes ?? []) {
      await applyIncoming(change);
    }

    await setMeta(db, META_KEYS.SYNC_STAGE, "ack");
    await api.post("/sync/ack", { cursor: pull.cursor, run_id: runId });
    await setMeta(db, META_KEYS.LAST_SYNC_CURSOR, pull.cursor);
    await setMeta(db, META_KEYS.LAST_SYNC_AT, handshake.serverTime);
    await setMeta(db, META_KEYS.LAST_SYNC_ERROR, null);
    await setMeta(db, META_KEYS.SYNC_STAGE, "done");

    await recalculateBalances(db, { organizationId: null });

    const pushed = pushResult.accepted?.length ?? 0;
    const pulled = pull.changes?.length ?? 0;
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
    const message =
      status === 404 || /resource not found/i.test(String(raw))
        ? "Cloud sync API not on this server yet (deploy backend /sync routes)"
        : String(raw);
    await setMeta(db, META_KEYS.LAST_SYNC_ERROR, message);
    void trackLfEvent("sync_fail", { code: errorCodeFromUnknown(e) });
    if (__DEV__) {
      console.warn("[sync]", message);
    }
    return { ok: false, pushed: 0, pulled: 0, error: message };
  } finally {
    syncLock = false;
  }
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
