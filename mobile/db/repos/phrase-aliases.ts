import type { Db } from "../client";
import type { LocalPhraseAlias } from "../types";
import { createLocalId, nowIso } from "@/lib/local-first/ids";
import { normalizeForMatch } from "@/lib/voice/bangla-nlp";

export type UpsertPhraseAliasInput = {
  phrase: string;
  name: string;
  productId?: string | null;
  organizationId?: string | null;
};

function orgKey(organizationId?: string | null): string | null {
  const v = (organizationId ?? "").trim();
  return v ? v : null;
}

export async function listPhraseAliases(
  db: Db,
  opts?: { organizationId?: string | null; limit?: number },
): Promise<LocalPhraseAlias[]> {
  const limit = opts?.limit ?? 500;
  const org = orgKey(opts?.organizationId);
  if (org) {
    return db.getAllAsync<LocalPhraseAlias>(
      `SELECT * FROM phrase_aliases
       WHERE organization_id IS NULL OR organization_id = ?
       ORDER BY use_count DESC, updated_at DESC
       LIMIT ?`,
      org,
      limit,
    );
  }
  return db.getAllAsync<LocalPhraseAlias>(
    `SELECT * FROM phrase_aliases
     ORDER BY use_count DESC, updated_at DESC
     LIMIT ?`,
    limit,
  );
}

export async function findPhraseAlias(
  db: Db,
  phrase: string,
  organizationId?: string | null,
): Promise<LocalPhraseAlias | null> {
  const norm = normalizeForMatch(phrase);
  if (!norm) return null;
  const org = orgKey(organizationId);
  if (org) {
    return (
      (await db.getFirstAsync<LocalPhraseAlias>(
        `SELECT * FROM phrase_aliases
         WHERE phrase_norm = ? AND (organization_id = ? OR organization_id IS NULL)
         ORDER BY CASE WHEN organization_id = ? THEN 0 ELSE 1 END
         LIMIT 1`,
        norm,
        org,
        org,
      )) ?? null
    );
  }
  return (
    (await db.getFirstAsync<LocalPhraseAlias>(
      `SELECT * FROM phrase_aliases WHERE phrase_norm = ? LIMIT 1`,
      norm,
    )) ?? null
  );
}

/** Create or update a shop-specific phrase shortcut. */
export async function upsertPhraseAlias(
  db: Db,
  input: UpsertPhraseAliasInput,
): Promise<LocalPhraseAlias> {
  const phrase = String(input.phrase ?? "").trim();
  const name = String(input.name ?? "").trim();
  if (!phrase || !name) {
    throw new Error("phrase and name are required");
  }
  const norm = normalizeForMatch(phrase);
  const org = orgKey(input.organizationId);
  const existing = await findPhraseAlias(db, phrase, org);
  const ts = nowIso();

  if (existing) {
    await db.runAsync(
      `UPDATE phrase_aliases
       SET name = ?, product_id = ?, phrase = ?, updated_at = ?, use_count = use_count + 1
       WHERE id = ?`,
      name,
      input.productId ?? existing.product_id,
      phrase,
      ts,
      existing.id,
    );
    return {
      ...existing,
      phrase,
      name,
      product_id: input.productId ?? existing.product_id,
      updated_at: ts,
      use_count: existing.use_count + 1,
    };
  }

  const row: LocalPhraseAlias = {
    id: await createLocalId(),
    organization_id: org,
    phrase,
    phrase_norm: norm,
    name,
    product_id: input.productId ?? null,
    use_count: 1,
    created_at: ts,
    updated_at: ts,
  };
  await db.runAsync(
    `INSERT INTO phrase_aliases
      (id, organization_id, phrase, phrase_norm, name, product_id, use_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.organization_id,
    row.phrase,
    row.phrase_norm,
    row.name,
    row.product_id,
    row.use_count,
    row.created_at,
    row.updated_at,
  );
  return row;
}

export async function bumpPhraseAliasUse(db: Db, id: string): Promise<void> {
  await db.runAsync(
    `UPDATE phrase_aliases SET use_count = use_count + 1, updated_at = ? WHERE id = ?`,
    nowIso(),
    id,
  );
}

export async function deletePhraseAlias(db: Db, id: string): Promise<void> {
  await db.runAsync(`DELETE FROM phrase_aliases WHERE id = ?`, id);
}
