import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveLastWriteWins } from "../conflicts.ts";
import {
  MAX_CLOCK_SKEW_MS,
  clampUpdatedAt,
  setClockOffsetMs,
} from "../clock.ts";
import { canonicalize } from "../checksum.ts";
import { createClientRequestId } from "../ids.ts";
import { errorCodeFromUnknown } from "../telemetry.ts";
import { googleIosReversedScheme } from "../google-oauth.ts";
import { computeUseLocalPersonalLedger } from "../ledger-scope-pure.ts";
import { localDayKey } from "../day-key.ts";
import {
  createProductFormSchema,
  createProductEditSchema,
  createAdjustStockSchema,
  createInvoiceSchema,
  createBoundedPaymentSchema,
  createOrganizationFormSchema,
} from "../../validations/shop.ts";
import {
  partyBalanceSumSql,
  partyNetFromTotals,
  partySignedDelta,
} from "../party-balance.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Repo root, for asserting backend files. */

test("LWW prefers newer updated_at", () => {
  const decision = resolveLastWriteWins(
    {
      id: "1",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
      device_id: "a",
    },
    {
      id: "1",
      updated_at: "2026-01-02T00:00:00.000Z",
      deleted_at: null,
      device_id: "b",
    },
  );
  assert.equal(decision.winner, "incoming");
});

test("LWW equal ts uses higher device_id", () => {
  const ts = "2026-01-01T00:00:00.000Z";
  const decision = resolveLastWriteWins(
    { id: "1", updated_at: ts, deleted_at: null, device_id: "dev-a" },
    { id: "1", updated_at: ts, deleted_at: null, device_id: "dev-z" },
  );
  assert.equal(decision.winner, "incoming");
});

test("LWW equal prefers delete", () => {
  const ts = "2026-01-01T00:00:00.000Z";
  const decision = resolveLastWriteWins(
    { id: "1", updated_at: ts, deleted_at: null, device_id: "dev-a" },
    {
      id: "1",
      updated_at: ts,
      deleted_at: ts,
      device_id: "dev-a",
    },
  );
  assert.equal(decision.winner, "incoming");
});

test("migration 001 contains core tables", () => {
  const src = readFileSync(
    join(__dirname, "../../../db/migrations/index.ts"),
    "utf8",
  );
  assert.match(src, /CREATE TABLE IF NOT EXISTS accounts/);
  assert.match(src, /CREATE TABLE IF NOT EXISTS transactions/);
  assert.match(src, /CREATE TABLE IF NOT EXISTS parties/);
  assert.doesNotMatch(src, /CREATE TABLE IF NOT EXISTS schema_version/);
});

test("clampUpdatedAt leaves timestamps within skew alone", () => {
  setClockOffsetMs(0);
  const server = "2026-08-03T12:00:00.000Z";
  const local = "2026-08-03T12:02:00.000Z";
  assert.equal(clampUpdatedAt(local, server), local);
});

test("clampUpdatedAt clamps far-future device clocks", () => {
  setClockOffsetMs(0);
  const server = "2026-08-03T12:00:00.000Z";
  const skewed = new Date(
    Date.parse(server) + MAX_CLOCK_SKEW_MS + 60_000,
  ).toISOString();
  assert.equal(clampUpdatedAt(skewed, server), server);
});

