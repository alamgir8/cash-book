import type { Db } from "./client";
import { withDbTransaction } from "./client";
import { META_KEYS, getMeta, scopeWhere, setMeta } from "./meta";
import * as productsRepo from "./repos/products";
import * as movementsRepo from "./repos/stock-movements";
import type { LocalProduct, LocalStockMovement, ScopeFilter } from "./types";
import { nowIso } from "@/lib/local-first/ids";

export type ApplyStockMovementInput = {
  product_id: string;
  organization_id?: string | null;
  type: LocalStockMovement["type"];
  /** Signed delta applied to `current_stock` (+ in, − out). */
  quantity: number;
  unit_cost?: number;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  date?: string;
  client_request_id?: string | null;
  device_id: string;
  /** Reuse an open transaction instead of nesting one. */
  txn?: Db;
};

const PRODUCT_STOCK_RECONCILE_VERSION = "1";

/**
 * The single writer for inventory changes.
 *
 * Guarantees:
 * - stock update + movement row are one atomic transaction (no drift),
 * - idempotent by `client_request_id` (a retried op never double-counts),
 * - `stock_after` is recorded on the movement so stock is rebuildable,
 * - negative stock is rejected for tracked products.
 */
export async function applyStockMovement(
  db: Db,
  input: ApplyStockMovementInput,
): Promise<{ product: LocalProduct; movement: LocalStockMovement }> {
  // Idempotency: same op key → return the existing movement, change no stock.
  if (input.client_request_id) {
    const existing = await movementsRepo.getMovementByClientRequestId(
      db,
      input.client_request_id,
    );
    if (existing) {
      const product = await productsRepo.getProductById(db, existing.product_id);
      if (product) return { product, movement: existing };
    }
  }

  const run = async (txn: Db) => {
    const product = await productsRepo.getProductById(txn, input.product_id);
    if (!product || product.deleted_at) throw new Error("Product not found");

    const delta = Number(input.quantity) || 0;
    const stockAfter = Number(product.current_stock) + delta;
    if (product.track_inventory && stockAfter < 0) {
      throw new Error("Insufficient stock for this movement");
    }

    await txn.runAsync(
      `UPDATE products SET current_stock = ?, updated_at = ?, dirty = 1,
        sync_status = 'pending_update', retry_count = 0, last_sync_error = NULL,
        device_id = ?, sync_version = sync_version + 1
       WHERE id = ?`,
      stockAfter,
      nowIso(),
      input.device_id,
      product.id,
    );

    const movement = await movementsRepo.createMovement(txn, {
      product_id: product.id,
      organization_id: input.organization_id ?? product.organization_id,
      type: input.type,
      quantity: delta,
      unit_cost: input.unit_cost ?? Number(product.cost_price),
      stock_after: stockAfter,
      reference_type: input.reference_type ?? null,
      reference_id: input.reference_id ?? null,
      notes: input.notes ?? null,
      date: input.date,
      client_request_id: input.client_request_id ?? null,
      device_id: input.device_id,
    });

    return { productId: product.id, movement };
  };

  let result: { productId: string; movement: LocalStockMovement } | undefined;
  if (input.txn) {
    result = await run(input.txn);
  } else {
    await withDbTransaction(db, async (txn) => {
      result = await run(txn);
    });
  }
  if (!result) throw new Error("Stock movement failed");

  const product = await productsRepo.getProductById(db, result.productId);
  if (!product) throw new Error("Product not found");
  return { product, movement: result.movement };
}

/**
 * Derive `current_stock` from the latest movement's recorded `stock_after`.
 *
 * This is migration-safe: products without local movements (seeded from the
 * cloud catalog) keep their existing `current_stock`, because no local history
 * exists to rebuild from yet.
 */
export async function recalculateProductStock(
  db: Db,
  scope?: ScopeFilter,
): Promise<number> {
  const { sql, params } = scopeWhere("", scope);
  const products = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM products WHERE ${sql} AND deleted_at IS NULL`,
    ...params,
  );

  let fixed = 0;
  for (const p of products) {
    // Insertion order (rowid), not the user-supplied `date`: `stock_after`
    // reflects the order movements were actually applied, so a backdated
    // adjustment must not be treated as "latest".
    const latest = await db.getFirstAsync<{ stock_after: number }>(
      `SELECT stock_after FROM inventory_movements
       WHERE product_id = ? AND deleted_at IS NULL
       ORDER BY rowid DESC LIMIT 1`,
      p.id,
    );
    if (!latest) continue;

    const target = Number(latest.stock_after);
    const res = await db.runAsync(
      `UPDATE products SET current_stock = ?
       WHERE id = ? AND ABS(current_stock - ?) > 0.0001`,
      target,
      p.id,
      target,
    );
    if (res.changes) fixed += 1;
  }
  return fixed;
}

/** Version-guarded reconcile so devices don't re-run it on every boot. */
export async function ensureProductStockReconciled(db: Db): Promise<number> {
  const current = await getMeta(
    db,
    META_KEYS.PRODUCT_STOCK_RECONCILE_VERSION,
  );
  if (current === PRODUCT_STOCK_RECONCILE_VERSION) return 0;
  const fixed = await recalculateProductStock(db, { allOrganizations: true });
  await setMeta(
    db,
    META_KEYS.PRODUCT_STOCK_RECONCILE_VERSION,
    PRODUCT_STOCK_RECONCILE_VERSION,
  );
  return fixed;
}
