import { z } from "zod";
import type { AppTranslations } from "../i18n/translations";

/**
 * Shop (local-first) form validation — single source of truth.
 *
 * Localization: every schema is a FACTORY that takes a translator, so validation
 * messages follow the user's language instead of being hardcoded English. The
 * module stays dependency-free (only `zod` plus a type-only import) so the pure
 * test suite can import it through Node's `--experimental-strip-types`.
 *
 * Convention: numeric fields are validated as *text* because that is what
 * `TextInput` produces; callers parse with `parseAmountInput` on submit.
 */

/** Translator shape, matching `useTranslation().t`. */
export type TranslateFn = (
  key: keyof AppTranslations,
  vars?: Record<string, string>,
) => string;

type LabelKey = keyof AppTranslations;

// ── Numeric text helpers ────────────────────────────────────────────────────

function looksNumeric(value: string): boolean {
  const raw = value.trim();
  if (raw === "") return true; // emptiness is handled by min/required rules
  return Number.isFinite(Number(raw));
}

function numericValue(value: string): number {
  const raw = value.trim();
  return raw === "" ? 0 : Number(raw);
}

/**
 * Numeric text. Empty counts as 0 so untouched optional fields pass.
 * `min` defaults to 0, so the value can never be negative.
 */
export function numberText(
  t: TranslateFn,
  labelKey: LabelKey,
  opts?: { min?: number; max?: number; integer?: boolean },
) {
  const label = t(labelKey);
  const min = opts?.min ?? 0;
  let schema = z
    .string()
    .refine(looksNumeric, { message: t("vInvalidNumber", { label }) })
    .refine((v) => !looksNumeric(v) || numericValue(v) >= min, {
      message:
        min === 0
          ? t("vNotNegative", { label })
          : t("vAtLeast", { label, min: String(min) }),
    });

  if (opts?.max !== undefined) {
    const max = opts.max;
    schema = schema.refine((v) => !looksNumeric(v) || numericValue(v) <= max, {
      message: t("vAtMost", { label, max: String(max) }),
    });
  }
  if (opts?.integer) {
    schema = schema.refine(
      (v) => !looksNumeric(v) || Number.isInteger(numericValue(v)),
      { message: t("vWholeNumber", { label }) },
    );
  }
  return schema;
}

/** Numeric text that may legitimately be negative (e.g. invoice adjustment). */
export function signedNumberText(
  t: TranslateFn,
  labelKey: LabelKey,
  opts?: { max?: number },
) {
  const label = t(labelKey);
  let schema = z
    .string()
    .refine(looksNumeric, { message: t("vInvalidNumber", { label }) });
  if (opts?.max !== undefined) {
    const max = opts.max;
    schema = schema.refine((v) => !looksNumeric(v) || numericValue(v) <= max, {
      message: t("vAtMost", { label, max: String(max) }),
    });
  }
  return schema;
}

/** Amount that must be strictly greater than zero (payments, quantities). */
export function positiveNumberText(t: TranslateFn, labelKey: LabelKey) {
  const label = t(labelKey);
  return z
    .string()
    .min(1, t("vRequired", { label }))
    .refine(looksNumeric, { message: t("vInvalidNumber", { label }) })
    .refine((v) => !looksNumeric(v) || numericValue(v) > 0, {
      message: t("vGreaterThanZero", { label }),
    });
}

/**
 * True when the user actually started filling a line. Untouched placeholder
 * rows (default quantity "1", empty description/price) are ignored.
 */
export function isNonEmptyLineItem(item: {
  description?: string;
  quantity?: string;
  unit_price?: string;
  tax_rate?: string;
  discount?: string;
}): boolean {
  const description = (item.description ?? "").trim();
  if (description) return true;
  if (Number(item.unit_price ?? "") > 0) return true;
  if (Number(item.discount ?? "") > 0) return true;
  if (Number(item.tax_rate ?? "") > 0) return true;
  const qty = (item.quantity ?? "").trim();
  if (qty && qty !== "1") return true;
  return false;
}

/**
 * Collect zod issues into a `path → message` map (first message per path wins),
 * so a screen can render errors against the same paths it renders fields for.
 */
