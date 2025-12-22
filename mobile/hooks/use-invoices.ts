import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoicesApi } from "@/services/invoices";
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
    queryFn: () => invoicesApi.get(invoiceId!),
    enabled: !!invoiceId,
  });
}

/**
 * Hook for fetching list of invoices with filters
 */
export function useInvoices(params?: ListInvoicesParams) {
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: () => invoicesApi.list(params),
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
    mutationFn: invoicesApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INVOICES });
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
  }
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateInvoiceParams) =>
      invoicesApi.update(invoiceId, params),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INVOICES });
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
      invoicesApi.updateStatus(invoiceId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INVOICES });
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
    mutationFn: invoicesApi.recordPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INVOICES });
      queryClient.invalidateQueries({ queryKey: ["parties"] });
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
    mutationFn: invoicesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INVOICES });
      toast.success("Invoice deleted successfully");
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error));
      options?.onError?.(error);
    },
  });
}

/**
 * Hook for sending invoice via email
 * Note: sendEmail API method needs to be implemented in services/invoices.ts
 */
// export function useSendInvoice(invoiceId: string) {
//   return useMutation({
//     mutationFn: (email: string) => invoicesApi.sendEmail(invoiceId, email),
//     onSuccess: () => {
//       toast.success("Invoice sent successfully");
//     },
//     onError: (error) => {
//       toast.error(getApiErrorMessage(error));
//     },
//   });
// }
