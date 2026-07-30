import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  schemesApi,
  type CreateSchemeParams,
  type EnrollMemberParams,
  type RecordSchemePaymentParams,
  type UpdateSchemeParams,
} from "@/services/schemes";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useActiveOrgId } from "@/hooks/use-organization";

export function useSchemes() {
  const orgId = useActiveOrgId();
  return useQuery({
    queryKey: [...QUERY_KEYS.schemes, orgId ?? "personal"],
    queryFn: () =>
      schemesApi.list(orgId ? { organization: orgId } : undefined),
  });
}

export function useScheme(schemeId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.scheme(schemeId || ""),
    queryFn: () => schemesApi.get(schemeId!),
    enabled: Boolean(schemeId),
  });
}

export function useSchemeRoster(
  schemeId: string | undefined,
  params?: { status?: string; search?: string },
) {
  return useQuery({
    queryKey: [
      ...QUERY_KEYS.schemeRoster(schemeId || ""),
      params?.status ?? "all",
      params?.search ?? "",
    ],
    queryFn: () => schemesApi.roster(schemeId!, params),
    enabled: Boolean(schemeId),
  });
}

export function useSchemeMemberPayments(
  schemeId: string | undefined,
  memberId: string | undefined,
) {
  return useQuery({
    queryKey: ["schemeMemberPayments", schemeId, memberId],
    queryFn: () => schemesApi.memberPayments(schemeId!, memberId!),
    enabled: Boolean(schemeId && memberId),
  });
}

function invalidateSchemeQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  schemeId?: string,
) {
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schemes });
  if (schemeId) {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.scheme(schemeId) });
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.schemeRoster(schemeId),
    });
  }
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.accounts });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.parties });
}

export function useCreateScheme() {
  const queryClient = useQueryClient();
  const orgId = useActiveOrgId();
  return useMutation({
    mutationFn: (payload: CreateSchemeParams) =>
      schemesApi.create({
        ...payload,
        organization: payload.organization ?? orgId ?? undefined,
      }),
    onSuccess: () => invalidateSchemeQueries(queryClient),
  });
}

export function useUpdateScheme(schemeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSchemeParams) =>
      schemesApi.update(schemeId, payload),
    onSuccess: () => invalidateSchemeQueries(queryClient, schemeId),
  });
}

export function useArchiveScheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schemeId: string) => schemesApi.archive(schemeId),
    onSuccess: (_data, schemeId) =>
      invalidateSchemeQueries(queryClient, schemeId),
  });
}

export function useDeleteScheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schemeId: string) => schemesApi.delete(schemeId),
    onSuccess: () => invalidateSchemeQueries(queryClient),
  });
}

export function useDuplicateScheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      schemeId,
      payload,
    }: {
      schemeId: string;
      payload: { name?: string };
    }) => schemesApi.duplicate(schemeId, payload),
    onSuccess: () => invalidateSchemeQueries(queryClient),
  });
}

export function useEnrollMember(schemeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EnrollMemberParams) =>
      schemesApi.enroll(schemeId, payload),
    onSuccess: () => invalidateSchemeQueries(queryClient, schemeId),
  });
}

export function useUpdateSchemeMember(schemeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      ...payload
    }: {
      memberId: string;
      member_count?: number;
      sort_order?: number | null;
      notes?: string;
    }) => schemesApi.updateMember(schemeId, memberId, payload),
    onSuccess: () => invalidateSchemeQueries(queryClient, schemeId),
  });
}

export function useRemoveSchemeMember(schemeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      schemesApi.removeMember(schemeId, memberId),
    onSuccess: () => invalidateSchemeQueries(queryClient, schemeId),
  });
}

export function useRecordSchemePayment(schemeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecordSchemePaymentParams) =>
      schemesApi.recordPayment(schemeId, payload),
    onSuccess: () => {
      invalidateSchemeQueries(queryClient, schemeId);
      queryClient.invalidateQueries({
        queryKey: ["schemeMemberPayments", schemeId],
      });
    },
  });
}
