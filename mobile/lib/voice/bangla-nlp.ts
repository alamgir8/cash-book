/**
 * Bangla natural-language item parser.
 *
 * Turns a spoken or typed phrase into a structured product / line item, so a
 * fast-moving shop can say or type one sentence instead of filling five fields:
 *
 *   "Lux সাবান/সাবান ২টা ৪৫টাকা করে"
 *     → { name: "Lux সাবান/সাবান", quantity: 2, unit: "pcs", unit_price: 45 }
 *
 *   "২ কেজি চাল ৮০ টাকা"
 *     → { name: "চাল", quantity: 2, unit: "kg", unit_price: 80 }
 *
 *   "সাবান ২টা ৩৫ টাকা করে ৪৫ টাকা বিক্রয়"
 *     → cost 35, sale 45 (two prices)
 *
 * Design notes:
 * - **No AI, no network.** Deterministic token parsing, so it is instant and
 *   works offline (locked decision: no paid AI APIs).
 * - Dependency-free so the pure test suite can load it via
 *   `node --experimental-strip-types`.
 * - The same function serves voice transcripts and typed text, because speech
 *   recognition is just another source of a string.
 */

// ── Digits & numbers ────────────────────────────────────────────────────────

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Map Bangla digits ০-৯ to ASCII and unify common Indic digit forms. */
export function normalizeDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const idx = BANGLA_DIGITS.indexOf(ch);
    out += idx >= 0 ? String(idx) : ch;
  }
  return out;
}

/** Spoken number words, including the fractions shops actually use. */
const NUMBER_WORDS: Record<string, number> = {
  শূন্য: 0,
  এক: 1,
  একটি: 1,
  একটা: 1,
  দুই: 2,
  দু: 2,
  দুটি: 2,
  দুটা: 2,
  দুইটা: 2,
  তিন: 3,
  তিনটি: 3,
  তিনটা: 3,
  চার: 4,
  চারটা: 4,
  পাঁচ: 5,
  পাচ: 5,
  পাঁচটা: 5,
  ছয়: 6,
  ছয়টা: 6,
  সাত: 7,
  সাতটা: 7,
  আট: 8,
  আটটা: 8,
  নয়: 9,
  নয়টা: 9,
  দশ: 10,
  দশটা: 10,
  এগারো: 11,
  বারো: 12,
  তেরো: 13,
  চৌদ্দ: 14,
  পনেরো: 15,
  ষোল: 16,
  সতেরো: 17,
  আঠারো: 18,
  উনিশ: 19,
  বিশ: 20,
  কুড়ি: 20,
  ত্রিশ: 30,
  চল্লিশ: 40,
  পঞ্চাশ: 50,
  ষাট: 60,
  সত্তর: 70,
  আশি: 80,
  নব্বই: 90,
  একশ: 100,
  একশত: 100,
  দুইশ: 200,
  তিনশ: 300,
  পাঁচশ: 500,
  হাজার: 1000,
  // Fractions / halves common in bazaar speech
  দেড়: 1.5,
  আড়াই: 2.5,
  সোয়া: 1.25,
};

/**
 * Parse a single token as a number (digits or a spoken word).
 * `সাড়ে` is a prefix multiplier used as "সাড়ে তিন" = 3.5.
 */
export function parseNumber(token: string): number | null {
  const raw = normalizeDigits(token).replace(/[.]$/, "").trim();
  if (!raw) return null;
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw);

  // "সাড়ে তিন" arrives as two tokens; callers handle it, but accept glued form.
  const half = /^সাড়ে(.+)$/.exec(raw);
  if (half) {
    const base = NUMBER_WORDS[half[1]];
    if (base !== undefined) return base + 0.5;
  }
  const word = NUMBER_WORDS[raw];
  return word === undefined ? null : word;
}

// ── Units ───────────────────────────────────────────────────────────────────