test("canonicalize sorts object keys stably", () => {
  const a = canonicalize({ b: 1, a: { z: 2, y: 3 } });
  const b = canonicalize({ a: { y: 3, z: 2 }, b: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":{"y":3,"z":2},"b":1}');
});

test("createClientRequestId has expected prefix", () => {
  assert.match(createClientRequestId(), /^crid-[a-z0-9]+-[a-z0-9]+$/i);
});

test("errorCodeFromUnknown maps common failures", () => {
  assert.equal(
    errorCodeFromUnknown({ response: { status: 404 } }),
    "http_404",
  );
  assert.equal(
    errorCodeFromUnknown(new Error("insufficient authentication scopes")),
    "drive_scope_missing",
  );
  assert.equal(errorCodeFromUnknown(new Error("network down")), "network");
});

test("googleIosReversedScheme derives callback scheme", () => {
  assert.equal(
    googleIosReversedScheme(
      "470488515683-abc.apps.googleusercontent.com",
    ),
    "com.googleusercontent.apps.470488515683-abc",
  );
  assert.equal(googleIosReversedScheme("bad"), null);
});

test("computeUseLocalPersonalLedger is offline-first when LF on", () => {
  assert.equal(computeUseLocalPersonalLedger(false, false, null), false);
  assert.equal(computeUseLocalPersonalLedger(true, false, null), true);
  // Org scope still uses SQLite when local-first is on (not Mongo).
  assert.equal(computeUseLocalPersonalLedger(true, false, "org1"), true);
  assert.equal(computeUseLocalPersonalLedger(true, true, "org1"), true);
  assert.equal(computeUseLocalPersonalLedger(true, true, null), true);
});

test("local-first defaults are on-device + cloud sync", () => {
  const src = readFileSync(
    join(__dirname, "../flags.ts"),
    "utf8",
  );
  assert.match(src, /localFirstEnabled:\s*true/);
  assert.match(src, /cloudSyncEnabled:\s*true/);
});

test("login mode defaults to single", () => {
  const src = readFileSync(
    join(__dirname, "../../auth/login-mode.ts"),
    "utf8",
  );
  assert.match(src, /DEFAULT_MODE:\s*LoginMode\s*=\s*"single"/);
  assert.match(src, /every_time/);
});

test("localDayKey formats YYYY-MM-DD", () => {
  assert.equal(localDayKey(new Date(2026, 7, 3, 23, 30, 0)), "2026-08-03");
});

test("migration 002 adds sync_status columns", () => {
  const src = readFileSync(
    join(__dirname, "../../../db/migrations/index.ts"),
    "utf8",
  );
  assert.match(src, /name: "002_sync_status"/);
  assert.match(src, /ALTER TABLE accounts ADD COLUMN sync_status/);
  assert.match(src, /ALTER TABLE transactions ADD COLUMN retry_count/);
  assert.match(src, /idx_parties_updated/);
});

test("syncStatusForMutation maps create/update/delete", async () => {
  const { syncStatusForMutation } = await import(
    "../../../db/sync-status.ts"
  );
  assert.equal(syncStatusForMutation({ isCreate: true }), "pending_create");
  assert.equal(syncStatusForMutation({}), "pending_update");
  assert.equal(syncStatusForMutation({ deleted: true }), "pending_delete");
});

test("owner helper exports isolation API", () => {
  const src = readFileSync(
    join(__dirname, "../owner.ts"),
    "utf8",
  );
  assert.match(src, /export async function ensureLocalLedgerOwner/);
  assert.match(src, /export async function resetLocalLedgerForUserChange/);
  assert.match(src, /export async function clearLocalAttachmentFiles/);
  assert.match(src, /META_KEYS\.OWNER_ADMIN_ID/);
});

test("levelFromRatio uses configurable thresholds", async () => {
  const { levelFromRatio, DEFAULT_STORAGE_THRESHOLDS } = await import(
    "../storage-monitor.ts"
  );
  assert.equal(levelFromRatio(0.5, DEFAULT_STORAGE_THRESHOLDS), "ok");
  assert.equal(levelFromRatio(0.8, DEFAULT_STORAGE_THRESHOLDS), "warning");
  assert.equal(levelFromRatio(0.9, DEFAULT_STORAGE_THRESHOLDS), "strong");
  assert.equal(levelFromRatio(0.95, DEFAULT_STORAGE_THRESHOLDS), "critical");
});

test("scheduler exports mutation + backoff sync entry points", () => {
  const src = readFileSync(
    join(__dirname, "../../../sync/scheduler.ts"),
    "utf8",
  );
  assert.match(src, /export function requestSyncSoon/);
  assert.match(src, /export function requestSyncNow/);
  assert.match(src, /BACKOFF_STEPS_MS/);
  assert.match(src, /probeBackendAvailable/);
  assert.match(src, /reconnect/);
});

test("backend sync applies account \$inc on transaction push", () => {
  const src = readFileSync(
    join(
      __dirname,
      "../../../../backend/controllers/sync.controller.js",
    ),
    "utf8",
  );
  assert.match(src, /accountCashDelta/);
  assert.match(src, /applyAccountInc/);
  assert.match(src, /Do NOT trust client current_balance/);
});

test("ledger screens prefer DAL over raw partiesApi/fetchAccounts", () => {
  const invoice = readFileSync(
    join(__dirname, "../../../app/(app)/invoices/create.tsx"),
    "utf8",
  );
  assert.match(invoice, /dalFetchAccounts/);
  assert.match(invoice, /dalFetchParties/);
  assert.match(invoice, /dalCreateParty/);
  assert.doesNotMatch(invoice, /from "@\/services\/parties"/);
  assert.doesNotMatch(invoice, /from "@\/services\/accounts"/);

  const scheme = readFileSync(
    join(__dirname, "../../../app/(app)/schemes/[schemeId]/index.tsx"),
    "utf8",
  );
  assert.match(scheme, /dalFetchAccounts/);
  assert.match(scheme, /dalCreateParty/);
  assert.doesNotMatch(scheme, /from "@\/services\/parties"/);

  const reports = readFileSync(
    join(__dirname, "../../../services/reports.ts"),
    "utf8",
  );
  assert.match(reports, /dalFetchAccountDetail/);
  assert.match(reports, /dalFetchPartyLedger/);
  assert.doesNotMatch(reports, /partiesApi\.getLedger/);
});

test("party balance follows backend sign convention (Phase 7)", () => {
  // Customers are credit-positive (receivable).
  assert.equal(partySignedDelta("customer", "credit", 100), 100);
  assert.equal(partySignedDelta("customer", "debit", 100), -100);
  // Suppliers are debit-positive (payable).
  assert.equal(partySignedDelta("supplier", "debit", 100), 100);
  assert.equal(partySignedDelta("supplier", "credit", 100), -100);
  // "both" follows the supplier branch, matching the backend.
  assert.equal(partySignedDelta("both", "debit", 100), 100);
  // Dues never move a balance.
  assert.equal(partySignedDelta("customer", "credit", 100, "due"), 0);
  assert.equal(partySignedDelta("supplier", "debit", 100, "due"), 0);
});

test("party net totals invert for suppliers", () => {
  assert.equal(partyNetFromTotals("customer", 300, 100), 200);
  assert.equal(partyNetFromTotals("supplier", 300, 100), -200);
  assert.equal(partyNetFromTotals(null, 300, 100), 200);
});

test("partyBalanceSumSql uses the party convention", () => {
  assert.match(partyBalanceSumSql("customer"), /type = 'credit'/);
  assert.match(partyBalanceSumSql("supplier"), /type = 'debit'/);
  assert.match(partyBalanceSumSql("both"), /type = 'debit'/);
});

test("local repair re-runs party convention fix on existing devices", () => {
  const src = readFileSync(join(__dirname, "../repair-ledger.ts"), "utf8");
  assert.match(src, /LEDGER_REPAIR_VERSION = "9"/);
});

// ── Shop form validation (Phase 5 follow-up) ────────────────────────────────

/**
 * Schema factories take a translator so validation messages follow the locale.
 * Tests use the real English dictionary, so assertions below stay stable.
 */
let enTranslator: Promise<(key: string, vars?: Record<string, string>) => string> | null =
  null;
function getEnT() {
  if (!enTranslator) {
    enTranslator = import("../../i18n/translations.ts").then(
      ({ translations }) =>
        (key: string, vars?: Record<string, string>) => {
          let text: string = (translations.en as any)[key] ?? key;
          if (vars) {
            for (const [k, v] of Object.entries(vars)) {
              text = text.replaceAll(`{${k}}`, v);
            }
          }
          return text;
        },
    );
  }
  return enTranslator;
}

/** Translator for an arbitrary locale — used to prove messages localize. */
function getT(locale: "en" | "bn") {
  return import("../../i18n/translations.ts").then(
    ({ translations }) =>
      (key: string, vars?: Record<string, string>) => {
        let text: string = (translations as any)[locale]?.[key] ?? key;
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, v);
          }
        }
        return text;
      },
  );
}


const productInput = {
  name: "Rice",
  unit: "pcs",
  purchase_price: "100",
  additional_cost: "20",
  sale_price: "150",
  tax_rate: "5",
  opening_stock: "10",
  low_stock_threshold: "2",
  track_inventory: true,
};

function messages(result: { success: boolean; error?: any }): string[] {
  return result.success
    ? []
    : result.error.issues.map((i: any) => i.message as string);
}

