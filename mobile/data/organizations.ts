import { getDb } from "@/db/client";
import * as orgRepo from "@/db/repos/organizations";
import { enqueuePendingOp } from "@/db/repos/settings";
import type {
  CreateOrganizationParams,
  Organization,
  OrganizationMember,
  OrganizationSummary,
  UpdateOrganizationParams,
} from "@/services/organizations";
import { organizationsApi } from "@/services/organizations";
import { mergeSettings } from "@/lib/local-first/settings-sync";
import { nowIso } from "@/lib/local-first/ids";

/**
 * Organization (= Shop) DAL.
 *
 * Reads: server first, falling back to the local mirror so the shop switcher
 * and org screens keep working offline.
 * Writes: applied to the local mirror immediately and queued in the outbox, so
 * currency/status/name edits save offline. Create/delete still require the
 * backend because the server owns the id and slug used by every org-scoped row.
 */

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function cacheOrganizations(orgs: Organization[]): Promise<void> {
  if (!orgs?.length) return;
  const db = await getDb();
  for (const org of orgs) {
    const settings = (org.settings ?? {}) as Record<string, any>;
    await orgRepo.upsertOrganization(db, {
      id: org._id,
      name: org.name,
      business_type: org.business_type,
      role: org.role,
      permissions_json: JSON.stringify(org.permissions ?? {}),
      settings_json: JSON.stringify(settings),
      currency_code: settings.currency_code ?? settings.currency ?? null,
      currency_symbol: settings.currency_symbol ?? null,
      invoice_prefix: settings.invoice_prefix ?? null,
      invoice_next_number: settings.invoice_next_number ?? 1,
      tax_rate: settings.tax_rate ?? 0,
      allow_negative_balance: settings.allow_negative_balance ?? false,
      address_json: JSON.stringify(org.address ?? {}),
      phone: org.contact?.phone ?? (org as any).phone ?? null,
      email: org.contact?.email ?? (org as any).email ?? null,
      logo_url: org.logo ?? null,
      status: org.status ?? null,
      created_at: org.createdAt,
      updated_at: org.updatedAt,
    });
  }
}

export async function readCachedOrganizations(): Promise<OrganizationSummary[]> {
  const db = await getDb();
  const rows = await orgRepo.listOrganizations(db);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    business_type: row.business_type ?? "other",
    role: row.role ?? "owner",
    permissions: safeJson(row.permissions_json, {}),
    settings: safeJson(row.settings_json, {} as any),
  }));
}

/**
 * Cached org as a full `Organization` (what the form/settings modals expect).
 */