/** Bangla / English unit aliases → canonical unit used by the product schema. */
const UNIT_ALIASES: Record<string, string> = {
  // pieces
  টা: "pcs",
  টি: "pcs",
  টাই: "pcs",
  পিস: "pcs",
  পিসস: "pcs",
  নগ: "pcs",
  অণু: "pcs",
  pcs: "pcs",
  pc: "pcs",
  piece: "pcs",
  pieces: "pcs",
  // weight
  কেজি: "kg",
  কিলো: "kg",
  কেজী: "kg",
  kg: "kg",
  kilo: "kg",
  গ্রাম: "g",
  গ্রামে: "g",
  জিএম: "g",
  gm: "g",
  g: "g",
  মিলিগ্রাম: "mg",
  mg: "mg",
  // volume
  লিটার: "liter",
  লিটা: "liter",
  লি: "liter",
  liter: "liter",
  litre: "liter",
  ltr: "liter",
  L: "liter",
  মিলি: "ml",
  মিলিলিটার: "ml",
  ml: "ml",
  // packaging
  বাক্স: "box",
  বক্স: "box",
  box: "box",
  প্যাকেট: "pack",
  প্যাকেটে: "pack",
  প্যাক: "pack",
  packet: "pack",
  pack: "pack",
  ডজন: "dozen",
  ডজনটা: "dozen",
  dozen: "dozen",
  জোড়া: "pair",
  জোরা: "pair",
  pair: "pair",
  সেট: "set",
  set: "set",
  ব্যাগ: "bag",
  bag: "bag",
  বোতল: "bottle",
  বোতলে: "bottle",
  bottle: "bottle",
  ক্যান: "can",
  can: "can",
  কার্টন: "carton",
  কার্টুন: "carton",
  carton: "carton",
  // length / area
  মিটার: "meter",
  মিটা: "meter",
  meter: "meter",
  metre: "meter",
  সেমি: "cm",
  cm: "cm",
  মিমি: "mm",
  mm: "mm",
  ফুট: "ft",
  ফিট: "ft",
  ft: "ft",
  feet: "ft",
  ইঞ্চি: "inch",
  inch: "inch",
  গজ: "yard",
  yard: "yard",
  // misc
  রোল: "roll",
  roll: "roll",
  শিট: "sheet",
  sheet: "sheet",
};

/** Canonical unit for a token, or null when the token is not a unit. */
export function detectUnit(token: string): string | null {
  const t = token.replace(/[.,।]+$/, "").trim();
  if (!t) return null;
  return UNIT_ALIASES[t] ?? UNIT_ALIASES[t.toLowerCase()] ?? null;
}

// Longest aliases first so "কেজি" wins over "জি".
const UNIT_SUFFIXES = Object.keys(UNIT_ALIASES).sort(
  (a, b) => b.length - a.length,
);

/**
 * Split a single glued token into number + unit, e.g. "দুইটা" → 2 pcs,
 * "২টা" → 2 pcs (already padded), "2kg" → 2 kg. Returns null when the token
 * has no numeric prefix, so ordinary names like "ভিটা" are left alone.
 */
export function parseGluedNumberUnit(
  token: string,
): { num: number; unit: string } | null {
  const t = token.replace(/[.,।]+$/, "").trim();
  if (t.length < 2) return null;
  for (const suffix of UNIT_SUFFIXES) {
    if (t.length <= suffix.length || !t.endsWith(suffix)) continue;
    const prefix = t.slice(0, -suffix.length);
    const num = parseNumber(prefix);
    if (num !== null) return { num, unit: UNIT_ALIASES[suffix] };
  }
  return null;
}

// ── Keywords ────────────────────────────────────────────────────────────────

/** Tokens that signal "this number is a price". */
const PRICE_MARKERS = new Set([
  "টাকা",
  "টাকায়",
  "টাকার",
  "টাকাই",
  "taka",
  "tk",
  "৳",
  "৳.",
  "টাকাতে",
  "টাকায়।",
  "price",
  "দরে",
  "দর",
  "রেট",
  "rate",
  "মূল্য",
  "দাম",
  // "৪৫ করে" = 45 each, without needing the word টাকা.
  "করে",
]);

