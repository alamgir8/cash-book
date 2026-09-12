/**
 * Lexicon lookup index — built once, reused forever.
 *
 * Matching priority for a typed/spoken query:
 *  1. Exact alias hit (normalized)
 *  2. Alias starts-with / query starts-with alias
 *  3. Substring / token overlap (same scoring as catalog names)
 *
 * Designed for thousands of aliases: exact hits are Map lookups; fuzzy is a
 * linear scan over entry count (not alias count) with an early cut-off.
 */

import { normalizeForMatch, scoreNameMatch } from "../bangla-nlp";
import { parseLexiconBlob, type LexEntry } from "./format";

export type LexHit = {
  entry: LexEntry;
  /** 0–100, same scale as scoreNameMatch. */
  score: number;
  /** Which alias triggered the hit (displayable). */
  matchedAlias: string;
};

type LexIndex = {
  entries: LexEntry[];
  /** normalized alias → entry id */
  byAlias: Map<string, string>;
  byId: Map<string, LexEntry>;
};

let cached: LexIndex | null = null;

function buildIndex(blob: string): LexIndex {
  const entries = parseLexiconBlob(blob);
  const byAlias = new Map<string, string>();
  const byId = new Map<string, LexEntry>();

  for (const entry of entries) {
    byId.set(entry.id, entry);
    for (const alias of entry.aliases) {
      const key = normalizeForMatch(alias);
      if (!key) continue;
      if (!byAlias.has(key)) byAlias.set(key, entry.id);
    }
  }

  return { entries, byAlias, byId };
}

/** Reset cached index (tests only). */
export function __resetLexiconIndexForTests(): void {
  cached = null;
}

/** Test helper: install a prebuilt index as the process default. */
export function setDefaultLexiconIndex(index: LexIndex | null): void {
  cached = index;
}

function requireIndex(index?: LexIndex): LexIndex {
  const idx = index ?? cached;
  if (!idx) {
    throw new Error("lexicon index not loaded — pass opts.index or call getLexiconIndex()");
  }
  return idx;
}

/** Build from an arbitrary blob (tests / future remote packs). */
export function buildLexiconIndexFromBlob(blob: string): LexIndex {
  return buildIndex(blob);
}

export function lexiconStats(index: LexIndex): {
  entries: number;
  aliases: number;
} {
  return {
    entries: index.entries.length,
    aliases: index.byAlias.size,
  };
}

/**
 * Rank lexicon entries for a free-text query.
 * Returns strongest hits first; empty when nothing is useful.
 */
export function matchLexicon(
  query: string,
  opts?: { limit?: number; minScore?: number; index?: LexIndex },
): LexHit[] {
  const q = normalizeForMatch(query);
  if (!q || q.length < 1) return [];

  const index = requireIndex(opts?.index);
  const limit = opts?.limit ?? 6;
  const minScore = opts?.minScore ?? 40;
  const hits = new Map<string, LexHit>();

  // 1. Exact alias
  const exactId = index.byAlias.get(q);
  if (exactId) {
    const entry = index.byId.get(exactId);
    if (entry) {
      hits.set(entry.id, {
        entry,
        score: 100,
        matchedAlias:
          entry.aliases.find((a) => normalizeForMatch(a) === q) ??
          entry.canonical,
      });
    }
  }

  // 2. Fuzzy over entries (canonical + best alias)
  for (const entry of index.entries) {
    if (hits.has(entry.id) && (hits.get(entry.id)?.score ?? 0) >= 100) continue;

    let best = 0;
    let bestAlias = entry.canonical;
    const canonicalScore = scoreNameMatch(q, entry.canonical);
    if (canonicalScore > best) {
      best = canonicalScore;
      bestAlias = entry.canonical;
    }
    if (best < 100) {
      for (const alias of entry.aliases) {
        const s = scoreNameMatch(q, alias);
        if (s > best) {
          best = s;
          bestAlias = alias;
          if (best >= 100) break;
        }
      }
    }

    // Prefix boost: typed "সাব" → "সাবান"
    if (best < 90) {
      for (const alias of entry.aliases) {
        const n = normalizeForMatch(alias);
        if (n.startsWith(q) && q.length >= 2) {
          const boost = Math.min(92, 70 + q.length * 4);
          if (boost > best) {
            best = boost;
            bestAlias = alias;
          }
        }
      }
    }

    if (best >= minScore) {
      const prev = hits.get(entry.id);
      if (!prev || best > prev.score) {
        hits.set(entry.id, { entry, score: best, matchedAlias: bestAlias });
      }
    }
  }

  return Array.from(hits.values())
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.entry.canonical.localeCompare(b.entry.canonical, "bn"),
    )
    .slice(0, limit);
}

/**
 * Pick the best display name for a parsed item name:
 * lexicon canonical if we have a strong hit, otherwise the raw name.
 */
export function canonicalNameFromLexicon(
  rawName: string,
  opts?: { minScore?: number; index?: LexIndex },
): { name: string; hit: LexHit | null } {
  const hits = matchLexicon(rawName, {
    limit: 1,
    minScore: opts?.minScore ?? 70,
    index: opts?.index,
  });
  const hit = hits[0] ?? null;
  return {
    name:
      hit && hit.score >= (opts?.minScore ?? 70)
        ? hit.entry.canonical
        : rawName,
    hit,
  };
}

export type UnifiedSuggestion = {
  /** What to show on the chip. */
  label: string;
  /** Name to apply when picked (canonical). */
  name: string;
  source: "catalog" | "lexicon" | "alias";
  score: number;
  /** Catalog product id when source is catalog/alias-linked. */
  productId?: string;
  category?: string;
};

/**
 * Merge catalog products + lexicon hits into one suggestion list.
 * Catalog wins on equal score (real stock/price beats a dictionary name).
 */
export function rankUnifiedSuggestions<T extends { _id: string; name: string }>(
  query: string,
  catalog: T[],
  opts?: {
    limit?: number;
    minScore?: number;
    /** Extra user aliases: phrase → { name, productId? } */
    userAliases?: Array<{
      phrase: string;
      name: string;
      productId?: string | null;
    }>;
    index?: LexIndex;
  },
): UnifiedSuggestion[] {
  const q = normalizeForMatch(query);
  if (!q) return [];
  const limit = opts?.limit ?? 6;
  const minScore = opts?.minScore ?? 35;
  const out: UnifiedSuggestion[] = [];
  const seen = new Set<string>();

  const push = (s: UnifiedSuggestion) => {
    const key = normalizeForMatch(s.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };

  for (const a of opts?.userAliases ?? []) {
    const score = scoreNameMatch(q, a.phrase);
    if (score < minScore) continue;
    push({
      label: a.name,
      name: a.name,
      source: "alias",
      score: Math.min(100, score + 5),
      productId: a.productId ?? undefined,
    });
  }

  for (const p of catalog) {
    const score = scoreNameMatch(q, p.name);
    if (score < minScore) continue;
    push({
      label: p.name,
      name: p.name,
      source: "catalog",
      score,
      productId: p._id,
    });
  }

  for (const hit of matchLexicon(q, {
    limit: limit * 2,
    minScore,
    index: opts?.index,
  })) {
    push({
      label: hit.entry.canonical,
      name: hit.entry.canonical,
      source: "lexicon",
      score: hit.score,
      category: hit.entry.category,
    });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
