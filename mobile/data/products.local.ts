import { getDb } from "@/db/client";
import { withDbTransaction } from "@/db/client";
import { applyStockMovement } from "@/db/stock";
import * as productsRepo from "@/db/repos/products";
import * as movementsRepo from "@/db/repos/stock-movements";
import type { LocalProduct } from "@/db/types";
import {
  localMovementToApi,
  localProductToApi,
} from "./mappers";
import {
  productsApi,
  type ProductsListResponse,
  type StockMovementsResponse,
} from "@/services/products";
import type {
  AdjustStockParams,
  CreateProductParams,
  ListProductsParams,
  Product,
  ProductStats,
  ProductUnit,
  UpdateProductParams,
} from "@/types/product";
import { isDualWriteEnabled } from "@/lib/local-first/flags";
import { requestSyncSoon } from "@/sync/scheduler";
import { getOrCreateDeviceId } from "@/services/device";

const PRODUCT_UNITS: ProductUnit[] = [
  "pcs",
  "kg",
  "g",
  "mg",
  "liter",
  "ml",
  "meter",
  "cm",
  "mm",
  "box",
  "pack",
  "dozen",
  "pair",
  "set",
  "bag",
  "roll",
  "sheet",
  "bottle",
  "can",
  "carton",
  "ft",
  "inch",
  "yard",
];

async function resolveLocalProduct(productId: string) {
  const db = await getDb();
  let row = await productsRepo.getProductById(db, productId);
  if (!row) {
    row = await productsRepo.getProductByServerId(db, productId);
  }
  return { db, row };
}

/** Shop rows are syncable now, so nudge the scheduler after every write. */
function notifyShopMutation() {
  try {
    requestSyncSoon("mutation");
  } catch {
    /* scheduler unavailable */
  }
}