/** Tokens that mean "per unit" — safe to drop from a product name. */
const FILLER_WORDS = new Set([
  "করে",
  "প্রতি",
  "per",
  "each",
  "only",
  "মাত্র",
  "এর",
  "টা", // handled as unit first; drop if it survived
  "টি",
  "এ",
  "ও",
  "আর",
  "and",
  "for",
  "at",
  "মোট",
  "সহ",
  "দিয়ে",
  "নিলাম",
  "নিলামো",
  "কিনলাম",
  "কিনেছি",
  "বেচলাম",
  "বেচেছি",
  "বিক্রি",
  "বিক্রয়",
  "ক্রয়",
  "কেনা",
  "কিনা",
  "পেয়েছি",
  "খরচ",
  "দামে",
  "পাইস",
  "পাইস্যা",
  "পাইসা",
  "হলো",
  "হল",
  "এবং",
  "সার",
  "মোট",
]);

const PURCHASE_HINTS = new Set([
  "ক্রয়",
  "কিনলাম",
  "কিনেছি",
  "কেনা",
  "কিনা",
  "পেয়েছি",
  "cost",
  "পাইকারি",
  "খরিদ",
]);

const SALE_HINTS = new Set([
  "বিক্রয়",
  "বেচলাম",
  "বেচেছি",
  "বিক্রি",
  "sell",
  "sale",
  "বিক্রি",
  "খুচরা",
]);

// ── Types ───────────────────────────────────────────────────────────────────

export type ParsedItem = {
  /** Original phrase this was parsed from. */
  raw: string;
  /** Product/line name with quantities, units and prices removed. */
  name: string;
  quantity: number | null;
  unit: string | null;
  /** Price per unit when a single price was spoken. */
  unit_price: number | null;
  /** Set only when the phrase gives a distinct cost price. */
  purchase_price: number | null;
  /** Set only when the phrase gives a distinct selling price. */
  sale_price: number | null;
  /** True when two prices were given but which-is-which was assumed. */
  pricingAmbiguous: boolean;
  /** high = name+qty+price, medium = any two, low = name only. */
  confidence: "high" | "medium" | "low";
};

/**
 * Pad numbers with spaces so glued forms split: "৪৫টাকা" → "45 টাকা",
 * "২টা" → "2 টা". Decimal points are preserved.
 */
