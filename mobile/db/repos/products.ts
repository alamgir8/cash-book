import type { Db } from "../client";
import { scopeWhere } from "../meta";
import type { LocalProduct, ScopeFilter } from "../types";
import {
  createClientRequestId,
  createLocalId,
  nowIso,
} from "@/lib/local-first/ids";

export type ProductInput = {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  category_id?: string | null;
  brand?: string | null;
  unit?: string;
  image_uri?: string | null;
  purchase_price?: number;
  additional_cost?: number;
  sale_price?: number;
  tax_rate?: number;
  current_stock?: number;
  opening_stock?: number;
  low_stock_threshold?: number;
  track_inventory?: boolean | number;
  supplier_party_id?: string | null;
  is_active?: boolean | number;
  meta_data_json?: string | null;
  organization_id?: string | null;
  admin_id?: string | null;
  device_id: string;
  server_id?: string | null;
  id?: string;
  dirty?: number;
};

export type ListProductsOptions = {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  lowStock?: boolean;
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
};

const toInt = (v: boolean | number | undefined, fallback: number): number => {
  if (v === undefined) return fallback;
  return v ? 1 : 0;
};

const computeCostPrice = (
  purchasePrice: number,
  additionalCost: number,
): number => Number(purchasePrice || 0) + Number(additionalCost || 0);

export function computeCostPricePure(
  purchasePrice: number,
  additionalCost: number,
): number {
  return computeCostPrice(purchasePrice, additionalCost);
}

