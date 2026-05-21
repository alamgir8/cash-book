import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "@/services/products";
import { toast } from "@/lib/toast";
import { getApiErrorMessage } from "@/lib/api";
import type {
  CreateProductParams,
  UpdateProductParams,
  ListProductsParams,
  AdjustStockParams,
} from "@/types/product";

const PRODUCTS_KEY = ["products"] as const;

// ── Queries ────────────────────────────────────────────────────────────────

export function useProductStats(organizationId?: string) {
  return useQuery({
    queryKey: ["products", "stats", organizationId],
    queryFn: () => productsApi.getStats({ organization: organizationId }),
  });
}

export function useProducts(params?: ListProductsParams) {
  return useQuery({
    queryKey: ["products", "list", params],
    queryFn: () => productsApi.list(params),
  });
}

export function useProduct(productId: string | undefined) {
  return useQuery({
    queryKey: ["products", "detail", productId],
    queryFn: () => productsApi.get(productId!),
    enabled: !!productId,
  });
}

export function useProductByBarcode(
  barcode: string | null,
  organizationId?: string,
) {
  return useQuery({
    queryKey: ["products", "barcode", barcode, organizationId],
    queryFn: () => productsApi.getByBarcode(barcode!, organizationId),
    enabled: !!barcode && barcode.length >= 3,
    retry: 1,
  });
}

export function useStockMovements(
  productId: string | undefined,
  params?: { page?: number; limit?: number },
) {
  return useQuery({
    queryKey: ["products", "movements", productId, params],
    queryFn: () => productsApi.getStockMovements(productId!, params),
    enabled: !!productId,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

export function useCreateProduct(options?: {
  onSuccess?: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateProductParams) => productsApi.create(params),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      toast.success("Product created successfully");
      options?.onSuccess?.(product._id);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useUpdateProduct(
  productId: string,
  options?: { onSuccess?: () => void },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: UpdateProductParams) =>
      productsApi.update(productId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["products", "detail", productId],
      });
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      toast.success("Product updated successfully");
      options?.onSuccess?.();
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useDeleteProduct(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => productsApi.delete(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      toast.success("Product deleted successfully");
      options?.onSuccess?.();
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useAdjustStock(
  productId: string,
  options?: { onSuccess?: () => void },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: AdjustStockParams) =>
      productsApi.adjustStock(productId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["products", "detail", productId],
      });
      queryClient.invalidateQueries({
        queryKey: ["products", "movements", productId],
      });
      queryClient.invalidateQueries({ queryKey: ["products", "stats"] });
      toast.success("Stock adjusted successfully");
      options?.onSuccess?.();
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}