test("product schema accepts a valid product and rejects bad numbers", async () => {
  const t = await getEnT();
  const productFormSchema = createProductFormSchema(t as any);

  assert.equal(productFormSchema.safeParse(productInput).success, true);

  assert.ok(
    messages(productFormSchema.safeParse({ ...productInput, name: "  " })).some(
      (m) => /name is required/i.test(m),
    ),
  );
  assert.ok(
    messages(
      productFormSchema.safeParse({ ...productInput, purchase_price: "-5" }),
    ).some((m) => /cannot be negative/i.test(m)),
  );
  assert.ok(
    messages(
      productFormSchema.safeParse({ ...productInput, sale_price: "abc" }),
    ).some((m) => /valid number/i.test(m)),
  );
  assert.ok(
    messages(
      productFormSchema.safeParse({ ...productInput, tax_rate: "150" }),
    ).some((m) => /at most 100/i.test(m)),
  );
  assert.ok(
    messages(
      productFormSchema.safeParse({ ...productInput, barcode: "12 34" }),
    ).some((m) => /spaces/i.test(m)),
  );
  // Barcode is optional, and a free-form QR payload is allowed.
  assert.equal(
    productFormSchema.safeParse({ ...productInput, barcode: "" }).success,
    true,
  );
  assert.equal(
    productFormSchema.safeParse({ ...productInput, barcode: "QR-XYZ_9" })
      .success,
    true,
  );
  // Unknown units are rejected rather than silently stored.
  assert.equal(
    productFormSchema.safeParse({ ...productInput, unit: "furlong" }).success,
    false,
  );
});

test("edit schema drops opening_stock and requires is_active", async () => {
  const t = await getEnT();
  const productEditSchema = createProductEditSchema(t as any);
  const productFormSchema = createProductFormSchema(t as any);
  assert.equal(
    productEditSchema.safeParse({ ...productInput, is_active: true }).success,
    true,
  );
  // opening_stock is not editable after create.
  assert.equal(
    "opening_stock" in productEditSchema.shape,
    false,
  );
  assert.equal("opening_stock" in productFormSchema.shape, true);
});

test("adjust stock requires a positive quantity", async () => {
  const t = await getEnT();
  const adjustStockSchema = createAdjustStockSchema(t as any);
  assert.equal(
    adjustStockSchema.safeParse({ type: "adjustment_in", quantity: "5" })
      .success,
    true,
  );
  for (const qty of ["", "0", "-3"]) {
    const result = adjustStockSchema.safeParse({
      type: "adjustment_out",
      quantity: qty,
    });
    assert.equal(result.success, false, `quantity "${qty}" should be invalid`);
  }
});

test("invoice schema validates line items, dates and payments", async () => {
  const t = await getEnT();
  const invoiceSchema = createInvoiceSchema(t as any);

  const base = {
    party_id: "p1",
    date: "2026-09-12",
    discount_type: "percentage" as const,
    items: [{ description: "Rice", quantity: "2", unit_price: "50" }],
    payment_mode: "due" as const,
  };
  assert.equal(invoiceSchema.safeParse(base).success, true);

  assert.equal(
    messages(
      invoiceSchema.safeParse({
        ...base,
        items: [{ description: "x", quantity: "0", unit_price: "5" }],
      }),
    ).some((m) => /greater than 0/i.test(m)),
    true,
  );
  assert.equal(
    messages(
      invoiceSchema.safeParse({
        ...base,
        items: [{ description: "x", quantity: "1", unit_price: "0" }],
      }),
    ).some((m) => /greater than 0/i.test(m)),
    true,
  );
  assert.equal(
    messages(invoiceSchema.safeParse({ ...base, date: "nope" })).some((m) =>
      /valid date/i.test(m),
    ),
    true,
  );
  assert.equal(
    messages(
      invoiceSchema.safeParse({ ...base, due_date: "2026-09-01" }),
    ).some((m) => /before the invoice date/i.test(m)),
    true,
  );
  assert.equal(
    messages(
      invoiceSchema.safeParse({ ...base, discount_value: "150" }),
    ).some((m) => /exceed 100/i.test(m)),
    true,
  );
  // A negative adjustment is legitimate (discounts/rounding).
  assert.equal(
    invoiceSchema.safeParse({ ...base, adjustment: "-50" }).success,
    true,
  );
  // Recording money needs an amount AND a destination account.
  assert.equal(
    messages(invoiceSchema.safeParse({ ...base, payment_mode: "partial" }))
      .length > 0,
    true,
  );
  assert.equal(
    invoiceSchema.safeParse({
      ...base,
      payment_mode: "partial",
      initial_payment_amount: "100",
      initial_payment_account: "a1",
    }).success,
    true,
  );
  assert.equal(
    messages(invoiceSchema.safeParse({ ...base, payment_mode: "cash" })).some(
      (m) => /account/i.test(m),
    ),
    true,
  );
});

test("payment schema is bounded by the outstanding balance", async () => {
  const t = await getEnT();
  const createPaymentSchema = (max: number) =>
    createBoundedPaymentSchema(t as any, max);
  assert.equal(
    createPaymentSchema(500).safeParse({ amount: "400", method: "cash" })
      .success,
    true,
  );
  assert.equal(
    createPaymentSchema(500).safeParse({ amount: "600", method: "cash" })
      .success,
    false,
  );
  assert.equal(
    createPaymentSchema(500).safeParse({ amount: "0", method: "cash" }).success,
    false,
  );
});

test("organization schema restricts currency and business type", async () => {
  const t = await getEnT();
  const organizationFormSchema = createOrganizationFormSchema(t as any);
  assert.equal(
    organizationFormSchema.safeParse({
      name: "My Shop",
      business_type: "retail_shop",
      currency: "BDT",
      status: "active",
      email: "a@b.com",
      phone: "+880 1712-345678",
    }).success,
    true,
  );
  assert.equal(
    organizationFormSchema.safeParse({
      name: "My Shop",
      business_type: "retail_shop",
      currency: "XYZ",
      status: "active",
    }).success,
    false,
  );
  assert.equal(
    messages(
      organizationFormSchema.safeParse({
        name: "My Shop",
        business_type: "retail_shop",
        currency: "BDT",
        status: "active",
        phone: "abc",
      }),
    ).some((m) => /valid phone/i.test(m)),
    true,
  );
});

test("findFirstErrorMessage walks nested RHF-style errors", async () => {
  const { findFirstErrorMessage } = await import("../../invoice-utils.ts");
  assert.equal(findFirstErrorMessage({}), null);
  assert.equal(findFirstErrorMessage(null), null);
  assert.equal(
    findFirstErrorMessage({ name: { message: "Required" } }),
    "Required",
  );
  assert.equal(
    findFirstErrorMessage({
      items: { 0: { quantity: { message: "Quantity must be greater than 0" } } },
    }),
    "Quantity must be greater than 0",
  );
});

