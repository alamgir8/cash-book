/**
 * Public lexicon API for the app.
 * Seed packs load here once; pure matching lives in lookup.ts (testable without Metro).
 */
import { getBundledLexiconBlob } from "./seed";
import {
  __resetLexiconIndexForTests as resetLookupCache,
  buildLexiconIndexFromBlob,
  setDefaultLexiconIndex,
} from "./lookup";

export {
  buildLexiconIndexFromBlob,
  matchLexicon,
  canonicalNameFromLexicon,
  rankUnifiedSuggestions,
  lexiconStats,
  setDefaultLexiconIndex,
} from "./lookup";
export type { LexHit, UnifiedSuggestion } from "./lookup";
export type { LexEntry, LexCategory } from "./format";
export { parseLexiconBlob, blobByteLength } from "./format";

let warmed: ReturnType<typeof buildLexiconIndexFromBlob> | null = null;

/** Ensure the bundled seed is indexed (idempotent). */
export function getLexiconIndex() {
  if (!warmed) {
    warmed = buildLexiconIndexFromBlob(getBundledLexiconBlob());
    setDefaultLexiconIndex(warmed);
  }
  return warmed;
}

/** Warm the index at app start (optional). */
export function warmLexicon(): void {
  getLexiconIndex();
}

export function __resetLexiconIndexForTests(): void {
  warmed = null;
  resetLookupCache();
  setDefaultLexiconIndex(null);
}

// Warm on first import so SmartAddBar match calls have an index ready.
getLexiconIndex();