export function collectIssueMessages(
  error: z.ZodError,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// ── Products ────────────────────────────────────────────────────────────────

/** Canonical unit list — mirrors `backend/models/Product.js`. */
export const PRODUCT_UNIT_VALUES = [
  "pcs",
  "kg",
  "g",
  "mg",
  "liter",
  "ml",
  "meter",
  "cm",
  "mm",
  "box",
  "pack",
  "dozen",
  "pair",
  "set",
  "bag",
  "roll",
  "sheet",
  "bottle",
  "can",
  "carton",
  "ft",
  "inch",
  "yard",
] as const;

export type ProductUnitValue = (typeof PRODUCT_UNIT_VALUES)[number];

const PRODUCT_UNIT = z.enum(PRODUCT_UNIT_VALUES);

function productNameField(t: TranslateFn) {
  const label = t("productName");
  return z
    .string()
    .trim()
    .min(1, t("vRequired", { label }))
    .max(150, t("vTooLong", { label, max: "150" }));
}

function skuField(t: TranslateFn) {
  const label = t("sku");
  return z
    .string()
    .trim()
    .max(60, t("vTooLong", { label, max: "60" }))
    .optional();
}

// Barcodes are EAN/UPC/QR/custom, so stay permissive: optional, bounded, and
// free of whitespace (a scan never has spaces, manual entry often adds one).
function barcodeField(t: TranslateFn) {
  const label = t("barcode");
  return z
    .string()
    .trim()
    .max(64, t("vTooLong", { label, max: "64" }))
    .refine((v) => !v || !/\s/.test(v), { message: t("vBarcodeNoSpaces") })
    .optional();
}

function descriptionField(t: TranslateFn) {
  const label = t("description");
  return z
    .string()
    .trim()
    .max(1000, t("vTooLong", { label, max: "1000" }))
    .optional();
}

/**
 * Create product. `opening_stock` is collected only on create — later stock
 * changes must go through inventory movements, never a raw edit.
 */
export function createProductFormSchema(t: TranslateFn) {
  return z.object({
    name: productNameField(t),
    sku: skuField(t),
    barcode: barcodeField(t),
    description: descriptionField(t),
    unit: PRODUCT_UNIT,
    purchase_price: numberText(t, "purchasePrice"),
    additional_cost: numberText(t, "additionalCost"),
    sale_price: numberText(t, "salePrice"),
    tax_rate: numberText(t, "taxRate", { max: 100 }),
    opening_stock: numberText(t, "openingStock"),
    low_stock_threshold: numberText(t, "lowStockAlert"),
    track_inventory: z.boolean(),
  });
}

export type ProductFormData = z.infer<
  ReturnType<typeof createProductFormSchema>
>;

/** Edit product — same rules minus opening stock, plus the active flag. */
export function createProductEditSchema(t: TranslateFn) {
  return createProductFormSchema(t)
    .omit({ opening_stock: true })
    .extend({ is_active: z.boolean() });
}

export type ProductEditFormData = z.infer<
  ReturnType<typeof createProductEditSchema>
>;

/** Manual stock adjustment (applied by the single atomic stock writer). */
export function createAdjustStockSchema(t: TranslateFn) {
  return z.object({
    type: z.enum(["adjustment_in", "adjustment_out"]),
    quantity: positiveNumberText(t, "quantity"),
    unit_cost: numberText(t, "unitCostOptional").optional(),
    notes: z
      .string()
      .trim()
      .max(300, t("vTooLong", { label: t("notesOptional"), max: "300" }))
      .optional(),
  });
}

export type AdjustStockFormData = z.infer<
  ReturnType<typeof createAdjustStockSchema>
>;

/**
 * Inline "create product while invoicing" sheet. The barcode comes from the
 * scan (not a field), so it is not validated here.
 */
export function createQuickProductSchema(t: TranslateFn) {
  return z.object({
    name: productNameField(t),
    price: numberText(t, "unitPrice"),
    unit: PRODUCT_UNIT,
  });
}

export type QuickProductFormData = z.infer<
  ReturnType<typeof createQuickProductSchema>
>;

/** Shop product list filters (search is free text — no messages needed). */
export const productFilterSchema = z.object({
  search: z.string().trim().max(100).optional(),
  low_stock: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

// ── Invoices ────────────────────────────────────────────────────────────────

type LineItemLike = {
  description?: string;
  quantity?: string;
  unit_price?: string;
  tax_rate?: string;
  discount?: string;
};

/**
 * Shared line-item rules for the invoice form and the POS cart: require at
 * least one filled row, and report missing description/quantity/price against
 * the exact field path so the UI can show it inline.
 */
function applyLineItemRules(
  t: TranslateFn,
  items: LineItemLike[],
  ctx: z.RefinementCtx,
) {
  const filled = items.filter((item) => isNonEmptyLineItem(item));
  if (filled.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["items"],
      message: t("vAtLeastOneItem"),
    });
  }
  items.forEach((item, index) => {
    if (!isNonEmptyLineItem(item)) return;
    if (!item.description?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["items", index, "description"],
        message: t("vRequired", { label: t("description") }),
      });
    }
    if (!(Number(item.quantity) > 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["items", index, "quantity"],
        message: t("vGreaterThanZero", { label: t("quantity") }),
      });
    }
    if (!(Number(item.unit_price) > 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["items", index, "unit_price"],
        message: t("vGreaterThanZero", { label: t("unitPrice") }),
      });
    }
  });
}