export async function listProducts(
  db: Db,
  scope?: ScopeFilter,
  opts?: ListProductsOptions,
): Promise<{ products: LocalProduct[]; total: number }> {
  const { sql, params } = scopeWhere("", scope);
  const clauses: string[] = [sql];
  const values: (string | number)[] = [...params];

  if (!opts?.includeDeleted) clauses.push("deleted_at IS NULL");

  if (opts?.isActive !== undefined) {
    clauses.push("is_active = ?");
    values.push(opts.isActive ? 1 : 0);
  }
  if (opts?.categoryId) {
    clauses.push("category_id = ?");
    values.push(opts.categoryId);
  }
  if (opts?.lowStock) {
    clauses.push("track_inventory = 1");
    clauses.push("low_stock_threshold > 0");
    clauses.push("current_stock <= low_stock_threshold");
  }
  if (opts?.search && opts.search.trim()) {
    const like = `%${opts.search.trim()}%`;
    clauses.push(
      "(name LIKE ? OR COALESCE(sku, '') LIKE ? OR COALESCE(barcode, '') LIKE ?)",
    );
    values.push(like, like, like);
  }

  const where = clauses.join(" AND ");
  const limit = Math.max(1, Number(opts?.limit ?? 50));
  const offset = Math.max(0, Number(opts?.offset ?? 0));

  const rows = await db.getAllAsync<LocalProduct>(
    `SELECT * FROM products WHERE ${where} ORDER BY name COLLATE NOCASE ASC LIMIT ? OFFSET ?`,
    ...values,
    limit,
    offset,
  );
  const countRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM products WHERE ${where}`,
    ...values,
  );

  return { products: rows, total: Number(countRow?.c ?? rows.length) };
}

export async function getProductById(
  db: Db,
  id: string,
): Promise<LocalProduct | null> {
  return (
    (await db.getFirstAsync<LocalProduct>(
      "SELECT * FROM products WHERE id = ?",
      id,
    )) ?? null
  );
}

export async function getProductByServerId(
  db: Db,
  serverId: string,
): Promise<LocalProduct | null> {
  return (
    (await db.getFirstAsync<LocalProduct>(
      "SELECT * FROM products WHERE server_id = ? LIMIT 1",
      serverId,
    )) ?? null
  );
}

/** Product lookup by barcode within a scope (org isolation on). */
export async function findProductByBarcode(
  db: Db,
  barcode: string,
  scope?: ScopeFilter,
): Promise<LocalProduct | null> {
  const { sql, params } = scopeWhere("", scope);
  return (
    (await db.getFirstAsync<LocalProduct>(
      `SELECT * FROM products
       WHERE ${sql} AND barcode = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC LIMIT 1`,
      ...params,
      barcode.trim(),
    )) ?? null
  );
}

/** Duplicate detection that also covers NULL-org rows (SQLite unique skips NULLs). */
export async function findDuplicateBarcode(
  db: Db,
  barcode: string,
  organizationId: string | null | undefined,
  excludeId?: string,
): Promise<LocalProduct | null> {
  const orgClause = organizationId
    ? "organization_id = ?"
    : "(organization_id IS NULL OR organization_id = '')";
  const params: (string | null)[] = organizationId ? [organizationId] : [];
  return (
    (await db.getFirstAsync<LocalProduct>(
      `SELECT * FROM products
       WHERE ${orgClause} AND barcode = ? AND deleted_at IS NULL
         AND id != ?
       LIMIT 1`,
      ...params,
      barcode.trim(),
      excludeId ?? "",
    )) ?? null
  );
}

export async function createProduct(
  db: Db,
  input: ProductInput,
): Promise<LocalProduct> {
  const id = input.id ?? (await createLocalId());
  const ts = nowIso();
  const purchasePrice = Number(input.purchase_price ?? 0);
  const additionalCost = Number(input.additional_cost ?? 0);
  const openingStock = Number(input.opening_stock ?? input.current_stock ?? 0);

  await db.runAsync(
    `INSERT INTO products (
      id, server_id, organization_id, admin_id, name, sku, barcode, description,
      category_id, brand, unit, image_uri,
      purchase_price, additional_cost, cost_price, sale_price, tax_rate,
      current_stock, opening_stock, low_stock_threshold, track_inventory,
      supplier_party_id, is_active, meta_data_json,
      created_at, updated_at, deleted_at,
      dirty, sync_version, client_request_id, device_id, sync_status,
      retry_count, last_sync_error
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, NULL,
      ?, 0, ?, ?, 'pending_create',
      0, NULL
    )`,
    id,
    input.server_id ?? null,
    input.organization_id ?? null,
    input.admin_id ?? null,
    input.name.trim(),
    input.sku?.trim() || null,
    input.barcode?.trim() || null,
    input.description ?? null,
    input.category_id ?? null,
    input.brand ?? null,
    input.unit ?? "pcs",
    input.image_uri ?? null,
    purchasePrice,
    additionalCost,
    computeCostPrice(purchasePrice, additionalCost),
    Number(input.sale_price ?? 0),
    Number(input.tax_rate ?? 0),
    openingStock,
    openingStock,
    Number(input.low_stock_threshold ?? 0),
    toInt(input.track_inventory, 1),
    input.supplier_party_id ?? null,
    toInt(input.is_active, 1),
    input.meta_data_json ?? null,
    ts,
    ts,
    input.dirty ?? 1,
    createClientRequestId(),
    input.device_id,
  );

  const row = await getProductById(db, id);
  if (!row) throw new Error("Failed to create product");
  return row;
}

export async function updateProduct(
  db: Db,
  id: string,
  patch: Partial<ProductInput> & { device_id: string },
): Promise<LocalProduct> {
  const existing = await getProductById(db, id);
  if (!existing || existing.deleted_at) throw new Error("Product not found");

  const ts = nowIso();
  const purchasePrice =
    patch.purchase_price !== undefined
      ? Number(patch.purchase_price)
      : Number(existing.purchase_price);
  const additionalCost =
    patch.additional_cost !== undefined
      ? Number(patch.additional_cost)
      : Number(existing.additional_cost);

  await db.runAsync(
    `UPDATE products SET
      name = ?, sku = ?, barcode = ?, description = ?, category_id = ?,
      brand = ?, unit = ?, image_uri = ?,
      purchase_price = ?, additional_cost = ?, cost_price = ?,
      sale_price = ?, tax_rate = ?, low_stock_threshold = ?,
      track_inventory = ?, supplier_party_id = ?, is_active = ?,
      meta_data_json = ?,
      updated_at = ?, dirty = 1, sync_status = 'pending_update',
      retry_count = 0, last_sync_error = NULL,
      device_id = ?, sync_version = sync_version + 1
     WHERE id = ?`,
    patch.name !== undefined ? patch.name.trim() : existing.name,
    patch.sku !== undefined ? patch.sku?.trim() || null : existing.sku,
    patch.barcode !== undefined
      ? patch.barcode?.trim() || null
      : existing.barcode,
    patch.description !== undefined ? patch.description : existing.description,
    patch.category_id !== undefined ? patch.category_id : existing.category_id,
    patch.brand !== undefined ? patch.brand : existing.brand,
    patch.unit !== undefined ? patch.unit : existing.unit,
    patch.image_uri !== undefined ? patch.image_uri : existing.image_uri,
    purchasePrice,
    additionalCost,
    computeCostPrice(purchasePrice, additionalCost),
    patch.sale_price !== undefined
      ? Number(patch.sale_price)
      : existing.sale_price,
    patch.tax_rate !== undefined ? Number(patch.tax_rate) : existing.tax_rate,
    patch.low_stock_threshold !== undefined
      ? Number(patch.low_stock_threshold)
      : existing.low_stock_threshold,
    patch.track_inventory !== undefined
      ? toInt(patch.track_inventory, existing.track_inventory)
      : existing.track_inventory,
    patch.supplier_party_id !== undefined
      ? patch.supplier_party_id
      : existing.supplier_party_id,
    patch.is_active !== undefined
      ? toInt(patch.is_active, existing.is_active)
      : existing.is_active,
    patch.meta_data_json !== undefined
      ? patch.meta_data_json
      : existing.meta_data_json,
    ts,
    patch.device_id,
    id,
  );

  const row = await getProductById(db, id);
  if (!row) throw new Error("Failed to update product");
  return row;
}

export async function softDeleteProduct(
  db: Db,
  id: string,
  device_id: string,
): Promise<void> {
  const ts = nowIso();
  const result = await db.runAsync(
    `UPDATE products SET deleted_at = ?, updated_at = ?, dirty = 1,
      sync_status = 'pending_delete', retry_count = 0, last_sync_error = NULL,
      device_id = ?, sync_version = sync_version + 1
     WHERE id = ? AND deleted_at IS NULL`,
    ts,
    ts,
    device_id,
    id,
  );
  if (!result.changes) throw new Error("Product not found");
}

/** Stock + movement update used by local adjustments (Phase 4 completes flows). */
export async function setProductStock(
  db: Db,
  id: string,
  stock: number,
  device_id: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE products SET current_stock = ?, updated_at = ?, dirty = 1,
      sync_status = 'pending_update', retry_count = 0, last_sync_error = NULL,
      device_id = ?, sync_version = sync_version + 1
     WHERE id = ?`,
    stock,
    nowIso(),
    device_id,
    id,
  );
}