async function movementTotals(
  db: Awaited<ReturnType<typeof getDb>>,
  productId: string,
) {
  const row = await db.getFirstAsync<{
    sold: number;
    purchased: number;
    last_sale: string | null;
    last_purchase: string | null;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN quantity < 0 AND type IN ('sale','adjustment_out') THEN -quantity ELSE 0 END), 0) as sold,
       COALESCE(SUM(CASE WHEN quantity > 0 AND type IN ('purchase','opening_stock','adjustment_in') THEN quantity ELSE 0 END), 0) as purchased,
       MAX(CASE WHEN type = 'sale' THEN date END) as last_sale,
       MAX(CASE WHEN type = 'purchase' THEN date END) as last_purchase
     FROM inventory_movements
     WHERE product_id = ? AND deleted_at IS NULL`,
    productId,
  );
  return {
    totalSold: Number(row?.sold ?? 0),
    totalPurchased: Number(row?.purchased ?? 0),
    lastSaleDate: row?.last_sale ?? null,
    lastPurchaseDate: row?.last_purchase ?? null,
  };
}

export async function fetchLocalProductOptions() {
  return { units: PRODUCT_UNITS };
}

export async function fetchLocalProducts(
  params?: ListProductsParams,
): Promise<ProductsListResponse> {
  const db = await getDb();
  const page = Math.max(1, Number(params?.page ?? 1));
  const limit = Math.max(1, Number(params?.limit ?? 50));
  const { products, total } = await productsRepo.listProducts(
    db,
    { organizationId: params?.organization ?? null },
    {
      search: params?.search,
      categoryId: params?.category_id,
      isActive: params?.is_active,
      lowStock: params?.low_stock,
      limit,
      offset: (page - 1) * limit,
    },
  );

  return {
    products: products.map((row) => localProductToApi(row)),
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function fetchLocalProduct(productId: string): Promise<Product> {
  const { db, row } = await resolveLocalProduct(productId);
  if (!row) throw new Error("Product not found");
  const totals = await movementTotals(db, row.id);
  return localProductToApi(row, totals);
}

export async function findLocalProductByBarcode(
  barcode: string,
  organizationId?: string,
): Promise<Product | null> {
  const db = await getDb();
  const row = await productsRepo.findProductByBarcode(db, barcode, {
    organizationId: organizationId ?? null,
  });
  if (!row) return null;
  const totals = await movementTotals(db, row.id);
  return localProductToApi(row, totals);
}

export async function fetchLocalProductByBarcode(
  barcode: string,
  organizationId?: string,
): Promise<Product> {
  const found = await findLocalProductByBarcode(barcode, organizationId);
  if (!found) throw new Error("Product not found for this barcode");
  return found;
}

export async function createLocalProduct(
  params: CreateProductParams,
): Promise<Product> {
  const db = await getDb();
  const device_id = await getOrCreateDeviceId();

  if (params.barcode?.trim()) {
    const dup = await productsRepo.findDuplicateBarcode(
      db,
      params.barcode,
      params.organization ?? null,
    );
    if (dup) {
      throw new Error(`Barcode already used by "${dup.name}"`);
    }
  }

  // Product + opening-stock movement land together (no orphan stock row).
  let row: LocalProduct | undefined;
  await withDbTransaction(db, async (txn) => {
    const created = await productsRepo.createProduct(txn, {
      name: params.name,
      sku: params.sku,
      barcode: params.barcode,
      description: params.description,
      category_id: params.category_id,
      unit: params.unit,
      purchase_price: params.purchase_price,
      additional_cost: params.additional_cost,
      sale_price: params.sale_price,
      tax_rate: params.tax_rate,
      current_stock: params.current_stock,
      opening_stock: params.current_stock,
      low_stock_threshold: params.low_stock_threshold,
      track_inventory: params.track_inventory,
      organization_id: params.organization ?? null,
      device_id,
    });

    if (created.track_inventory && Number(created.opening_stock) > 0) {
      await movementsRepo.createMovement(txn, {
        product_id: created.id,
        organization_id: created.organization_id,
        type: "opening_stock",
        quantity: Number(created.opening_stock),
        unit_cost: Number(created.cost_price),
        stock_after: Number(created.current_stock),
        notes: "Opening stock",
        device_id,
      });
    }
    row = created;
  });
  if (!row) throw new Error("Failed to create product");

  if (isDualWriteEnabled()) {
    try {
      const remote = await productsApi.create(params);
      if (remote?._id) {
        await db.runAsync(
          `UPDATE products SET server_id = ?, dirty = 0, sync_status = 'synced' WHERE id = ?`,
          remote._id,
          row.id,
        );
      }
    } catch (e) {
      console.warn("[dal] dual-write product create failed", e);
    }
  }

  notifyShopMutation();
  const fresh = await productsRepo.getProductById(db, row.id);
  return localProductToApi(fresh ?? row);
}

export async function updateLocalProduct(
  productId: string,
  params: UpdateProductParams,
): Promise<Product> {
  const { db, row: existing } = await resolveLocalProduct(productId);
  if (!existing) throw new Error("Product not found");
  const device_id = await getOrCreateDeviceId();

  const nextBarcode =
    params.barcode !== undefined ? params.barcode?.trim() || null : existing.barcode;
  if (nextBarcode) {
    const dup = await productsRepo.findDuplicateBarcode(
      db,
      nextBarcode,
      existing.organization_id,
      existing.id,
    );
    if (dup) throw new Error(`Barcode already used by "${dup.name}"`);
  }

  await productsRepo.updateProduct(db, existing.id, {
    ...params,
    purchase_price: params.purchase_price,
    additional_cost: params.additional_cost,
    device_id,
  });

  if (isDualWriteEnabled() && existing.server_id) {
    try {
      await productsApi.update(existing.server_id, params);
      await db.runAsync(
        `UPDATE products SET dirty = 0, sync_status = 'synced' WHERE id = ?`,
        existing.id,
      );
    } catch (e) {
      console.warn("[dal] dual-write product update failed", e);
    }
  }

  notifyShopMutation();
  const fresh = await productsRepo.getProductById(db, existing.id);
  if (!fresh) throw new Error("Product not found");
  const totals = await movementTotals(db, fresh.id);
  return localProductToApi(fresh, totals);
}

export async function deleteLocalProduct(productId: string): Promise<void> {
  const { db, row } = await resolveLocalProduct(productId);
  if (!row) throw new Error("Product not found");
  const device_id = await getOrCreateDeviceId();

  await productsRepo.softDeleteProduct(db, row.id, device_id);
  notifyShopMutation();

  if (isDualWriteEnabled() && row.server_id) {
    try {
      await productsApi.delete(row.server_id);
      await db.runAsync(
        `UPDATE products SET dirty = 0, sync_status = 'synced' WHERE id = ?`,
        row.id,
      );
    } catch (e) {
      console.warn("[dal] dual-write product delete failed", e);
    }
  }
}

export async function adjustLocalStock(
  productId: string,
  params: AdjustStockParams,
): Promise<Product> {
  const { db, row } = await resolveLocalProduct(productId);
  if (!row) throw new Error("Product not found");
  const device_id = await getOrCreateDeviceId();

  const qty = Math.abs(Number(params.quantity) || 0);
  if (!qty) throw new Error("Quantity must be a positive number");

  const delta = params.type === "adjustment_in" ? qty : -qty;

  // Single atomic writer: stock + movement + negative-stock guard.
  const { product: updated } = await applyStockMovement(db, {
    product_id: row.id,
    organization_id: row.organization_id,
    type: params.type,
    quantity: delta,
    unit_cost: Number(params.unit_cost ?? row.cost_price),
    reference_type: "adjustment",
    notes: params.notes ?? null,
    date: params.date,
    device_id,
  });

  notifyShopMutation();
  return localProductToApi(updated);
}

export async function fetchLocalStockMovements(
  productId: string,
  params?: { page?: number; limit?: number },
): Promise<StockMovementsResponse> {
  const { db, row } = await resolveLocalProduct(productId);
  if (!row) throw new Error("Product not found");

  const page = Math.max(1, Number(params?.page ?? 1));
  const limit = Math.max(1, Number(params?.limit ?? 50));
  const { movements, total } = await movementsRepo.listMovementsByProduct(
    db,
    row.id,
    { limit, offset: (page - 1) * limit },
  );

  return {
    movements: movements.map(localMovementToApi),
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function fetchLocalProductStats(params?: {
  organization?: string;
}): Promise<ProductStats> {
  const db = await getDb();
  const stats = await productsRepo.getProductStats(db, {
    organizationId: params?.organization ?? null,
  });
  return {
    ...stats,
    potential_profit: stats.stock_sale_value - stats.stock_purchase_value,
  };
}