test("transform maps invoice discount onto a negative adjustment", async () => {
  const { transformInvoiceFormData } = await import("../../invoice-utils.ts");

  // Percentage discount: 10% of (2 x 100) = 20, applied negatively so the
  // saved total matches what the form showed.
  const pct = transformInvoiceFormData({
    party_id: "p1",
    date: "2026-09-12",
    discount_type: "percentage",
    discount_value: "10",
    items: [
      {
        description: "Rice",
        quantity: "2",
        unit_price: "100",
        local_product_id: "local-1",
        product: "not-an-object-id",
      },
    ],
  });
  assert.equal(pct.adjustment, -20);
  assert.equal(pct.shipping_charge, undefined);
  // Local product hint survives; a non-ObjectId is never sent as `product`.
  assert.equal(pct.items[0].local_product_id, "local-1");
  assert.equal(pct.items[0].product, undefined);

  const fixed = transformInvoiceFormData({
    party_id: "p1",
    discount_type: "fixed",
    discount_value: "15",
    items: [{ description: "x", quantity: "1", unit_price: "100" }],
  });
  assert.equal(fixed.adjustment, -15);

  // No discount and no shipping → nothing to adjust.
  const none = transformInvoiceFormData({
    party_id: "p1",
    items: [{ description: "x", quantity: "1", unit_price: "10" }],
  });
  assert.equal(none.adjustment, undefined);
  assert.equal(none.shipping_charge, undefined);

  const shipped = transformInvoiceFormData({
    party_id: "p1",
    shipping_charge: "30",
    items: [{ description: "x", quantity: "1", unit_price: "10" }],
  });
  assert.equal(shipped.shipping_charge, 30);
});

test("invoice schema ignores blank placeholder rows but validates filled ones", async () => {
  const t = await getEnT();
  const invoiceSchema = createInvoiceSchema(t as any);
  const base = {
    party_id: "p1",
    date: "2026-09-12",
    discount_type: "percentage" as const,
    payment_mode: "due" as const,
  };
  const blank = { description: "", quantity: "1", unit_price: "", tax_rate: "0" };

  // A row the user never touched must not block submission.
  assert.equal(
    invoiceSchema.safeParse({
      ...base,
      items: [
        { description: "Rice", quantity: "1", unit_price: "50", tax_rate: "0" },
        blank,
      ],
    }).success,
    true,
  );
  // ...but a form with only blank rows has nothing to invoice.
  assert.equal(
    messages(invoiceSchema.safeParse({ ...base, items: [blank] })).some((m) =>
      /at least one item/i.test(m),
    ),
    true,
  );
  // A started row without a price reports against that exact field path.
  const missingPrice = invoiceSchema.safeParse({
    ...base,
    items: [{ description: "Rice", quantity: "1", unit_price: "", tax_rate: "0" }],
  });
  assert.equal(missingPrice.success, false);
  assert.equal(
    (missingPrice as any).error.issues[0].path.join("."),
    "items.0.unit_price",
  );
});

test("invoice schema rejects a fixed discount above the subtotal", async () => {
  const t = await getEnT();
  const invoiceSchema = createInvoiceSchema(t as any);
  const base = {
    party_id: "p1",
    date: "2026-09-12",
    discount_type: "fixed" as const,
    payment_mode: "due" as const,
    items: [{ description: "x", quantity: "2", unit_price: "50" }],
  };
  // 100 subtotal: a 100 fixed discount is allowed, 120 is not (would go negative).
  assert.equal(
    invoiceSchema.safeParse({ ...base, discount_value: "100" }).success,
    true,
  );
  assert.equal(
    invoiceSchema.safeParse({ ...base, discount_value: "120" }).success,
    false,
  );
});

// ── Localized validation messages ──────────────────────────────────────────

test("validation messages follow the translator locale (en vs bn)", async () => {
  const [enT, bnT] = await Promise.all([getT("en"), getT("bn")]);

  const invalid = { ...productInput, name: "  " };

  const enResult = createProductFormSchema(enT as any).safeParse(invalid);
  assert.equal(enResult.success, false);
  assert.ok(
    messages(enResult).some((m) => /is required/i.test(m)),
    `expected an English message, got ${JSON.stringify(messages(enResult))}`,
  );

  const bnResult = createProductFormSchema(bnT as any).safeParse(invalid);
  assert.equal(bnResult.success, false);
  // "আবশ্যক" = "is required"; the label is localized too, not just the suffix.
  assert.ok(
    messages(bnResult).some((m) => /আবশ্যক/.test(m)),
    `expected a Bangla message, got ${JSON.stringify(messages(bnResult))}`,
  );
  assert.ok(messages(bnResult).some((m) => /পণ্যের নাম/.test(m)));

  // Parameterised messages interpolate in both locales.
  const bnNumber = createProductFormSchema(bnT as any).safeParse({
    ...productInput,
    tax_rate: "150",
  });
  assert.ok(
    messages(bnNumber).some((m) => m.includes("১০০") || m.includes("100")),
    `expected the max value to appear, got ${JSON.stringify(messages(bnNumber))}`,
  );
});

test("every validation message key resolves in both locales", async () => {
  const { translations } = await import("../../i18n/translations.ts");
  const vKeys = Object.keys(translations.en).filter((k) => /^v[A-Z]/.test(k));
  assert.ok(vKeys.length >= 20, `expected the v* key set, found ${vKeys.length}`);
  for (const key of vKeys) {
    const en: string = (translations.en as any)[key];
    const bn: string = (translations.bn as any)[key];
    assert.ok(en?.trim(), `${key} missing English`);
    assert.ok(bn?.trim(), `${key} missing Bangla`);
    // Both locales must expose the same placeholders, or interpolation breaks.
    const placeholders = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort();
    assert.deepEqual(
      placeholders(bn),
      placeholders(en),
      `${key} placeholder mismatch`,
    );
  }
});

// ── Bangla natural-language items ──────────────────────────────────────────

test("parses the user's spoken product phrase", async () => {
  const { parseBanglaItem } = await import("../../voice/bangla-nlp.ts");
  const p = parseBanglaItem("Lux সাবান/সাবান ২টা ৪৫টাকা করে");
  assert.equal(p.name, "Lux সাবান/সাবান");
  assert.equal(p.quantity, 2);
  assert.equal(p.unit, "pcs");
  assert.equal(p.unit_price, 45);
  assert.equal(p.confidence, "high");
});