export type ProductStatsRow = {
  total_products: number;
  low_stock_count: number;
  stock_purchase_value: number;
  stock_sale_value: number;
  total_sold_qty: number;
  total_purchased_qty: number;
};

export async function getProductStats(
  db: Db,
  scope?: ScopeFilter,
): Promise<ProductStatsRow> {
  const { sql, params } = scopeWhere("", scope);
  const base = `deleted_at IS NULL AND is_active = 1 AND ${sql}`;

  const agg = await db.getFirstAsync<{
    total_products: number;
    stock_purchase_value: number;
    stock_sale_value: number;
  }>(
    `SELECT
       COUNT(*) as total_products,
       COALESCE(SUM(current_stock * cost_price), 0) as stock_purchase_value,
       COALESCE(SUM(current_stock * sale_price), 0) as stock_sale_value
     FROM products WHERE ${base}`,
    ...params,
  );

  const low = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM products
     WHERE ${base} AND track_inventory = 1
       AND low_stock_threshold > 0 AND current_stock <= low_stock_threshold`,
    ...params,
  );

  const sold = await db.getFirstAsync<{ sold: number; purchased: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN m.quantity < 0 AND m.type IN ('sale','adjustment_out') THEN -m.quantity ELSE 0 END), 0) as sold,
       COALESCE(SUM(CASE WHEN m.quantity > 0 AND m.type IN ('purchase','opening_stock','adjustment_in') THEN m.quantity ELSE 0 END), 0) as purchased
     FROM inventory_movements m
     WHERE m.deleted_at IS NULL
       AND m.product_id IN (SELECT id FROM products WHERE ${base})`,
    ...params,
  );

  return {
    total_products: Number(agg?.total_products ?? 0),
    low_stock_count: Number(low?.c ?? 0),
    stock_purchase_value: Number(agg?.stock_purchase_value ?? 0),
    stock_sale_value: Number(agg?.stock_sale_value ?? 0),
    total_sold_qty: Number(sold?.sold ?? 0),
    total_purchased_qty: Number(sold?.purchased ?? 0),
  };
}