export function createLineItemSchema(t: TranslateFn) {
  return z.object({
    description: z
      .string()
      .trim()
      .max(300, t("vTooLong", { label: t("description"), max: "300" })),
    // Numeric fields stay permissive here; "required" rules for rows that are
    // actually filled in are enforced by the invoice superRefine, so a blank
    // placeholder row (from "Add Item") never blocks submission.
    quantity: numberText(t, "quantity"),
    unit_price: numberText(t, "unitPrice"),
    tax_rate: numberText(t, "taxRate", { max: 100 }).optional(),
    unit: z.string().trim().max(20).optional(),
    discount: numberText(t, "discount").optional(),
    discount_type: z.enum(["fixed", "percent"]).optional(),
    notes: z.string().trim().max(300).optional(),
    /** Server (Mongo) product id used in the API payload — only when known. */
    product: z.string().optional(),
    /** Local SQLite product id — drives qty merge; never sent to the backend. */
    local_product_id: z.string().optional(),
    /** Barcode captured at entry time (snapshot). */
    barcode: z.string().trim().max(64).optional(),
  });
}

export type LineItemFormData = z.infer<ReturnType<typeof createLineItemSchema>>;

export function createInvoiceSchema(t: TranslateFn) {
  const lineItem = createLineItemSchema(t);

  /** A percentage discount can never exceed 100. */
  const lineItemValidated = lineItem.refine(
    (item) =>
      item.discount_type !== "percent" ||
      !item.discount ||
      Number(item.discount) <= 100,
    { message: t("vDiscountMax"), path: ["discount"] },
  );

  const isoDate = (labelKey: LabelKey) =>
    z
      .string()
      .trim()
      .min(1, t("vRequired", { label: t(labelKey) }))
      .refine((v) => !Number.isNaN(Date.parse(v)), {
        message: t("vInvalidDate", { label: t(labelKey) }),
      });

  return z
    .object({
      party_id: z.string().trim().min(1, t("vSelectParty")),
      date: isoDate("invoiceDate"),
      due_date: z.string().trim().max(40).optional(),
      reference: z.string().trim().max(100).optional(),
      notes: z.string().trim().max(1000).optional(),
      terms: z.string().trim().max(1000).optional(),
      internal_notes: z.string().trim().max(1000).optional(),
      discount_type: z.enum(["percentage", "fixed"]),
      discount_value: z
        .string()
        .refine((v) => v.trim() === "" || Number.isFinite(Number(v.trim())), {
          message: t("vInvalidNumber", { label: t("discount") }),
        })
        .refine((v) => v.trim() === "" || Number(v.trim()) >= 0, {
          message: t("vNotNegative", { label: t("discount") }),
        })
        .optional(),
      shipping_charge: numberText(t, "shippingCharge").optional(),
      adjustment: signedNumberText(t, "adjustment").optional(),
      adjustment_description: z.string().trim().max(200).optional(),
      items: z.array(lineItemValidated),
      // Payment
      payment_mode: z.enum(["cash", "due", "partial"]).default("due"),
      initial_payment_amount: numberText(t, "amountReceived").optional(),
      initial_payment_account: z.string().optional(),
      initial_payment_method: z
        .enum(["cash", "bank", "mobile_wallet", "cheque", "other"])
        .optional(),
      initial_payment_reference: z.string().trim().max(100).optional(),
      initial_payment_notes: z.string().trim().max(300).optional(),
    })
    .superRefine((data, ctx) => {
      // ── Line items ─────────────────────────────────────────────────────
      applyLineItemRules(t, data.items, ctx);

      // Percentage discount must be 0–100.
      if (
        data.discount_type === "percentage" &&
        data.discount_value &&
        Number(data.discount_value) > 100
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["discount_value"],
          message: t("vDiscountMax"),
        });
      }

      // A due date before the invoice date is always an entry error.
      if (data.due_date && data.date) {
        const due = Date.parse(data.due_date);
        const issued = Date.parse(data.date);
        if (!Number.isNaN(due) && !Number.isNaN(issued) && due < issued) {
          ctx.addIssue({
            code: "custom",
            path: ["due_date"],
            message: t("vDueBeforeInvoice"),
          });
        }
      }

      // A fixed discount larger than the line subtotal would drive the invoice
      // total negative (the API has no invoice-level discount field).
      if (data.discount_type === "fixed" && data.discount_value) {
        const discountValue = Number(data.discount_value);
        if (Number.isFinite(discountValue)) {
          const subtotal = data.items.reduce((sum, item) => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.unit_price) || 0;
            return sum + qty * price;
          }, 0);
          if (discountValue > subtotal + 1e-9) {
            ctx.addIssue({
              code: "custom",
              path: ["discount_value"],
              message: t("vDiscountExceedsSubtotal"),
            });
          }
        }
      }

      // Recording money requires an amount and a destination account — otherwise
      // the invoice reads "paid" while no cash moved (revenue ≠ cash received).
      if (data.payment_mode === "partial" || data.payment_mode === "cash") {
        if (
          data.payment_mode === "partial" &&
          !(Number(data.initial_payment_amount ?? "") > 0)
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["initial_payment_amount"],
            message: t("vEnterAmountReceived"),
          });
        }
        if (!data.initial_payment_account) {
          ctx.addIssue({
            code: "custom",
            path: ["initial_payment_account"],
            message: t("vSelectAccountForPayment"),
          });
        }
      }
    });
}