test("parses quantities, units and per-unit prices", async () => {
  const { parseBanglaItem } = await import("../../voice/bangla-nlp.ts");

  const cases: Array<[string, string, number, string, number]> = [
    ["২ কেজি চাল ৮০ টাকা", "চাল", 2, "kg", 80],
    ["চাল ২ কেজি ৮০ টাকা", "চাল", 2, "kg", 80],
    ["৩ লিটার তেল ১৬০ টাকা", "তেল", 3, "liter", 160],
    ["৫০০ গ্রাম চিনি ৬০ টাকা", "চিনি", 500, "g", 60],
    ["এক ডজন ডিম ১২০ টাকা", "ডিম", 1, "dozen", 120],
    ["১ বোতল পানি ২০ টাকা", "পানি", 1, "bottle", 20],
    // spoken number + glued unit, and সরাই/glued forms
    ["দুইটা কলম ১০ টাকা করে", "কলম", 2, "pcs", 10],
    ["তিনটা সাবান ১২ টাকা", "সাবান", 3, "pcs", 12],
    // "সাড়ে" = half over
    ["সাড়ে তিন কেজি চাল ৮০ টাকা", "চাল", 3.5, "kg", 80],
    // decimal quantity and a trailing unit echo
    ["২.৫ কেজি আলু ৩০ টাকা কেজি", "আলু", 2.5, "kg", 30],
    // Latin units / English-ish phrasing
    ["Lux 2kg 45 taka", "Lux", 2, "kg", 45],
    // multi-word brand name must survive
    [
      "মিল্ক ভিটা গুঁড়া দুধ ৫০০ গ্রাম ৭৮০ টাকা",
      "মিল্ক ভিটা গুঁড়া দুধ",
      500,
      "g",
      780,
    ],
  ];

  for (const [input, name, qty, unit, price] of cases) {
    const p = parseBanglaItem(input);
    assert.equal(p.name, name, `name for "${input}"`);
    assert.equal(p.quantity, qty, `quantity for "${input}"`);
    assert.equal(p.unit, unit, `unit for "${input}"`);
    assert.equal(p.unit_price, price, `price for "${input}"`);
  }
});

test("separates cost from selling price using keywords", async () => {
  const { parseBanglaItem } = await import("../../voice/bangla-nlp.ts");

  // A hint word attaches to the price nearest it, regardless of order.
  const a = parseBanglaItem("সাবান ২টা ৩৫ টাকা করে ৪৫ টাকা বিক্রয়");
  assert.equal(a.purchase_price, 35);
  assert.equal(a.sale_price, 45);
  assert.equal(a.pricingAmbiguous, false);

  const b = parseBanglaItem("চাল ক্রয় ৮০ টাকা বিক্রয় ৯৫ টাকা ২ কেজি");
  assert.equal(b.purchase_price, 80);
  assert.equal(b.sale_price, 95);
  assert.equal(b.quantity, 2);
  assert.equal(b.unit, "kg");
});

test("two unspecified prices default to cost then sale, and flag ambiguity", async () => {
  const { parseBanglaItem } = await import("../../voice/bangla-nlp.ts");

  // Two marked prices, no hint words → cost first, sale second, flagged.
  const marked = parseBanglaItem("চাল ৮০ টাকা ৯৫ টাকা");
  assert.equal(marked.name, "চাল");
  assert.equal(marked.purchase_price, 80);
  assert.equal(marked.sale_price, 95);
  assert.equal(marked.pricingAmbiguous, true);

  // Speech often drops the second টাকা: "চাল ৮০ ৯৫ টাকা".
  const dropped = parseBanglaItem("চাল ৮০ ৯৫ টাকা");
  assert.equal(dropped.name, "চাল");
  assert.equal(dropped.purchase_price, 80);
  assert.equal(dropped.sale_price, 95);
  assert.equal(dropped.pricingAmbiguous, true);

  // A quantity must NOT be mistaken for a second price.
  const qty = parseBanglaItem("২টা সাবান ৪৫ টাকা");
  assert.equal(qty.quantity, 2);
  assert.equal(qty.unit_price, 45);
  assert.equal(qty.purchase_price, null);
  assert.equal(qty.sale_price, null);
});

test("splits several items from one phrase", async () => {
  const { parseBanglaItems } = await import("../../voice/bangla-nlp.ts");
  const items = parseBanglaItems(
    "২টা সাবান ৪৫ করে আর ১ কেজি চাল ৮০ টাকা, ৩ লিটার তেল ১৬০ টাকা",
  );
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((i) => [i.name, i.quantity, i.unit, i.unit_price]),
    [
      ["সাবান", 2, "pcs", 45],
      ["চাল", 1, "kg", 80],
      ["তেল", 3, "liter", 160],
    ],
  );
});

test("normalizes Bangla digits and never invents a name", async () => {
  const { normalizeDigits, detectUnit, parseBanglaItem } = await import(
    "../../voice/bangla-nlp.ts"
  );
  assert.equal(normalizeDigits("০১২৩৪৫৬৭৮৯"), "0123456789");
  assert.equal(normalizeDigits("৪৫ টাকা"), "45 টাকা");

  // Unit aliases resolve to canonical units used by the product schema.
  assert.equal(detectUnit("কেজি"), "kg");
  assert.equal(detectUnit("গ্রাম"), "g");
  assert.equal(detectUnit("লিটার"), "liter");
  assert.equal(detectUnit("পিস"), "pcs");
  assert.equal(detectUnit("ডজন"), "dozen");
  assert.equal(detectUnit("চাল"), null);

  // Only numbers, no name → low confidence, empty name (caller must ask).
  const p = parseBanglaItem("২টা ৪৫ টাকা");
  assert.equal(p.name, "");
  assert.equal(p.quantity, 2);
  assert.equal(p.confidence, "low");
});

// ── Offline settings (settings-sync) ───────────────────────────────────────

test("mergeSettings deep-merges objects but replaces scalars/arrays", async () => {
  const { mergeSettings } = await import("../settings-pure.ts");

  const base = {
    name: "Shop",
    settings: { currency_code: "USD", invoice_prefix: "INV" },
    tags: ["a"],
  };
  const merged = mergeSettings(base, {
    settings: { currency_code: "BDT" },
    tags: ["b"],
  });

  // Untouched nested keys survive.
  assert.equal(merged.settings.invoice_prefix, "INV");
  assert.equal(merged.settings.currency_code, "BDT");
  assert.equal(merged.name, "Shop");
  // Arrays replace rather than merge.
  assert.deepEqual(merged.tags, ["b"]);
  // undefined patches never clobber a value.
  assert.equal(
    mergeSettings(base, { name: undefined }).name,
    "Shop",
  );
});

