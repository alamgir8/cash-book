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
    }>(
      "/sync/push",
      { changes, device_id },
      { timeout: 60000 },
    );

    const accepted = pushResult.accepted ?? [];
    const rejected = pushResult.rejected ?? [];

    for (const a of accepted) {
      const match = changes.find((c) => c.id === a.id);
      if (match) await markClean(match.entity, a.id, a.server_id ?? null);
    }

    // Rejected rows stay dirty for retry; mark failed + surface reason.
    if (rejected.length) {
      const sample = rejected
        .slice(0, 3)
        .map((r) => `${r.id}: ${r.reason}`)
        .join("; ");
      await setMeta(
        db,
        META_KEYS.LAST_SYNC_ERROR,
        `${rejected.length} push rejected — ${sample}`,
      );
      for (const r of rejected) {
        const match = changes.find((c) => c.id === r.id);
        if (!match) continue;
        const table =
          match.entity === "account"
            ? "accounts"
            : match.entity === "category"
              ? "categories"
              : match.entity === "party"
                ? "parties"
                : match.entity === "transaction"
                  ? "transactions"
                  : "transfers";
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

    await recalculateBalances(db, { allOrganizations: true });

    const pushed = accepted.length;
    const pulled = pull.changes?.length ?? 0;

    if (rejected.length) {
      void trackLfEvent("sync_fail", {
        code: "push_partial",
        count: rejected.length,
        count2: pushed,
      });
      return {
        ok: false,
        pushed,
        pulled,
        serverTime: handshake.serverTime,
        error: `${rejected.length} change(s) rejected — will retry`,
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
