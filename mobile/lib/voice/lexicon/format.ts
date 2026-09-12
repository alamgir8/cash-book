/**
 * Compact Bangla shop lexicon format.
 *
 * WHY THIS FORMAT (not a huge JSON array of objects):
 * - One line per product family → thousands of aliases stay small on disk.
 * - Easy to edit/append without JSON commas breaking.
 * - Parsed once into Maps at startup; O(1) exact + fast prefix scan.
 *
 * Line grammar:
 *   canonical|alias1|alias2|…
 * Comments:
 *   # category:groceries
 *   # any note
 *
 * Rules:
 * - First field is the canonical Bangla display name shown in the UI.
 * - Later fields are aliases (Bangla, English, romanized) — all optional.
 * - Canonical is always indexed as an alias of itself.
 * - Blank lines ignored. Leading/trailing spaces trimmed per field.
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
  | "other";

export type LexEntry = {
  /** Stable id: category + canonical (normalized). */
  id: string;
  canonical: string;
  category: LexCategory | string;
  /** All searchable forms including the canonical. */
  aliases: string[];
};

const CATEGORY_RE = /^#\s*category\s*:\s*([a-z0-9_]+)\s*$/i;

/** Parse a compact seed blob into entries. Pure — no I/O. */
export function parseLexiconBlob(blob: string): LexEntry[] {
  const entries: LexEntry[] = [];
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

    const fields = line
      .split("|")
      .map((f) => f.trim())
      .filter(Boolean);
    if (fields.length === 0) continue;

    const canonical = fields[0];
    const aliases = Array.from(new Set(fields));
    const id = `${category}:${canonical}`;
    if (seenIds.has(id)) {
      // Merge aliases into the existing entry of the same id.
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

  return entries;
}

/** Approximate byte size of a blob (for diagnostics / tests). */
export function blobByteLength(blob: string): number {
  // UTF-8 length without allocating a Buffer (Hermes-safe).
  let n = 0;
  for (let i = 0; i < blob.length; i++) {
    const c = blob.charCodeAt(i);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : 3;
  }
  return n;
}
