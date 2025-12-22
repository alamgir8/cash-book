import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { partiesApi } from "@/services/parties";
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
    queryKey: params ? ["parties", params] : QUERY_KEYS.PARTIES,
    queryFn: () => partiesApi.list(params),
  });
};

/**
 * Hook to fetch a single party by ID
 */
export const useParty = (partyId: string) => {
  return useQuery({
    queryKey: ["party", partyId],
    queryFn: () => partiesApi.get(partyId),
    enabled: Boolean(partyId),
  });
};

/**
 * Hook to fetch party ledger
 */
export const usePartyLedger = (partyId: string, params?: GetLedgerParams) => {
  return useQuery({
    queryKey: ["partyLedger", partyId, params?.page || 1],
    queryFn: () => partiesApi.getLedger(partyId, params || {}),
    enabled: Boolean(partyId),
  });
};

/**
 * Hook to create a new party
 */
export const useCreateParty = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreatePartyPayload) => partiesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PARTIES });
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
      partiesApi.update(partyId, payload),
    onSuccess: (data: Party) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PARTIES });
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
 * Hook to delete a party
 */
export const useDeleteParty = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partyId: string) => partiesApi.delete(partyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PARTIES });
      Toast.show({
        type: "success",
        text1: "Party deleted successfully",
      });
    },
    onError: (error: any) => {
      Toast.show({
        type: "error",
        text1: "Failed to delete party",
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
    }) => partiesApi.update(partyId, { archived }),
    onSuccess: (data: Party) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PARTIES });
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