test("toServerProfilePayload normalizes currency and never sends login_pin", async () => {
  const { toServerProfilePayload } = await import("../settings-pure.ts");

  const fromSettings = toServerProfilePayload({
    name: "Alamgir",
    settings: { currency: "BDT", language: "bn" },
  });
  assert.deepEqual(fromSettings.profile_settings, {
    currency_code: "BDT",
    language: "bn",
  });
  assert.equal(fromSettings.name, "Alamgir");

  // profile_settings wins and `currency` is dropped in favour of currency_code.
  const fromProfileSettings = toServerProfilePayload({
    profile_settings: { currency: "INR", currency_symbol: "₹" },
  });
  assert.deepEqual(fromProfileSettings.profile_settings, {
    currency_code: "INR",
    currency_symbol: "₹",
  });

  // A PIN smuggled into the patch must not survive into a merged payload.
  const withPin = toServerProfilePayload({
    name: "X",
    login_pin: "12345",
  });
  assert.equal("login_pin" in withPin, false);
});

test("isValidQueuedPin only accepts empty or 5 digits", async () => {
  const { isValidQueuedPin } = await import("../settings-pure.ts");
  assert.equal(isValidQueuedPin(""), true);
  assert.equal(isValidQueuedPin("12345"), true);
  for (const bad of ["1234", "123456", "abcde", "12a45", null, undefined, 12345]) {
    assert.equal(isValidQueuedPin(bad), false, `${String(bad)} should be invalid`);
  }
});

test("isPermanentOpFailure only drops 4xx client errors", async () => {
  const { isPermanentOpFailure } = await import("../settings-pure.ts");
  for (const s of [400, 403, 404, 422]) {
    assert.equal(isPermanentOpFailure(s), true, `${s} should be permanent`);
  }
  for (const s of [undefined, 401, 408, 429, 500, 503]) {
    assert.equal(isPermanentOpFailure(s), false, `${s} should retry`);
  }
});

test("applyProfilePatchToUser mirrors currency/language into both shapes", async () => {
  const { applyProfilePatchToUser } = await import("../settings-pure.ts");

  const user = {
    name: "A",
    settings: { currency: "USD", language: "en" },
    profile_settings: { currency_code: "USD" },
    security: { has_login_pin: true },
  };

  const patched = applyProfilePatchToUser(user, {
    name: "B",
    settings: { currency: "BDT", language: "bn" },
  });
  assert.equal(patched.name, "B");
  // Both the legacy `settings` and `profile_settings` shapes stay in sync.
  assert.equal(patched.settings.currency, "BDT");
  assert.equal(patched.settings.language, "bn");
  assert.equal(patched.profile_settings.currency_code, "BDT");
  // Unrelated state is preserved and the original is not mutated.
  assert.equal(patched.security.has_login_pin, true);
  assert.equal(user.name, "A");

  // Enabling a PIN, then removing it.
  assert.equal(
    applyProfilePatchToUser(user, {}, "12345").security.has_login_pin,
    true,
  );
  assert.equal(
    applyProfilePatchToUser(user, {}, "").security.has_login_pin,
    false,
  );
});

test("offline settings migration adds cache + outbox tables", () => {
  // Read as source text: the migration module imports extensionless app paths
  // that Node's type-stripping loader cannot resolve.
  const migrations = readFileSync(
    join(__dirname, "../../../db/migrations/index.ts"),
    "utf8",
  );
  assert.match(
    migrations,
    /CREATE TABLE IF NOT EXISTS settings_cache/,
  );
  assert.match(migrations, /CREATE TABLE IF NOT EXISTS pending_ops/);
  assert.match(migrations, /idx_pending_ops_created/);
  assert.match(migrations, /005_offline_settings/);

  // Schema version must stay in lockstep with the newest migration.
  const types = readFileSync(join(__dirname, "../../../db/types.ts"), "utf8");
  assert.match(types, /LOCAL_SCHEMA_VERSION = 5/);
});

test("settings writes never persist a PIN to SQLite", () => {
  const src = readFileSync(join(__dirname, "../settings-sync.ts"), "utf8");
  // The PIN goes to SecureStore only.
  assert.match(src, /QUEUED_PIN_KEY/);
  assert.match(src, /expo-secure-store/);
  // saveLocalProfile must not forward a PIN into the SQLite/outbox payload.
  const saveFn = src.slice(
    src.indexOf("export async function saveLocalProfile"),
    src.indexOf("export async function saveLocalPreferences"),
  );
  assert.doesNotMatch(saveFn, /login_pin/);
});

// ── Shop sync contract (Phase 13) ──────────────────────────────────────────

const repoRoot = join(__dirname, "../../../..");
const mobileRoot = join(__dirname, "../../..");

test("sync entity enum includes shop entities on both client and server", () => {
  const engine = readFileSync(join(__dirname, "../../../sync/engine.ts"), "utf8");
  for (const entity of ["product", "invoice", "stock_movement"]) {
    assert.match(engine, new RegExp(`"${entity}"`), `engine missing ${entity}`);
  }
  // Marketing the shop tables as syncable means they must be in the dirty map.
  assert.match(engine, /product: "products"/);
  assert.match(engine, /invoice: "invoices"/);
  assert.match(engine, /stock_movement: "inventory_movements"/);

  const routes = readFileSync(
    join(repoRoot, "backend/routes/sync.routes.js"),
    "utf8",
  );
  for (const entity of ["product", "invoice", "stock_movement"]) {
    assert.match(routes, new RegExp(`"${entity}"`), `routes missing ${entity}`);
  }
});

test("shop sync pushes parents before children", () => {
  const engine = readFileSync(join(__dirname, "../../../sync/engine.ts"), "utf8");
  const collect = engine.slice(
    engine.indexOf("async function collectDirtyChanges"),
    engine.indexOf("async function markClean"),
  );
  // Products must be collected before invoices/movements so the server can
  // resolve references within a single batch.
  const productAt = collect.indexOf('entity: "product"');
  const invoiceAt = collect.indexOf('entity: "invoice"');
  const movementAt = collect.indexOf('entity: "stock_movement"');
  assert.ok(productAt > 0 && invoiceAt > 0 && movementAt > 0);
  assert.ok(productAt < invoiceAt, "products must precede invoices");
  assert.ok(productAt < movementAt, "products must precede movements");
});