export type InvoiceFormData = z.infer<ReturnType<typeof createInvoiceSchema>>;

export function createPaymentSchema(t: TranslateFn) {
  return z.object({
    amount: positiveNumberText(t, "amountReceived"),
    method: z.enum(["cash", "bank", "mobile_wallet", "cheque", "other"]),
    account: z.string().optional(),
    reference: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(300).optional(),
    date: z.string().trim().max(40).optional(),
  });
}

export type PaymentFormData = z.infer<ReturnType<typeof createPaymentSchema>>;

/**
 * Payment schema bound to the invoice's outstanding balance so the user cannot
 * type more than is owed.
 */
export function createBoundedPaymentSchema(
  t: TranslateFn,
  maxAmount: number,
) {
  const max = Number.isFinite(maxAmount) ? Math.max(0, maxAmount) : 0;
  return createPaymentSchema(t).refine(
    (data) => !(Number(data.amount) > max + 1e-9),
    {
      message: t("vPaymentExceedsOutstanding", { n: max.toFixed(2) }),
      path: ["amount"],
    },
  );
}

export const invoiceFilterSchema = z.object({
  type: z.enum(["sale", "purchase"]).optional(),
  status: z
    .enum(["draft", "pending", "partial", "paid", "overdue", "cancelled"])
    .optional(),
  party: z.string().optional(),
  from_date: z.string().trim().max(40).optional(),
  to_date: z.string().trim().max(40).optional(),
  search: z.string().trim().max(100).optional(),
});

export type InvoiceFilterFormData = z.infer<typeof invoiceFilterSchema>;

// ── POS (Phase 6) ───────────────────────────────────────────────────────────

/**
 * POS cart lines. Same rules as invoice lines, so a scanned/added line without
 * a price is rejected before it can be charged with a zero total.
 */
