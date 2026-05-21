import { api } from "@/lib/api";
import type {
  Product,
  ProductStats,
  StockMovement,
  CreateProductParams,
  UpdateProductParams,
  ListProductsParams,
  AdjustStockParams,
} from "@/types/product";

export interface ProductsListResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface StockMovementsResponse {
  movements: StockMovement[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const productsApi = {
  // Get options (units, etc.)
  getOptions: async () => {
    const response = await api.get<{ units: string[] }>("/products/options");
    return response.data;
  },

  // Get product stats (total, low stock, stock value, etc.)
  getStats: async (params?: { organization?: string }) => {
    const response = await api.get<{ stats: ProductStats }>("/products/stats", {
      params,
    });
    return response.data.stats;
  },

  // Lookup product by barcode
  getByBarcode: async (barcode: string, organizationId?: string) => {
    const response = await api.get<{ product: Product }>(
      `/products/barcode/${encodeURIComponent(barcode)}`,
      {
        params: organizationId ? { organization: organizationId } : undefined,
      },
    );
    return response.data.product;
  },

  // List products with filters
  list: async (params?: ListProductsParams) => {
    const response = await api.get<ProductsListResponse>("/products", {
      params,
    });
    return response.data;
  },

  // Get single product
  get: async (productId: string) => {
    const response = await api.get<{ product: Product }>(
      `/products/${productId}`,
    );
    return response.data.product;
  },

  // Create product
  create: async (params: CreateProductParams) => {
    const response = await api.post<{ product: Product; message: string }>(
      "/products",
      params,
    );
    return response.data.product;
  },

  // Update product
  update: async (productId: string, params: UpdateProductParams) => {
    const response = await api.patch<{ product: Product; message: string }>(
      `/products/${productId}`,
      params,
    );
    return response.data.product;
  },

  // Delete product
  delete: async (productId: string) => {
    await api.delete(`/products/${productId}`);
  },

  // Manual stock adjustment
  adjustStock: async (productId: string, params: AdjustStockParams) => {
    const response = await api.post<{ product: Product; message: string }>(
      `/products/${productId}/adjust-stock`,
      params,
    );
    return response.data.product;
  },

  // Get stock movements for a product
  getStockMovements: async (
    productId: string,
    params?: { page?: number; limit?: number },
  ) => {
    const response = await api.get<StockMovementsResponse>(
      `/products/${productId}/stock-movements`,
      { params },
    );
    return response.data;
  },
};

// Re-export types for convenience
export type { Product, ProductStats, StockMovement };
