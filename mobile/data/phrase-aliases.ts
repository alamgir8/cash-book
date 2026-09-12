/**
 * Thin DAL for shop phrase aliases (local-only shortcuts).
 * Keeps SmartAddBar free of direct repo imports.
 */
import { getDb } from "@/db/client";
import * as aliasesRepo from "@/db/repos/phrase-aliases";
import type { LocalPhraseAlias } from "@/db/types";
import { isLocalFirstEnabled } from "@/lib/local-first/flags";

export async function dalListPhraseAliases(opts?: {
  organizationId?: string | null;
  limit?: number;
}): Promise<Array<{ phrase: string; name: string; productId?: string | null }>> {
  if (!isLocalFirstEnabled()) return [];
  try {
    const db = await getDb();
    const rows = await aliasesRepo.listPhraseAliases(db, opts);
    return rows.map((r) => ({
      phrase: r.phrase,
      name: r.name,
      productId: r.product_id,
    }));
  } catch {
    return [];
  }
}

export async function dalSavePhraseAlias(input: {
  phrase: string;
  name: string;
  productId?: string | null;
  organizationId?: string | null;
}): Promise<LocalPhraseAlias | null> {
  if (!isLocalFirstEnabled()) return null;
  try {
    const db = await getDb();
    return await aliasesRepo.upsertPhraseAlias(db, input);
  } catch {
    return null;
  }
}
