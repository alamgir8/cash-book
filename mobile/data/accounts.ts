import {
  createAccount as apiCreateAccount,
  deleteAccount as apiDeleteAccount,
  fetchAccounts,
  fetchAccountsOverview,
  updateAccount as apiUpdateAccount,
  type AccountOverview,
} from "@/services/accounts";
import type { AccountPayload } from "@/types/account";
import {
  ensureLocalFirstFlags,
  isLocalFirstEnabled,
} from "@/lib/local-first/flags";
import { shouldUseLocalPersonalLedger } from "@/lib/local-first/ledger-scope";
import type { TransactionFilters } from "@/services/transactions";

export async function dalFetchAccounts(
  organizationId?: string | null,
): Promise<AccountOverview[]> {
  await ensureLocalFirstFlags();
  if (!shouldUseLocalPersonalLedger(organizationId)) {
    return fetchAccounts(organizationId);
  }
  const local = await import("./accounts.local");
  return local.fetchLocalAccounts(organizationId);
}

export async function dalFetchAccountsOverview(
  organizationId?: string | null,
): Promise<AccountOverview[]> {
  await ensureLocalFirstFlags();
  if (!shouldUseLocalPersonalLedger(organizationId)) {
    return fetchAccountsOverview(organizationId);
  }
  return dalFetchAccounts(organizationId);
}

export async function dalFetchAccountDetail(accountId: string) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    const { fetchAccountDetail } = await import("@/services/accounts");
    return fetchAccountDetail(accountId);
  }
  const local = await import("./accounts.local");
  return local.fetchLocalAccountDetail(accountId);
}

export async function dalFetchAccountTransactions(
  accountId: string,
  filters: TransactionFilters,
) {
  await ensureLocalFirstFlags();
  if (!shouldUseLocalPersonalLedger(filters.organizationId)) {
    const { fetchAccountTransactions } = await import("@/services/accounts");
    return fetchAccountTransactions(accountId, filters);
  }
  const local = await import("./accounts.local");
  return local.fetchLocalAccountTransactions(accountId, filters);
}

export async function dalCreateAccount(
  payload: AccountPayload & { organization?: string | null },
) {
  await ensureLocalFirstFlags();
  if (!shouldUseLocalPersonalLedger(payload.organization)) {
    return apiCreateAccount(payload);
  }
  const local = await import("./accounts.local");
  return local.createLocalAccount(payload);
}

export async function dalUpdateAccount(
  args: { accountId: string; archived?: boolean } & Partial<AccountPayload>,
) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return apiUpdateAccount(args);
  }
  const local = await import("./accounts.local");
  return local.updateLocalAccount(args);
}

export async function dalDeleteAccount(accountId: string) {
  await ensureLocalFirstFlags();
  if (!isLocalFirstEnabled()) {
    return apiDeleteAccount(accountId);
  }
  const local = await import("./accounts.local");
  return local.deleteLocalAccount(accountId);
}
