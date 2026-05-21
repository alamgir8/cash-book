/**
 * Multi-source barcode lookup utility.
 *
 * Priority order (all run in parallel, first hit wins):
 *  1. Open Food Facts      — food products worldwide (largest DB, ~3M products)
 *  2. Open Beauty Facts    — cosmetics & personal care worldwide
 *  3. Open Pet Food Facts  — pet food worldwide
 *  4. Open Products Facts  — general / mixed products
 *  5. UPC Item DB          — electronics, household goods (free trial tier)
 *
 * All Open*Facts APIs are free, require no API key, and cover products from
 * every country (labels in local language + English when available).
 */

export interface BarcodeLookupResult {
  name: string;
  brand?: string;
  quantity?: string;
  source: string;
}

const TIMEOUT_MS = 12000;

function signal() {
  return AbortSignal.timeout(TIMEOUT_MS);
}

/** Normalise a name: trim, collapse whitespace, capitalize first letter */
function clean(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** Pick the best available name from an Open*Facts product object */
function offName(p: Record<string, string>): string | null {
  const candidate =
    p.product_name_en ||
    p.product_name ||
    p.abbreviated_product_name ||
    p.generic_name_en ||
    p.generic_name;
  return candidate ? clean(candidate) : null;
}

// ─── Individual source fetchers ───────────────────────────────────────────────

async function fromOpenFoodFacts(
  barcode: string,
): Promise<BarcodeLookupResult | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}` +
        `?fields=product_name,product_name_en,abbreviated_product_name,generic_name,generic_name_en,brands,quantity`,
      { signal: signal() },
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;
    const p = json.product;
    const name = offName(p);
    if (!name) return null;
    return {
      name,
      brand: p.brands ? clean(p.brands.split(",")[0]) : undefined,
      quantity: p.quantity ? clean(p.quantity) : undefined,
      source: "Open Food Facts",
    };
  } catch {
    return null;
  }
}

async function fromOpenBeautyFacts(
  barcode: string,
): Promise<BarcodeLookupResult | null> {
  try {
    const res = await fetch(
      `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(barcode)}` +
        `?fields=product_name,product_name_en,abbreviated_product_name,brands,quantity`,
      { signal: signal() },
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;
    const p = json.product;
    const name = offName(p);
    if (!name) return null;
    return {
      name,
      brand: p.brands ? clean(p.brands.split(",")[0]) : undefined,
      quantity: p.quantity ? clean(p.quantity) : undefined,
      source: "Open Beauty Facts",
    };
  } catch {
    return null;
  }
}

async function fromOpenPetFoodFacts(
  barcode: string,
): Promise<BarcodeLookupResult | null> {
  try {
    const res = await fetch(
      `https://world.openpetfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}` +
        `?fields=product_name,product_name_en,abbreviated_product_name,brands,quantity`,
      { signal: signal() },
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;
    const p = json.product;
    const name = offName(p);
    if (!name) return null;
    return {
      name,
      brand: p.brands ? clean(p.brands.split(",")[0]) : undefined,
      quantity: p.quantity ? clean(p.quantity) : undefined,
      source: "Open Pet Food Facts",
    };
  } catch {
    return null;
  }
}

async function fromOpenProductsFacts(
  barcode: string,
): Promise<BarcodeLookupResult | null> {
  try {
    const res = await fetch(
      `https://world.openproductsfacts.org/api/v2/product/${encodeURIComponent(barcode)}` +
        `?fields=product_name,product_name_en,abbreviated_product_name,brands,quantity`,
      { signal: signal() },
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;
    const p = json.product;
    const name = offName(p);
    if (!name) return null;
    return {
      name,
      brand: p.brands ? clean(p.brands.split(",")[0]) : undefined,
      quantity: p.quantity ? clean(p.quantity) : undefined,
      source: "Open Products Facts",
    };
  } catch {
    return null;
  }
}

async function fromUpcItemDb(
  barcode: string,
): Promise<BarcodeLookupResult | null> {
  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`,
      { signal: signal() },
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code !== "OK" || !json.items?.length) return null;
    const item = json.items[0];
    const name: string = item.title || item.description;
    if (!name) return null;
    return {
      name: clean(name),
      brand: item.brand ? clean(item.brand) : undefined,
      source: "UPC Item DB",
    };
  } catch {
    return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Look up a barcode across all sources in parallel.
 * Returns the first non-null result, or null if nothing found.
 */
export async function lookupBarcode(
  barcode: string,
): Promise<BarcodeLookupResult | null> {
  const results = await Promise.allSettled([
    fromOpenFoodFacts(barcode),
    fromOpenBeautyFacts(barcode),
    fromOpenPetFoodFacts(barcode),
    fromOpenProductsFacts(barcode),
    fromUpcItemDb(barcode),
  ]);

  for (const r of results) {
    if (r.status === "fulfilled" && r.value !== null) {
      return r.value;
    }
  }
  return null;
}

/** Format a lookup result into a display string for the description field */
export function formatLookupResult(result: BarcodeLookupResult): string {
  let display = result.name;
  if (result.brand) display += ` (${result.brand})`;
  if (result.quantity) display += ` - ${result.quantity}`;
  return display;
}
