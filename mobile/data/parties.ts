import { partiesApi } from "@/services/parties";
import type {
  CreatePartyParams,
  ListPartiesParams,
  UpdatePartyParams,
} from "@/services/parties";
import {
  ensureLocalFirstFlags,
  isLocalFirstEnabled,
} from "@/lib/local-first/flags";
import { shouldUseLocalPersonalLedger } from "@/lib/local-first/ledger-scope";

export async function dalFetchParties(
  params?: ListPartiesParams,
  signal?: AbortSignal,
) {
  await ensureLocalFirstFlags();
  if (!shouldUseLocalPersonalLedger(params?.organization)) {
    return partiesApi.list(params, signal);
  }
  const local = await import("./parties.local");
  return local.fetchLocalParties(params || {});
}

export async function dalFetchParty(partyId: string) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return partiesApi.get(partyId);
  }
  const local = await import("./parties.local");
  return local.fetchLocalParty(partyId);
}

export async function dalCreateParty(payload: CreatePartyParams) {
  await ensureLocalFirstFlags();
  if (!shouldUseLocalPersonalLedger(payload.organization)) {
    return partiesApi.create(payload);
  }
  const local = await import("./parties.local");
  return local.createLocalParty(payload);
}

export async function dalUpdateParty(
  partyId: string,
  payload: UpdatePartyParams,
) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return partiesApi.update(partyId, payload);
  }
  const local = await import("./parties.local");
  return local.updateLocalParty(partyId, payload);
}

export async function dalArchiveParty(partyId: string, archived: boolean) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return partiesApi.archive(partyId, archived);
  }
  const local = await import("./parties.local");
  return local.archiveLocalParty(partyId, archived);
}

export async function dalDeleteParty(partyId: string) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return partiesApi.delete(partyId);
  }
  const local = await import("./parties.local");
  return local.deleteLocalParty(partyId);
}

export async function dalMergeParties(
  sourcePartyId: string,
  targetPartyId: string,
) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return partiesApi.merge(sourcePartyId, targetPartyId);
  }
  const local = await import("./parties.local");
  return local.mergeLocalParties(sourcePartyId, targetPartyId);
}

export async function dalFetchPartyLedger(
  partyId: string,
  params?: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    search?: string;
    type?: "debit" | "credit" | "all";
    sort?: string;
  },
  signal?: AbortSignal,
) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return partiesApi.getLedger(partyId, params, signal);
  }
  const local = await import("./parties.local");
  return local.fetchLocalPartyLedger(partyId, params);
}

export async function dalFetchCounterparties(
  search?: string,
  organizationId?: string | null,
) {
  await ensureLocalFirstFlags();
  if (!shouldUseLocalPersonalLedger(organizationId)) {
    const { fetchCounterparties } = await import("@/services/transactions");
    return fetchCounterparties(search, organizationId);
  }
  const local = await import("./parties.local");
  return local.fetchLocalCounterparties(search, organizationId);
}

export async function dalFetchVendors(
  search?: string,
  organizationId?: string | null,
) {
  await ensureLocalFirstFlags();
  if (!shouldUseLocalPersonalLedger(organizationId)) {
    const { fetchVendors } = await import("@/services/transactions");
    return fetchVendors(search, organizationId);
  }
  const local = await import("./parties.local");
  return local.fetchLocalVendors(search, organizationId);
}
