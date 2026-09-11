import type { Db } from "../client";
import type { LocalStockMovement } from "../types";
import {
  createClientRequestId,
  createLocalId,
  nowIso,
} from "@/lib/local-first/ids";

export type StockMovementInput = {
  product_id: string;
  organization_id?: string | null;
  admin_id?: string | null;
  type: LocalStockMovement["type"];
  quantity: number;
  unit_cost?: number;
  stock_after: number;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  date?: string;
  client_request_id?: string | null;
  device_id: string;
  id?: string;
};

export async function getMovementByClientRequestId(
  db: Db,
  clientRequestId: string,
): Promise<LocalStockMovement | null> {
  return (
    (await db.getFirstAsync<LocalStockMovement>(
      "SELECT * FROM inventory_movements WHERE client_request_id = ? LIMIT 1",
      clientRequestId,
    )) ?? null
  );
}

/**
 * Idempotent insert — a movement op key is applied at most once, so sync
 * retries can never double-count stock.
 */
export async function createMovement(
  db: Db,
  input: StockMovementInput,
): Promise<LocalStockMovement> {
  const clientRequestId =
    input.client_request_id ?? createClientRequestId();
  const existing = await getMovementByClientRequestId(db, clientRequestId);
  if (existing) return existing;

  const id = input.id ?? (await createLocalId());
  const ts = nowIso();
  const date = input.date ?? ts;

  await db.runAsync(
    `INSERT INTO inventory_movements (
      id, server_id, organization_id, product_id, admin_id, type,
      quantity, unit_cost, stock_after, reference_type, reference_id,
      notes, date, created_at, updated_at, deleted_at,
      dirty, sync_version, client_request_id, device_id, sync_status,
      retry_count, last_sync_error
    ) VALUES (
      ?, NULL, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, NULL,
      1, 0, ?, ?, 'pending_create',
      0, NULL
    )`,
    id,
    input.organization_id ?? null,
    input.product_id,
    input.admin_id ?? null,
    input.type,
    Number(input.quantity),
    Number(input.unit_cost ?? 0),
    Number(input.stock_after),
    input.reference_type ?? null,
    input.reference_id ?? null,
    input.notes ?? null,
    date,
    ts,
    ts,
    clientRequestId,
    input.device_id,
  );

  const row = await db.getFirstAsync<LocalStockMovement>(
    "SELECT * FROM inventory_movements WHERE id = ?",
    id,
  );
  if (!row) throw new Error("Failed to create stock movement");
  return row;
}

export async function listMovementsByProduct(
  db: Db,
  productId: string,
  opts?: { limit?: number; offset?: number },
): Promise<{ movements: LocalStockMovement[]; total: number }> {
  const limit = Math.max(1, Number(opts?.limit ?? 50));
  const offset = Math.max(0, Number(opts?.offset ?? 0));

  const rows = await db.getAllAsync<LocalStockMovement>(
    `SELECT * FROM inventory_movements
     WHERE product_id = ? AND deleted_at IS NULL
     ORDER BY date DESC LIMIT ? OFFSET ?`,
    productId,
    limit,
    offset,
  );
  const countRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM inventory_movements
     WHERE product_id = ? AND deleted_at IS NULL`,
    productId,
  );
  return { movements: rows, total: Number(countRow?.c ?? rows.length) };
}

export async function upsertMovementFromSync(
  db: Db,
  row: LocalStockMovement,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO inventory_movements (
      id, server_id, organization_id, product_id, admin_id, type,
      quantity, unit_cost, stock_after, reference_type, reference_id,
      notes, date, created_at, updated_at, deleted_at,
      dirty, sync_version, client_request_id, device_id, sync_status,
      retry_count, last_sync_error
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      server_id = excluded.server_id,
      organization_id = excluded.organization_id,
      product_id = excluded.product_id,
      admin_id = excluded.admin_id,
      type = excluded.type,
      quantity = excluded.quantity,
      unit_cost = excluded.unit_cost,
      stock_after = excluded.stock_after,
      reference_type = excluded.reference_type,
      reference_id = excluded.reference_id,
      notes = excluded.notes,
      date = excluded.date,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      dirty = excluded.dirty,
      sync_status = CASE WHEN excluded.dirty = 0 THEN 'synced' ELSE COALESCE(excluded.sync_status, 'pending_update') END,
      retry_count = CASE WHEN excluded.dirty = 0 THEN 0 ELSE inventory_movements.retry_count END,
      last_sync_error = CASE WHEN excluded.dirty = 0 THEN NULL ELSE inventory_movements.last_sync_error END,
      sync_version = excluded.sync_version,
      client_request_id = excluded.client_request_id,
      device_id = excluded.device_id`,
    row.id,
    row.server_id,
    row.organization_id,
    row.product_id,
    row.admin_id,
    row.type,
    row.quantity,
    row.unit_cost,
    row.stock_after,
    row.reference_type,
    row.reference_id,
    row.notes,
    row.date,
    row.created_at,
    row.updated_at,
    row.deleted_at,
    row.dirty,
    row.sync_version,
    row.client_request_id,
    row.device_id,
    row.sync_status ?? (row.dirty ? "pending_update" : "synced"),
    row.retry_count ?? 0,
    row.last_sync_error ?? null,
  );
}
