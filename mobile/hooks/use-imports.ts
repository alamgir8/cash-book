import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import {
  uploadAndParseFile,
  getImportDetail,
  listImports,
  updateImportMapping,
  updateImportItems,
  executeImport,
  deleteImportRecord,
} from "@/services/imports";
import type { ColumnMapping, AccountColumnMapping } from "@/services/imports";

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const importQueryKeys = {
  all: ["imports"] as const,
  list: (page?: number) => ["imports", "list", page] as const,
  detail: (importId: string) => ["imports", importId] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Hook to list all imports with pagination.
 */
export const useImportList = (page = 1) => {
  return useQuery({
    queryKey: importQueryKeys.list(page),
    queryFn: () => listImports(page, 20),
  });
};

/**
 * Hook to get import details.
 */
export const useImportDetail = (importId: string) => {
  return useQuery({
    queryKey: importQueryKeys.detail(importId),
    queryFn: () => getImportDetail(importId),
    enabled: Boolean(importId),
    refetchInterval: (query) => {
      // Auto-refetch while importing
      const status = query.state.data?.status;
      if (status === "importing") return 2000;
      return false;
    },
  });
};

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Hook to upload and parse a file.
 */
export const useUploadFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fileUri,
      fileName,
      fileMimeType,
      organizationId,
      import_mode,
      default_type,
    }: {
      fileUri: string;
      fileName: string;
      fileMimeType: string;
      organizationId?: string;
      import_mode?: "auto" | "standard" | "ledger";
      default_type?: "credit" | "debit";
    }) =>
      uploadAndParseFile(fileUri, fileName, fileMimeType, organizationId, {
        import_mode,
        default_type,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: importQueryKeys.all });

      // Check for parse warnings (e.g. 0 items)
      if (data.parse_warnings && data.parse_warnings.length > 0) {
        const w = data.parse_warnings[0];
        Toast.show({
          type: "error",
          text1: w.title,
          text2: w.suggestion || w.message,
          visibilityTime: 6000,
        });
      } else if (data.total_rows === 0) {
        Toast.show({
          type: "error",
          text1: "No transactions found",
          text2: "The file was parsed but no valid rows were detected.",
          visibilityTime: 5000,
        });
      } else {
        Toast.show({
          type: "success",
          text1: "File parsed successfully",
          text2: `Found ${data.total_rows} transaction${data.total_rows !== 1 ? "s" : ""}. Review and map columns before importing.`,
        });
      }
    },
    onError: (error: any) => {
      Toast.show({
        type: "error",
        text1: "Upload failed",
        text2: error?.response?.data?.message || error.message,
      });
    },
  });
};

/**
 * Hook to update column mapping.
 */
export const useUpdateMapping = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      importId,
      column_mapping,
      default_account,
      account_columns,
    }: {
      importId: string;
      column_mapping?: ColumnMapping;
      default_account?: string;
      account_columns?: AccountColumnMapping[];
    }) =>
      updateImportMapping(importId, {
        column_mapping,
        default_account,
        account_columns,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: importQueryKeys.detail(variables.importId),
      });
    },
    onError: (error: any) => {
      Toast.show({
        type: "error",
        text1: "Failed to update mapping",
        text2: error?.response?.data?.message || error.message,
      });
    },
  });
};

/**
 * Hook to update individual items.
 */
export const useUpdateItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      importId,
      items,
    }: {
      importId: string;
      items: {
        itemId: string;
        account?: string;
        category_id?: string;
        party?: string;
        type?: "debit" | "credit";
        amount?: number;
        date?: string;
        description?: string;
        counterparty?: string;
        status?: "pending" | "skipped";
      }[];
    }) => updateImportItems(importId, items),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: importQueryKeys.detail(variables.importId),
      });
    },
    onError: (error: any) => {
      Toast.show({
        type: "error",
        text1: "Failed to update items",
        text2: error?.response?.data?.message || error.message,
      });
    },
  });
};

/**
 * Hook to execute import (bulk create transactions).
 */
export const useExecuteImport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      importId,
      default_account,
      skip_duplicates = true,
    }: {
      importId: string;
      default_account?: string;
      skip_duplicates?: boolean;
    }) => executeImport(importId, { default_account, skip_duplicates }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: importQueryKeys.all });
      // Also invalidate transactions and accounts since we created new ones
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      Toast.show({
        type: "success",
        text1: "Import completed",
        text2: data.message,
      });
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: importQueryKeys.all });
      Toast.show({
        type: "error",
        text1: "Import failed",
        text2: error?.response?.data?.message || error.message,
      });
    },
  });
};

/**
 * Hook to delete an import record.
 */
export const useDeleteImport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (importId: string) => deleteImportRecord(importId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: importQueryKeys.all });
      Toast.show({
        type: "success",
        text1: "Import deleted",
      });
    },
    onError: (error: any) => {
      Toast.show({
        type: "error",
        text1: "Failed to delete import",
        text2: error?.response?.data?.message || error.message,
      });
    },
  });
};