test("invoice push carries embedded items and payments", () => {
  const engine = readFileSync(join(__dirname, "../../../sync/engine.ts"), "utf8");
  assert.match(engine, /SELECT \* FROM invoice_items WHERE invoice_id/);
  assert.match(engine, /SELECT \* FROM invoice_payments WHERE invoice_id/);
  assert.match(engine, /product_server_id/);
});

test("backend invoice push is side-effect free (no double counting)", () => {
  const controller = readFileSync(
    join(repoRoot, "backend/controllers/sync.controller.js"),
    "utf8",
  );
  const mapper = controller.slice(
    controller.indexOf("const toEmbeddedItems"),
    controller.indexOf("const mapStockMovementPayload"),
  );
  // An invoice push must NOT touch inventory or balances — the client pushes
  // stock movements and ledger transactions separately.
  assert.doesNotMatch(mapper, /applyAccountInc/);
  assert.doesNotMatch(mapper, /applyPartyInc/);
  assert.doesNotMatch(mapper, /StockMovement\.create/);
  assert.doesNotMatch(mapper, /current_stock/);
  // It must still store the captured cost basis.
  assert.match(mapper, /unit_cost_at_sale/);
});

test("stock movement push is idempotent by client_request_id", () => {
  const controller = readFileSync(
    join(repoRoot, "backend/controllers/sync.controller.js"),
    "utf8",
  );
  const mapper = controller.slice(
    controller.indexOf("const mapStockMovementPayload"),
    controller.indexOf("const applyPushChange"),
  );
  assert.match(mapper, /client_request_id: clientRequestId/);
  // Existing movement short-circuits before creating a duplicate.
  assert.match(mapper, /findOne\(\{[\s\S]*client_request_id/);
  assert.match(mapper, /if \(existing\)/);

  const model = readFileSync(
    join(repoRoot, "backend/models/StockMovement.js"),
    "utf8",
  );
  assert.match(model, /client_request_id/);
  assert.match(model, /unique: true/);
});

test("local wipe clears shop data so logout cannot leak it", () => {
  const client = readFileSync(join(__dirname, "../../../db/client.ts"), "utf8");
  const wipeAll = client.slice(
    client.indexOf("export async function wipeAllLedgerData"),
  );
  for (const table of [
    "products",
    "invoices",
    "invoice_items",
    "invoice_payments",
    "inventory_movements",
    "settings_cache",
    "pending_ops",
    "organizations",
  ]) {
    assert.match(
      wipeAll,
      new RegExp(`DELETE FROM ${table}`),
      `wipeAllLedgerData must clear ${table}`,
    );
  }
});

test("sync badge counts shop rows as pending", () => {
  const pending = readFileSync(join(__dirname, "../../../sync/pending.ts"), "utf8");
  for (const table of ["products", "invoices", "inventory_movements"]) {
    assert.match(pending, new RegExp(`"${table}"`));
  }
});

test("shop writes trigger a sync nudge", () => {
  for (const file of ["products.local.ts", "invoices.local.ts"]) {
    const src = readFileSync(join(__dirname, "../../../data", file), "utf8");
    assert.match(src, /requestSyncSoon/, `${file} must nudge sync`);
  }
});

// ── Regression guards for the on-device crash + sync failure ────────────────

/** Strip block + line comments so guards test code, not prose. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/[^\n]*/g, "$1");
}

test("voice modules avoid Metro-hostile dynamic imports and regex", () => {
  for (const file of ["speech.ts", "bangla-nlp.ts"]) {
    const code = codeOnly(
      readFileSync(join(__dirname, "../../voice", file), "utf8"),
    );
    // Metro needs static string literals in import(); a variable specifier
    // fails the route bundle and crashes the screen when the route loads.
    assert.doesNotMatch(
      code,
      /import\(\s*[A-Za-z_$][A-Za-z0-9_$]*\s*\)/,
      `${file} must not use a variable dynamic import`,
    );
    // Hermes support for \p{...} is inconsistent; a throw here runs in render.
    assert.doesNotMatch(code, /\\p\{/, `${file} must not use \\p{...} regex`);
  }
});

test("react-native core is never dynamically imported", () => {
  /**
   * Regression: `await import("react-native")` inside speech.ts went through
   * expo's async-require `importAll`, which enumerates every RN export and hits
   * the lazy getters — including `get__PushNotificationIOS`, which throws
   * "tried to access a native module that doesn't exist" in Expo Go.
   * `Platform` must be a static import.
   */
  const roots = ["app", "components", "lib", "hooks", "data", "db", "sync", "services"];
  const offenders: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (/node_modules|ios|android|\.expo/.test(p)) continue;
        walk(p);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        const code = codeOnly(readFileSync(p, "utf8"));
        if (/import\(\s*["'`]react-native["'`]\s*\)/.test(code)) {
          offenders.push(p.replace(`${mobileRoot}/`, ""));
        }
      }
    }
  };
  for (const root of roots) {
    try {
      walk(join(__dirname, "../../../", root));
    } catch {
      /* root may not exist */
    }
  }
  assert.deepEqual(offenders, [], "static-import react-native instead");
});

// ── Dev API host self-heal ─────────────────────────────────────────────────

test("LAN autofix is opt-in and only then follows Metro's host", async () => {
  const { resolveApiHost } = await import("../api-host.ts");

  const configured = "http://192.168.0.214:5050/api";
  const metroHost = "192.168.0.249:8081";

  // DEFAULT OFF. Metro was observed advertising an address that was not on the
  // machine, so rewriting a configured URL without an explicit opt-in could turn
  // a working URL into a dead one.
  const byDefault = resolveApiHost({ configuredUrl: configured, metroHost, isDev: true });
  assert.equal(byDefault.changed, false);
  assert.equal(byDefault.reason, "disabled");
  assert.equal(byDefault.url, configured);

  // Explicit opt-in → rewrite, preserving port/path/protocol.
  const opted = resolveApiHost({
    configuredUrl: configured,
    metroHost,
    isDev: true,
    autofixEnabled: true,
  });
  assert.equal(opted.changed, true);
  assert.equal(opted.reason, "applied");
  assert.equal(opted.url, "http://192.168.0.249:5050/api");

  // Already correct → untouched even when enabled.
  assert.equal(
    resolveApiHost({
      configuredUrl: "http://192.168.0.249:5050/api",
      metroHost,
      isDev: true,
      autofixEnabled: true,
    }).changed,
    false,
  );
});

