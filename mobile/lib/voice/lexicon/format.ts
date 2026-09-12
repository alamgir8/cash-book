/**
 * Compact Bangla shop lexicon format.
 *
 * Line grammar:
 *   Product / brand entry:
 *     canonical|alias1|alias2|…
 *   Brand map (product family → suggested brands):
 *     productFamily>brand1|brand2|brand3
 * Comments:
 *   # category:staples
 *   # category:brand_map
 *   # category:brands
 *
 * See docs/LEXICON_GUIDE.md for editing instructions.
 */

export type LexCategory =
  | "staples"
  | "spices"
  | "oil_ghee"
  | "dairy_eggs"
  | "meat_fish"
  | "vegetables"
  | "fruits"
  | "snacks"
  | "beverages"
  | "personal_care"
  | "household"
  | "baby"
  | "medicine"
  | "stationery"
  | "electronics"
  | "apparel"
  | "brands"
  | "brand_map"
  | "other";

export type LexEntry = {
  /** Stable id: category + canonical (normalized). */
  id: string;
  canonical: string;
  category: LexCategory | string;
  /** All searchable forms including the canonical. */
  aliases: string[];
};

/** product family → brand display names */
export type BrandMap = Map<string, string[]>;

const CATEGORY_RE = /^#\s*category\s*:\s*([a-z0-9_]+)\s*$/i;

export type ParsedLexicon = {
  entries: LexEntry[];
  brandMap: BrandMap;
};

/** Parse a compact seed blob into entries (legacy helper). */
export function parseLexiconBlob(blob: string): LexEntry[] {
  return parseLexiconFull(blob).entries;
}

/** Parse entries + brand maps. Pure — no I/O. */
export function parseLexiconFull(blob: string): ParsedLexicon {
  const entries: LexEntry[] = [];
  const brandMap: BrandMap = new Map();
  let category: string = "other";
  const seenIds = new Set<string>();

  for (const rawLine of String(blob ?? "").split(/\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const catMatch = line.match(CATEGORY_RE);
    if (catMatch) {
      category = catMatch[1].toLowerCase();
      continue;
    }
    if (line.startsWith("#")) continue;

    // Brand map: সাবান>লাক্স|লাইফবয়
    if (line.includes(">")) {
      const [left, right] = line.split(">");
      const family = (left ?? "").trim();
      const brands = (right ?? "")
        .split("|")
        .map((b) => b.trim())
        .filter(Boolean);
      if (family && brands.length) {
        const prev = brandMap.get(family) ?? [];
        brandMap.set(family, Array.from(new Set([...prev, ...brands])));
      }
      continue;
    }

    const fields = line
      .split("|")
      .map((f) => f.trim())
      .filter(Boolean);
    if (fields.length === 0) continue;

    const canonical = fields[0];
    const aliases = Array.from(new Set(fields));
    const id = `${category}:${canonical}`;
    if (seenIds.has(id)) {
      const existing = entries.find((e) => e.id === id);
      if (existing) {
        for (const a of aliases) {
          if (!existing.aliases.includes(a)) existing.aliases.push(a);
        }
      }
      continue;
    }
    seenIds.add(id);
    entries.push({ id, canonical, category, aliases });
  }

  return { entries, brandMap };
}

/** Approximate byte size of a blob (for diagnostics / tests). */
export function blobByteLength(blob: string): number {
  let n = 0;
  for (let i = 0; i < blob.length; i++) {
    const c = blob.charCodeAt(i);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : 3;
  }
  return n;
}
