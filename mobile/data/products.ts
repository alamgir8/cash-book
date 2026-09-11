import { productsApi } from "@/services/products";
import type {
  AdjustStockParams,
  CreateProductParams,
  ListProductsParams,
  UpdateProductParams,
} from "@/types/product";
import {
  ensureLocalFirstFlags,
  isLocalFirstEnabled,
} from "@/lib/local-first/flags";

/**
 * Shop product DAL — mirrors the ledger DAL pattern.
 * Local-first ON  → SQLite (instant, offline-capable).
 * Local-first OFF → REST (legacy behavior preserved).
 */
export async function dalFetchProductOptions() {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) return productsApi.getOptions();
  const local = await import("./products.local");
  return local.fetchLocalProductOptions();
}

export async function dalFetchProductStats(params?: {
  organization?: string;
}) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) return productsApi.getStats(params);
  const local = await import("./products.local");
  return local.fetchLocalProductStats(params);
}

export async function dalFetchProducts(params?: ListProductsParams) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) return productsApi.list(params);
  const local = await import("./products.local");
  return local.fetchLocalProducts(params);
}

export async function dalFetchProduct(productId: string) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) return productsApi.get(productId);
  const local = await import("./products.local");
  return local.fetchLocalProduct(productId);
}

export async function dalFetchProductByBarcode(
  barcode: string,
  organizationId?: string,
) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return productsApi.getByBarcode(barcode, organizationId);
  }
  const local = await import("./products.local");
  return local.fetchLocalProductByBarcode(barcode, organizationId);
}

/** Scanner-first lookup: returns null instead of throwing on a miss. */
export async function dalFindProductByBarcode(
  barcode: string,
  organizationId?: string,
) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    try {
      return await productsApi.getByBarcode(barcode, organizationId);
    } catch (e: any) {
      if (e?.response?.status === 404) return null;
      throw e;
    }
  }
  const local = await import("./products.local");
  return local.findLocalProductByBarcode(barcode, organizationId);
}

export async function dalCreateProduct(params: CreateProductParams) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) return productsApi.create(params);
  const local = await import("./products.local");
  return local.createLocalProduct(params);
}

export async function dalUpdateProduct(
  productId: string,
  params: UpdateProductParams,
) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) return productsApi.update(productId, params);
  const local = await import("./products.local");
  return local.updateLocalProduct(productId, params);
}

export async function dalDeleteProduct(productId: string) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) return productsApi.delete(productId);
  const local = await import("./products.local");
  return local.deleteLocalProduct(productId);
}

export async function dalAdjustStock(
  productId: string,
  params: AdjustStockParams,
) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) return productsApi.adjustStock(productId, params);
  const local = await import("./products.local");
  return local.adjustLocalStock(productId, params);
}

export async function dalFetchStockMovements(
  productId: string,
  params?: { page?: number; limit?: number },
) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return productsApi.getStockMovements(productId, params);
  }
  const local = await import("./products.local");
  return local.fetchLocalStockMovements(productId, params);
}