export function createPosCartSchema(t: TranslateFn) {
  const lineItem = createLineItemSchema(t).refine(
    (item) =>
      item.discount_type !== "percent" ||
      !item.discount ||
      Number(item.discount) <= 100,
    { message: t("vDiscountMax"), path: ["discount"] },
  );
  return z
    .object({ items: z.array(lineItem) })
    .superRefine((data, ctx) => applyLineItemRules(t, data.items, ctx));
}

export type PosCartFormData = z.infer<ReturnType<typeof createPosCartSchema>>;

/**
 * POS payment step.
 * - `cash`    → full amount, must land in an account
 * - `partial` → amount received, must land in an account
 * - `due`     → credit sale; requires a customer so the due is traceable
 */
export function createPosSaleSchema(t: TranslateFn) {
  return z
    .object({
      customer_id: z.string().optional(),
      payment_mode: z.enum(["cash", "partial", "due"]),
      account_id: z.string().optional(),
      amount_received: numberText(t, "amountReceived").optional(),
      note: z.string().trim().max(200).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.payment_mode !== "due" && !data.account_id) {
        ctx.addIssue({
          code: "custom",
          path: ["account_id"],
          message: t("vSelectAccountReceiving"),
        });
      }
      if (
        data.payment_mode === "partial" &&
        !(Number(data.amount_received) > 0)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["amount_received"],
          message: t("vEnterAmountReceived"),
        });
      }
      if (data.payment_mode === "due" && !data.customer_id) {
        ctx.addIssue({
          code: "custom",
          path: ["customer_id"],
          message: t("vSelectCustomerForCredit"),
        });
      }
    });
}

export type PosSaleFormData = z.infer<ReturnType<typeof createPosSaleSchema>>;

// ── Organization = Shop ─────────────────────────────────────────────────────

export const BUSINESS_TYPE_VALUES = [
  "retail_shop",
  "wholesale",
  "restaurant",
  "grocery",
  "electronics",
  "clothing",
  "pharmacy",
  "hardware",
  "service",
  "manufacturing",
  "general",
  "other",
] as const;

export const CURRENCY_VALUES = ["USD", "EUR", "GBP", "BDT", "INR"] as const;

export const ORGANIZATION_STATUS_VALUES = [
  "active",
  "suspended",
  "archived",
] as const;

export function createOrganizationFormSchema(t: TranslateFn) {
  const businessLabel = t("businessName");

  /** Digits with optional +, spaces, dashes, parens; 6–20 chars. */
  const phone = z
    .string()
    .trim()
    .max(20, t("vTooLong", { label: t("phoneLabel"), max: "20" }))
    .refine((v) => !v || /^[+]?[\d\s\-()]{6,20}$/.test(v), {
      message: t("vInvalidPhone"),
    })
    .optional();

  const email = z
    .string()
    .trim()
    .max(120, t("vTooLong", { label: t("emailLabel"), max: "120" }))
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: t("vInvalidEmail"),
    })
    .optional();

  return z.object({
    name: z
      .string()
      .trim()
      .min(2, t("vTooShort", { label: businessLabel, n: "2" }))
      .max(120, t("vTooLong", { label: businessLabel, max: "120" })),
    description: z
      .string()
      .trim()
      .max(500, t("vTooLong", { label: t("description"), max: "500" }))
      .optional(),
    business_type: z.enum(BUSINESS_TYPE_VALUES),
    phone,
    email,
    address: z
      .string()
      .trim()
      .max(200, t("vTooLong", { label: t("address"), max: "200" }))
      .optional(),
    currency: z.enum(CURRENCY_VALUES),
    status: z.enum(ORGANIZATION_STATUS_VALUES),
  });
}

export type OrganizationFormData = z.infer<
  ReturnType<typeof createOrganizationFormSchema>
>;

/** Shop settings. Unknown currencies/statuses can never reach the org cache. */
export function createOrganizationSettingsSchema(t: TranslateFn) {
  return z.object({
    currency: z.enum(CURRENCY_VALUES),
    status: z.enum(ORGANIZATION_STATUS_VALUES),
  });
}

export type OrganizationSettingsFormData = z.infer<
  ReturnType<typeof createOrganizationSettingsSchema>
>;
