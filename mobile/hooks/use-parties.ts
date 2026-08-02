import { useMutation, useQuery, useInfiniteQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import {
  dalArchiveParty,
  dalCreateParty,
  dalDeleteParty,
  dalFetchParties,
  dalFetchParty,
  dalFetchPartyLedger,
  dalMergeParties,
  dalUpdateParty,
} from "@/data/parties";
import { QUERY_KEYS } from "@/lib/queryKeys";
import type {
  Party,
  CreatePartyPayload,
  UpdatePartyPayload,
  ListPartiesParams,
  GetLedgerParams,
} from "@/types/party";

/**
 * Hook to fetch all parties
 */
export const useParties = (params?: ListPartiesParams) => {
  return useQuery({
    queryKey: params ? ["parties", params] : QUERY_KEYS.parties,
    queryFn: () => dalFetchParties(params),
  });
};

/**
 * Hook to fetch a single party by ID
 */
export const useParty = (partyId: string) => {
  return useQuery({
    queryKey: ["party", partyId],
    queryFn: () => dalFetchParty(partyId),
    enabled: Boolean(partyId),
  });
};

/**
 * Hook to fetch party ledger
 */
export const usePartyLedger = (
  partyId: string,
  params?: Omit<GetLedgerParams, "page">,
) => {
  const PAGE_SIZE = params?.limit || 30;
  return useInfiniteQuery({
    queryKey: [
      "partyLedger",
      partyId,
      params?.search || "",
      params?.type || "all",
      params?.sort || "-date",
      params?.startDate || "",
      params?.endDate || "",
      PAGE_SIZE,
    ],
    queryFn: ({ pageParam, signal }) =>
      dalFetchPartyLedger(
        partyId,
        {
          ...params,
          type: params?.type === "all" ? undefined : params?.type,
          page: pageParam,
          limit: PAGE_SIZE,
        },
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const p = last?.pagination;
      if (!p) return undefined;
      return p.page < p.pages ? p.page + 1 : undefined;
    },
    enabled: Boolean(partyId),
    retry: 1,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
};

/**
 * Hook to create a new party
 */
export const useCreateParty = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreatePartyPayload) => dalCreateParty(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.parties });
      Toast.show({
        type: "success",
        text1: "Party created successfully",
      });
    },
    onError: (error: any) => {
      Toast.show({
        type: "error",
        text1: "Failed to create party",
        text2: error?.response?.data?.message || error.message,
      });
    },
  });
};

/**
 * Hook to update an existing party
 */
export const useUpdateParty = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      partyId,
      ...payload
    }: { partyId: string } & UpdatePartyPayload) =>
      dalUpdateParty(partyId, payload),
    onSuccess: (data: Party) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.parties });
      queryClient.invalidateQueries({ queryKey: ["party", data._id] });
      Toast.show({
        type: "success",
        text1: "Party updated successfully",
      });
    },
    onError: (error: any) => {
      Toast.show({
        type: "error",
        text1: "Failed to update party",
        text2: error?.response?.data?.message || error.message,
      });
    },
  });
};

/**
 * Hook to delete a party (hard delete; blocked if linked txns exist)
 */
export const useDeleteParty = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partyId: string) => dalDeleteParty(partyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.parties });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vendors });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.counterparties });
      Toast.show({
        type: "success",
        text1: "Party deleted successfully",
      });
    },
    onError: (error: any) => {
      // Caller may handle canMerge / transactionCount itself
      if (error?.response?.data?.canMerge) return;
      Toast.show({
        type: "error",
        text1: "Failed to delete party",
        text2: error?.response?.data?.message || error.message,
      });
    },
  });
};

/**
 * Hook to merge a party into another
 */
export const useMergeParty = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sourcePartyId,
      targetPartyId,
    }: {
      sourcePartyId: string;
      targetPartyId: string;
    }) => dalMergeParties(sourcePartyId, targetPartyId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.parties });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vendors });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.counterparties });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      Toast.show({
        type: "success",
        text1: "Parties merged",
        text2: data.message,
      });
    },
    onError: (error: any) => {
      Toast.show({
        type: "error",
        text1: "Failed to merge parties",
        text2: error?.response?.data?.message || error.message,
      });
    },
  });
};

/**
 * Hook to archive/unarchive a party
 */
export const useArchiveParty = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      partyId,
      archived,
    }: {
      partyId: string;
      archived: boolean;
    }) => dalArchiveParty(partyId, archived).then((r) => r.party),
    onSuccess: (data: Party) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.parties });
      queryClient.invalidateQueries({ queryKey: ["party", data._id] });
      Toast.show({
        type: "success",
        text1: data.archived
          ? "Party archived successfully"
          : "Party restored successfully",
      });
    },
    onError: (error: any) => {
      Toast.show({
        type: "error",
        text1: "Failed to update party",
        text2: error?.response?.data?.message || error.message,
      });
    },
  });
};
