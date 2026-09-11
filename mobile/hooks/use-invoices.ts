import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  dalCreateInvoice,
  dalDeleteInvoice,
  dalFetchInvoice,
  dalFetchInvoices,
  dalRecordInvoicePayment,
  dalUpdateInvoice,
  dalUpdateInvoiceStatus,
} from "@/data/invoices";
import type { CreateInvoiceDALParams } from "@/data/invoices.local";
import { toast } from "@/lib/toast";
import { getApiErrorMessage } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import type {
  Invoice,
  InvoiceStatus,
  ListInvoicesParams,
  UpdateInvoiceParams,
} from "@/types/invoice";

/**
 * Hook for fetching a single invoice by ID
 */
export function useInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => dalFetchInvoice(invoiceId!),
    enabled: !!invoiceId,
  });
}

/**
 * Hook for fetching list of invoices with filters
 */
export function useInvoices(params?: ListInvoicesParams) {
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: () => dalFetchInvoices(params),
  });
}

/**
 * Hook for creating a new invoice
 */
export function useCreateInvoice(options?: {
  onSuccess?: (data: Invoice) => void;
  onError?: (error: any) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateInvoiceDALParams) => dalCreateInvoice(params),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
      toast.success("Invoice created successfully");
      options?.onSuccess?.(data);
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error));
      options?.onError?.(error);
    },
  });
}

/**
 * Hook for updating an existing invoice
 */
export function useUpdateInvoice(
  invoiceId: string,
  options?: {
    onSuccess?: (data: Invoice) => void;
    onError?: (error: any) => void;
  },
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateInvoiceParams) =>
      dalUpdateInvoice(invoiceId, params),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
      toast.success("Invoice updated successfully");
      options?.onSuccess?.(data);
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error));
      options?.onError?.(error);
    },
  });
}

/**
 * Hook for updating invoice status
 */
export function useUpdateInvoiceStatus(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ status }: { status: InvoiceStatus }) =>
      dalUpdateInvoiceStatus(invoiceId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

/**
 * Hook for recording payment against an invoice
 */
export function useRecordPayment(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dalRecordInvoicePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Payment recorded successfully");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

/**
 * Hook for deleting an invoice
 */
export function useDeleteInvoice(options?: {
  onSuccess?: () => void;
  onError?: (error: any) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invoiceId: string) => dalDeleteInvoice(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
      toast.success("Invoice deleted successfully");
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error));
      options?.onError?.(error);
    },
  });
}