test("API host autofix never touches production, public or loopback hosts", async () => {
  const { resolveApiHost } = await import("../api-host.ts");

  // Production builds are never rewritten.
  assert.equal(
    resolveApiHost({
      configuredUrl: "http://192.168.0.214:5050/api",
      metroHost: "192.168.0.249:8081",
      isDev: false,
    }).changed,
    false,
  );

  // Explicit opt-out.
  assert.equal(
    resolveApiHost({
      configuredUrl: "http://192.168.0.214:5050/api",
      metroHost: "192.168.0.249:8081",
      isDev: true,
      autofixEnabled: false,
    }).changed,
    false,
  );

  // A remote (public) API must be respected, even in dev.
  assert.equal(
    resolveApiHost({
      configuredUrl: "https://cash-book-seven.vercel.app/api",
      metroHost: "192.168.0.249:8081",
      isDev: true,
    }).changed,
    false,
  );

  // Loopback is deliberate, not a stale lease.
  assert.equal(
    resolveApiHost({
      configuredUrl: "http://127.0.0.1:5050/api",
      metroHost: "192.168.0.249:8081",
      isDev: true,
    }).changed,
    false,
  );

  // No Metro host available → leave it alone even with opt-in.
  assert.equal(
    resolveApiHost({
      configuredUrl: "http://192.168.0.214:5050/api",
      metroHost: null,
      isDev: true,
      autofixEnabled: true,
    }).changed,
    false,
  );

  // A public API is respected even with opt-in.
  assert.equal(
    resolveApiHost({
      configuredUrl: "https://cash-book-seven.vercel.app/api",
      metroHost: "192.168.0.249:8081",
      isDev: true,
      autofixEnabled: true,
    }).changed,
    false,
  );
});

test("private-LAN detection and the https-on-LAN warning", async () => {
  const { isPrivateLanHost, looksLikeHttpsLanMistake, hostnameOf } =
    await import("../api-host.ts");

  assert.equal(isPrivateLanHost("192.168.1.5"), true);
  assert.equal(isPrivateLanHost("10.0.0.7"), true);
  assert.equal(isPrivateLanHost("172.16.4.9"), true);
  assert.equal(isPrivateLanHost("172.32.4.9"), false);
  assert.equal(isPrivateLanHost("localhost"), false);
  assert.equal(isPrivateLanHost("127.0.0.1"), false);
  assert.equal(isPrivateLanHost("8.8.8.8"), false);

  assert.equal(hostnameOf("192.168.0.249:8081"), "192.168.0.249");
  assert.equal(hostnameOf("http://192.168.0.249:5050/api"), "192.168.0.249");

  // The protocol mistake that produced "Network Error" on the LAN.
  assert.equal(looksLikeHttpsLanMistake("https://192.168.0.249:5050/api"), true);
  assert.equal(looksLikeHttpsLanMistake("http://192.168.0.249:5050/api"), false);
  assert.equal(looksLikeHttpsLanMistake("https://x.vercel.app/api"), false);
});

test("optional native STT package is never referenced until installed", () => {
  // Referencing an uninstalled native module breaks the Metro bundle, which is
  // what crashed the Shop screens. Naming it in a message is fine; importing or
  // requiring it is not.
  const code = codeOnly(
    readFileSync(join(__dirname, "../../voice/speech.ts"), "utf8"),
  );
  assert.doesNotMatch(
    code,
    /(?:import|require)\s*\(\s*["'`]expo-speech-recognition/,
    "must not dynamically import the uninstalled module",
  );
  assert.doesNotMatch(
    code,
    /from\s+["'`]expo-speech-recognition["'`]/,
    "must not statically import the uninstalled module",
  );
  assert.doesNotMatch(
    code,
    /import\s*\{[^}]*\}\s*from\s+["'`]expo-speech-recognition/,
    "must not import named bindings from the uninstalled module",
  );
});

test("invoice pull payload carries created_at (NOT NULL locally)", () => {
  const controller = readFileSync(
    join(repoRoot, "backend/controllers/sync.controller.js"),
    "utf8",
  );
  // Without these the client insert fails with
  // "NOT NULL constraint failed: invoice_items.created_at".
  assert.match(
    controller,
    /created_at: toIso\(doc\.createdAt\) \|\| new Date\(\)\.toISOString\(\),/,
  );
  assert.match(controller, /created_at: toIso\(p\.createdAt\)/);
  assert.match(controller, /product_server_id: it\.product \? String\(it\.product\) : null/);
});

test("invoice upserts default NOT NULL columns instead of throwing", () => {
  const repo = readFileSync(
    join(__dirname, "../../../db/repos/invoices.ts"),
    "utf8",
  );
  const items = repo.slice(
    repo.indexOf("export async function upsertInvoiceItemFromSync"),
    repo.indexOf("export async function upsertInvoicePaymentFromSync"),
  );
  assert.match(items, /created_at: row\.created_at \?\? nowIso\(\)/);
  assert.match(items, /description: row\.description \?\? ""/);

  const payments = repo.slice(
    repo.indexOf("export async function upsertInvoicePaymentFromSync"),
  );
  assert.match(payments, /created_at: row\.created_at \?\? nowIso\(\)/);
});

test("pulled invoice items map the server product id to the local id", () => {
  const engine = readFileSync(join(__dirname, "../../../sync/engine.ts"), "utf8");
  const slice = engine.slice(engine.indexOf("if (change.entity === \"invoice\")"));
  assert.match(slice, /SELECT id FROM products WHERE server_id = \?/);
  assert.match(slice, /product_id: localProductId/);
});

test("offline banner exposes a manual retry action", () => {
  const banner = readFileSync(
    join(__dirname, "../../../components/offline-banner.tsx"),
    "utf8",
  );
  assert.match(banner, /requestSyncNow/);
  assert.match(banner, /probeBackendAvailable/);
  // Offline must be explained, not silently ignored.
  assert.match(banner, /deviceOfflineKeepWorking/);
  assert.match(banner, /backendDownKeepWorking/);
  // The button is hidden while syncing (nothing to retry).
  assert.match(banner, /RETRYABLE/);
});

test("smart add bar is protected by an error boundary with a fallback", () => {
  const bar = readFileSync(
    join(__dirname, "../../../components/shop/smart-add-bar.tsx"),
    "utf8",
  );
  // A convenience feature must never take down the counter screen.
  assert.match(bar, /ErrorBoundary/);
  assert.match(bar, /SmartAddFallback/);
  assert.match(bar, /fallback=\{<SmartAddFallback/);
});



