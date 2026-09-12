import staples from "./staples";
import produce from "./produce";
import goods from "./goods";
import brands from "./brands";

/**
 * All bundled seed blobs concatenated. Keep categories in separate files so
 * future expansions stay reviewable diffs. Append new packs here.
 */
export function getBundledLexiconBlob(): string {
  return [staples, produce, goods, brands].join("\n");
}