export function cachedOrganizationToApi(
  row: Awaited<ReturnType<typeof orgRepo.listOrganizations>>[number],
): Organization {
  const settings = safeJson<Record<string, any>>(row.settings_json, {});
  if (row.currency_code && !settings.currency_code) {
    settings.currency_code = row.currency_code;
  }
  if (row.invoice_prefix && !settings.invoice_prefix) {
    settings.invoice_prefix = row.invoice_prefix;
  }
  return {
    _id: row.id,
    name: row.name,
    business_type: row.business_type ?? "other",
    description: settings.description ?? undefined,
    owner: "",
    settings: settings as any,
    status: (row.status as any) ?? "active",
    address: safeJson(row.address_json, {}),
    contact: { phone: row.phone ?? undefined, email: row.email ?? undefined },
    is_active: row.status !== "archived",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function readCachedOrganizationsFull(): Promise<Organization[]> {
  const db = await getDb();
  const rows = await orgRepo.listOrganizations(db);
  return rows.map(cachedOrganizationToApi);
}

export async function getCachedOrganization(
  orgId: string,
): Promise<Organization | null> {
  const db = await getDb();
  const row = await orgRepo.getOrganization(db, orgId);
  return row ? cachedOrganizationToApi(row) : null;
}

/** Server list with an offline fallback to the local mirror. */
export async function dalFetchOrganizations(): Promise<{
  organizations: Organization[];
  fromCache: boolean;
}> {
  try {
    // Push any queued org edits BEFORE pulling, so local changes aren't
    // overwritten by a stale server row.
    const { flushPendingOps } = await import("@/lib/local-first/settings-sync");
    await flushPendingOps().catch(() => {});

    const orgs = await organizationsApi.list();
    await cacheOrganizations(orgs).catch(() => {});
    return { organizations: orgs, fromCache: false };
  } catch {
    const cached = await readCachedOrganizationsFull();
    return { organizations: cached, fromCache: true };
  }
}

export async function dalFetchOrganization(orgId: string): Promise<{
  organization: Organization;
  members: OrganizationMember[];
  fromCache: boolean;
}> {
  try {
    const { organization, members } = await organizationsApi.get(orgId);
    await cacheOrganizations([organization as Organization]).catch(() => {});
    return {
      organization,
      members: (members ?? []) as OrganizationMember[],
      fromCache: false,
    };
  } catch {
    const cached = await getCachedOrganization(orgId);
    if (!cached) throw new Error("Organization not found");
    // Members are cloud-owned; the cached org still lets settings work offline.
    return { organization: cached, members: [], fromCache: true };
  }
}

/**
 * Offline-first org update: mirror locally, queue for the server, return the
 * merged local view immediately.
 */
export async function dalUpdateOrganization(
  orgId: string,
  params: UpdateOrganizationParams,
): Promise<Organization> {
  const db = await getDb();
  const existing = await orgRepo.getOrganization(db, orgId);

  const mergedSettings = mergeSettings(
    safeJson<Record<string, any>>(existing?.settings_json ?? null, {}),
    (params.settings ?? {}) as Record<string, any>,
  );
  const address = mergeSettings(
    safeJson<Record<string, any>>(existing?.address_json ?? null, {}),
    (params.address ?? {}) as Record<string, any>,
  );
  const contact = mergeSettings(
    {
      phone: existing?.phone ?? null,
      email: existing?.email ?? null,
    },
    (params.contact ?? {}) as Record<string, any>,
  );

  // Persist to the local mirror first (instant, offline-safe).
  await orgRepo.upsertOrganization(db, {
    id: orgId,
    name: params.name ?? existing?.name ?? "",
    business_type: params.business_type ?? existing?.business_type ?? null,
    role: existing?.role ?? null,
    permissions_json: existing?.permissions_json ?? JSON.stringify({}),
    settings_json: JSON.stringify(mergedSettings),
    currency_code:
      mergedSettings.currency_code ?? mergedSettings.currency ?? existing?.currency_code ?? null,
    currency_symbol: mergedSettings.currency_symbol ?? existing?.currency_symbol ?? null,
    invoice_prefix: mergedSettings.invoice_prefix ?? existing?.invoice_prefix ?? null,
    invoice_next_number:
      mergedSettings.invoice_next_number ?? existing?.invoice_next_number ?? 1,
    tax_rate: mergedSettings.tax_rate ?? existing?.tax_rate ?? 0,
    allow_negative_balance:
      mergedSettings.allow_negative_balance ?? existing?.allow_negative_balance ?? false,
    address_json: JSON.stringify(address),
    phone: contact.phone ?? null,
    email: contact.email ?? null,
    logo_url: (params as any).logo ?? existing?.logo_url ?? null,
    status: (params.status as any) ?? existing?.status ?? "active",
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
  });

  await enqueuePendingOp(db, {
    entity: "organization",
    entity_id: orgId,
    payload: params as Record<string, unknown>,
  });

  // Best-effort immediate push so online edits reconcile right away.
  try {
    const { flushPendingOps } = await import("@/lib/local-first/settings-sync");
    const result = await flushPendingOps();
    if (result.flushed > 0 && result.failed === 0) {
      const fresh = await organizationsApi.get(orgId).catch(() => null);
      if (fresh?.organization) {
        await cacheOrganizations([fresh.organization as Organization]).catch(
          () => {},
        );
      }
    }
  } catch {
    /* stays queued */
  }

  const updated = await orgRepo.getOrganization(db, orgId);
  if (!updated) throw new Error("Organization not found");
  return cachedOrganizationToApi(updated);
}

/**
 * Create requires the backend: the server owns the org id used by every
 * org-scoped ledger/shop row, so an offline create cannot be reconciled safely.
 */
export async function dalCreateOrganization(
  params: CreateOrganizationParams,
): Promise<Organization> {
  const org = await organizationsApi.create(params);
  await cacheOrganizations([org]).catch(() => {});
  return org;
}

/** Delete requires the backend (destructive + cascades server-side). */
export async function dalDeleteOrganization(orgId: string): Promise<void> {
  await organizationsApi.delete(orgId);
  try {
    const db = await getDb();
    await db.runAsync("DELETE FROM organizations WHERE id = ?", orgId);
  } catch {
    /* cache cleanup is best-effort */
  }
}