function padNumbers(text: string): string {
  return text
    .replace(/(\d+(?:\.\d+)?)/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Leading/trailing punctuation that is never part of a product name. */
function cleanName(tokens: string[]): string {
  const joined = tokens.join(" ").replace(/\s+/g, " ").trim();
  return joined
    .replace(/^[\s.,;:!?।\-–—_]+/, "")
    .replace(/[\s.,;:!?।\-–—_]+$/, "")
    .replace(/\s*\/\s*/g, "/")
    .trim();
}

/**
 * Parse one item phrase. Order-independent: "চাল ২ কেজি ৮০ টাকা" and
 * "২ কেজি চাল ৮০ টাকা" both work.
 */
export function parseBanglaItem(input: string): ParsedItem {
  const raw = String(input ?? "").trim();
  const normalized = padNumbers(normalizeDigits(raw));
  const tokens = normalized.length ? normalized.split(" ") : [];

  const consumed = new Array<boolean>(tokens.length).fill(false);
  const prices: {
    value: number;
    index: number;
    tag: "purchase" | "sale" | null;
  }[] = [];
  let quantity: number | null = null;
  let unit: string | null = null;

  const isHint = (tok: string) =>
    PURCHASE_HINTS.has(tok) || SALE_HINTS.has(tok);

  /** Nearest price hint within a window, so "৩৫ টাকা করে ৪৫ বিক্রয়" tags right. */
  const hintNear = (from: number, to: number): "purchase" | "sale" | null => {
    for (
      let k = Math.max(0, from);
      k <= Math.min(tokens.length - 1, to);
      k++
    ) {
      if (PURCHASE_HINTS.has(tokens[k])) return "purchase";
      if (SALE_HINTS.has(tokens[k])) return "sale";
    }
    return null;
  };

  // ── 1) Quantity + unit ──────────────────────────────────────────────────
  for (let i = 0; i < tokens.length && unit === null; i++) {
    if (consumed[i]) continue;
    const tok = tokens[i];
    const canonical = detectUnit(tok);

    if (canonical) {
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        if (consumed[j]) continue;
        const num = parseNumber(tokens[j]);
        if (num !== null) {
          quantity = num;
          consumed[j] = true;
          consumed[i] = true;
          unit = canonical;
          // "সাড়ে তিন কেজি" → 3.5 kg
          if (j - 1 >= 0 && tokens[j - 1] === "সাড়ে") {
            quantity = num + 0.5;
            consumed[j - 1] = true;
          }
          break;
        }
        if (isHint(tokens[j]) || PRICE_MARKERS.has(tokens[j])) continue;
        // Any other word means the number (if any) belongs to another phrase.
        if (/[\u0980-\u09FFa-zA-Z0-9.]/.test(tokens[j])) break;
      }
      continue;
    }

    // Glued number+unit in one token: "দুইটা", "2kg".
    const glued = parseGluedNumberUnit(tok);
    if (glued && quantity === null) {
      quantity = glued.num;
      unit = glued.unit;
      consumed[i] = true;
    }
  }

  // ── 2) Prices: a number adjacent to a price marker ──────────────────────
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!PRICE_MARKERS.has(tok)) continue;

    let value: number | null = null;
    let numIdx = -1;

    // Two consecutive numbers before one marker ("চাল ৮০ ৯৫ টাকা") are two
    // prices — speech often drops the second unit word.
    const numbersBefore: number[] = [];
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      if (consumed[j]) continue;
      if (parseNumber(tokens[j]) !== null) {
        numbersBefore.push(j);
        continue;
      }
      break;
    }
    if (numbersBefore.length >= 2) {
      // `numbersBefore` is nearest-first; reverse so the leftmost number is
      // the first price (cost before sale).
      for (const idx of numbersBefore.slice(0, 2).reverse()) {
        prices.push({
          value: parseNumber(tokens[idx])!,
          index: idx,
          tag: hintNear(idx - 3, idx + 3),
        });
        consumed[idx] = true;
      }
      consumed[i] = true;
      continue;
    }

    // Prefer the number immediately BEFORE the marker ("৪৫ টাকা").
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      if (consumed[j]) continue;
      const num = parseNumber(tokens[j]);
      if (num !== null) {
        value = num;
        numIdx = j;
        break;
      }
      if (detectUnit(tokens[j])) break;
    }

    // Otherwise the ৳-prefixed form ("৳৪৫") or the number after it.
    if (value === null) {
      if (tok.startsWith("৳") && tok.length > 1) {
        const gluedNum = parseNumber(tok.slice(1));
        if (gluedNum !== null) {
          value = gluedNum;
          numIdx = i;
        }
      } else if (i + 1 < tokens.length && !consumed[i + 1]) {
        const after = parseNumber(tokens[i + 1]);
        if (after !== null && !detectUnit(tokens[i + 1])) {
          value = after;
          numIdx = i + 1;
        }
      }
    }

    consumed[i] = true;
    if (value === null) continue;

    prices.push({ value, index: numIdx, tag: hintNear(numIdx - 3, numIdx + 3) });
    if (numIdx !== i) consumed[numIdx] = true;
  }

  // ── 3) Name: everything left that is not filler/unit ────────────────────
  const nameTokens: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (consumed[i]) continue;
    const tok = tokens[i];
    if (FILLER_WORDS.has(tok) || PRICE_MARKERS.has(tok)) continue;
    if (PURCHASE_HINTS.has(tok) || SALE_HINTS.has(tok)) continue;
    // A leftover unit token can never be part of a product name.
    if (detectUnit(tok)) continue;
    // A stray leading number with no companion is not a name either.
    if (parseNumber(tok) !== null && nameTokens.length === 0) continue;
    nameTokens.push(tok);
  }
  const name = cleanName(nameTokens);

  // ── 4) Map prices onto cost / sale ──────────────────────────────────────
  let unit_price: number | null = null;
  let purchase_price: number | null = null;
  let sale_price: number | null = null;
  let pricingAmbiguous = false;

  if (prices.length === 1) {
    unit_price = prices[0].value;
  } else if (prices.length >= 2) {
    const cost = prices.find((p) => p.tag === "purchase");
    const sell = prices.find((p) => p.tag === "sale");
    if (cost && sell) {
      purchase_price = cost.value;
      sale_price = sell.value;
    } else if (cost) {
      purchase_price = cost.value;
      sale_price = prices.find((p) => p !== cost)!.value;
    } else if (sell) {
      sale_price = sell.value;
      purchase_price = prices.find((p) => p !== sell)!.value;
    } else {
      // Convention: first price spoken is the cost, second the selling price.
      purchase_price = prices[0].value;
      sale_price = prices[1].value;
      pricingAmbiguous = true;
    }
  }

  const hasName = name.length > 0;
  const confidence: ParsedItem["confidence"] =
    hasName && quantity !== null && (unit_price !== null || sale_price !== null)
      ? "high"
      : hasName && (quantity !== null || unit_price !== null)
        ? "medium"
        : "low";

  return {
    raw,
    name,
    quantity,
    unit,
    unit_price,
    purchase_price,
    sale_price,
    pricingAmbiguous,
    confidence,
  };
}

