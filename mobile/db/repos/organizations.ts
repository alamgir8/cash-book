import type { Db } from "../client";
import type { LocalOrganization } from "../types";
import { nowIso } from "@/lib/local-first/ids";

export type OrganizationCacheInput = {
  id: string;
  name: string;
  business_type?: string | null;
  role?: string | null;
  permissions_json?: string | null;
  settings_json?: string | null;
  currency_code?: string | null;
  currency_symbol?: string | null;
  invoice_prefix?: string | null;
  invoice_next_number?: number;
  tax_rate?: number;
  allow_negative_balance?: boolean | number;
  address_json?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function upsertOrganization(
  db: Db,
  input: OrganizationCacheInput,
): Promise<void> {
  const ts = nowIso();
  await db.runAsync(
    `INSERT INTO organizations (
      id, server_id, name, business_type,
      currency_code, currency_symbol, invoice_prefix, invoice_next_number,
      tax_rate, allow_negative_balance, role, permissions_json, settings_json,
      address_json, phone, email, logo_url, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      server_id = excluded.server_id,
      name = excluded.name,
      business_type = excluded.business_type,
      currency_code = excluded.currency_code,
      currency_symbol = excluded.currency_symbol,
      invoice_prefix = excluded.invoice_prefix,
      invoice_next_number = excluded.invoice_next_number,
      tax_rate = excluded.tax_rate,
      allow_negative_balance = excluded.allow_negative_balance,
      role = excluded.role,
      permissions_json = excluded.permissions_json,
      settings_json = excluded.settings_json,
      address_json = excluded.address_json,
      phone = excluded.phone,
      email = excluded.email,
      logo_url = excluded.logo_url,
      status = excluded.status,
      updated_at = excluded.updated_at`,
    input.id,
    input.id,
    input.name,
    input.business_type ?? null,
    input.currency_code ?? null,
    input.currency_symbol ?? null,
    input.invoice_prefix ?? null,
    Number(input.invoice_next_number ?? 1),
    Number(input.tax_rate ?? 0),
    input.allow_negative_balance ? 1 : 0,
    input.role ?? null,
    input.permissions_json ?? null,
    input.settings_json ?? null,
    input.address_json ?? null,
    input.phone ?? null,
    input.email ?? null,
    input.logo_url ?? null,
    input.status ?? null,
    input.created_at ?? ts,
    input.updated_at ?? ts,
  );
}

export async function listOrganizations(db: Db): Promise<LocalOrganization[]> {
  return db.getAllAsync<LocalOrganization>(
    "SELECT * FROM organizations ORDER BY name COLLATE NOCASE ASC",
  );
}

export async function getOrganization(
  db: Db,
  id: string,
): Promise<LocalOrganization | null> {
  return (
    (await db.getFirstAsync<LocalOrganization>(
      "SELECT * FROM organizations WHERE id = ?",
      id,
    )) ?? null
  );
}
