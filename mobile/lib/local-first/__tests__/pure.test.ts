import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  partyBalanceSumSql,
  partyNetFromTotals,
  partySignedDelta,
} from "../party-balance.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  const { productFormSchema } = await import("../../validations/shop.ts");

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
  const { productEditSchema, productFormSchema } = await import(
    "../../validations/shop.ts"
  );
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
  const { adjustStockSchema } = await import("../../validations/shop.ts");
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
  const { invoiceSchema } = await import("../../validations/shop.ts");

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
  const { createPaymentSchema } = await import("../../validations/shop.ts");
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
  const { organizationFormSchema } = await import("../../validations/shop.ts");
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
  const { invoiceSchema } = await import("../../validations/shop.ts");
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
  const { invoiceSchema } = await import("../../validations/shop.ts");
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