export async function upsertProductFromSync(
  db: Db,
  row: LocalProduct,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO products (
      id, server_id, organization_id, admin_id, name, sku, barcode, description,
      category_id, brand, unit, image_uri,
      purchase_price, additional_cost, cost_price, sale_price, tax_rate,
      current_stock, opening_stock, low_stock_threshold, track_inventory,
      supplier_party_id, is_active, meta_data_json,
      created_at, updated_at, deleted_at,
      dirty, sync_version, client_request_id, device_id, sync_status,
      retry_count, last_sync_error
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      server_id = excluded.server_id,
      organization_id = excluded.organization_id,
      admin_id = excluded.admin_id,
      name = excluded.name,
      sku = excluded.sku,
      barcode = excluded.barcode,
      description = excluded.description,
      category_id = excluded.category_id,
      brand = excluded.brand,
      unit = excluded.unit,
      image_uri = excluded.image_uri,
      purchase_price = excluded.purchase_price,
      additional_cost = excluded.additional_cost,
      cost_price = excluded.cost_price,
      sale_price = excluded.sale_price,
      tax_rate = excluded.tax_rate,
      current_stock = excluded.current_stock,
      opening_stock = excluded.opening_stock,
      low_stock_threshold = excluded.low_stock_threshold,
      track_inventory = excluded.track_inventory,
      supplier_party_id = excluded.supplier_party_id,
      is_active = excluded.is_active,
      meta_data_json = excluded.meta_data_json,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      dirty = excluded.dirty,
      sync_status = CASE WHEN excluded.dirty = 0 THEN 'synced' ELSE COALESCE(excluded.sync_status, 'pending_update') END,
      retry_count = CASE WHEN excluded.dirty = 0 THEN 0 ELSE products.retry_count END,
      last_sync_error = CASE WHEN excluded.dirty = 0 THEN NULL ELSE products.last_sync_error END,
      sync_version = excluded.sync_version,
      client_request_id = excluded.client_request_id,
      device_id = excluded.device_id`,
    row.id,
    row.server_id,
    row.organization_id,
    row.admin_id,
    row.name,
    row.sku,
    row.barcode,
    row.description,
    row.category_id,
    row.brand,
    row.unit,
    row.image_uri,
    row.purchase_price,
    row.additional_cost,
    row.cost_price,
    row.sale_price,
    row.tax_rate,
    row.current_stock,
    row.opening_stock,
    row.low_stock_threshold,
    row.track_inventory,
    row.supplier_party_id,
    row.is_active,
    row.meta_data_json,
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
