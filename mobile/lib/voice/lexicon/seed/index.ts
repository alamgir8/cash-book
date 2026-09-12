import staples from "./staples";
import produce from "./produce";
import goods from "./goods";
import brands from "./brands";
import brandMap from "./brand-map";

/**
 * All bundled seed blobs concatenated. Keep categories in separate files so
 * future expansions stay reviewable diffs. Append new packs here.
 *
 * See docs/LEXICON_GUIDE.md for how to add words / brands.
 */
export function getBundledLexiconBlob(): string {
  return [staples, produce, goods, brands, brandMap].join("\n");
}