/** Words that separate two items in one breath. */
const ITEM_SEPARATORS = new Set(["আর", "ও", "এবং", "and", "তারপর", "with"]);

// ── Matching against the existing catalog ───────────────────────────────────

/**
 * Normalize for comparison: unify digits, drop punctuation, collapse spaces.
 * Bangla text is preserved as-is (no transliteration), so "চাল" matches "চাল".
 *
 * Uses an explicit character class rather than `\p{L}` unicode property
 * escapes: Hermes support for those is inconsistent across versions and a
 * throw here would take down the screen (this runs during render).
 */
export function normalizeForMatch(input: string): string {
  return normalizeDigits(String(input ?? ""))
    .toLowerCase()
    // Keep Bangla (\u0980-\u09FF), Latin letters, digits and whitespace.
    .replace(/[^\u0980-\u09FFa-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Score how well `candidate` (a catalog product name) matches `query`
 * (what was spoken/typed). 0 = no match, 100 = exact.
 *
 * Deliberately simple and predictable so the shopkeeper can trust the
 * suggestions: exact > prefix > word-prefix > substring > token overlap.
 */
export function scoreNameMatch(query: string, candidate: string): number {
  const q = normalizeForMatch(query);
  const c = normalizeForMatch(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.startsWith(q)) return 90;
  if (c.includes(q)) return 75;

  const qTokens = q.split(" ");
  const cTokens = c.split(" ");
  // Every spoken token appears as a word-prefix in the candidate.
  const allPrefix = qTokens.every((qt) =>
    cTokens.some((ct) => ct.startsWith(qt)),
  );
  if (allPrefix) return 70;

  // Partial token overlap (e.g. "সাবান" vs "Lux সাবান").
  const matched = qTokens.filter((qt) =>
    cTokens.some((ct) => ct.includes(qt) || qt.includes(ct)),
  ).length;
  if (matched > 0) return Math.round((matched / qTokens.length) * 60);

  return 0;
}

/** Sort catalog candidates by match score, dropping weak matches. */
export function rankByName<T extends { name: string }>(
  query: string,
  candidates: T[],
  minScore = 30,
): T[] {
  return candidates
    .map((c) => ({ c, score: scoreNameMatch(query, c.name) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}

/**
 * Parse a phrase that may contain several items:
 *   "২টা সাবান ৪৫ করে আর ১ কেজি চাল ৮০ টাকা"
 * Splits on commas/semicolons and the separator words above.
 */
export function parseBanglaItems(input: string): ParsedItem[] {
  const raw = String(input ?? "").trim();
  if (!raw) return [];

  const segments: string[] = [];
  for (const chunk of raw.split(/[,;।\n]+/)) {
    const words = chunk.trim().split(/\s+/).filter(Boolean);
    let current: string[] = [];
    for (const w of words) {
      if (ITEM_SEPARATORS.has(w)) {
        if (current.length) segments.push(current.join(" "));
        current = [];
      } else {
        current.push(w);
      }
    }
    if (current.length) segments.push(current.join(" "));
  }

  return segments
    .map((s) => parseBanglaItem(s))
    .filter((p) => p.name.length > 0 || p.quantity !== null);
}
