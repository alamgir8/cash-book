import { z } from "zod";

/**
 * Shop (local-first) form validation — single source of truth.
 *
 * Why one module: the pure test suite runs modules through Node's
 * `--experimental-strip-types`, which requires explicit file extensions on
 * relative imports, while the app's `tsc` config forbids `.ts` extensions.
 * Keeping these schemas dependency-free (only `zod`) lets the tests import this
 * file directly without adding type errors to the app build.
 *
 * Convention: numeric fields are validated as *text* because that is what
 * `TextInput` produces; callers parse with `parseAmountInput` on submit.
 */

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
  label: string,
  opts?: { min?: number; max?: number; integer?: boolean },
) {
  const min = opts?.min ?? 0;
  let schema = z
    .string()
    .refine(looksNumeric, { message: `${label} must be a valid number` })
    .refine((v) => !looksNumeric(v) || numericValue(v) >= min, {
      message:
        min === 0
          ? `${label} cannot be negative`
          : `${label} must be at least ${min}`,
    });

  if (opts?.max !== undefined) {
    const max = opts.max;
    schema = schema.refine((v) => !looksNumeric(v) || numericValue(v) <= max, {
      message: `${label} must be at most ${max}`,
    });
  }
  if (opts?.integer) {
    schema = schema.refine(
      (v) => !looksNumeric(v) || Number.isInteger(numericValue(v)),
      { message: `${label} must be a whole number` },
    );
  }
  return schema;
}

/** Numeric text that may legitimately be negative (e.g. invoice adjustment). */
export function signedNumberText(label: string, opts?: { max?: number }) {
  let schema = z
    .string()
    .refine(looksNumeric, { message: `${label} must be a valid number` });
  if (opts?.max !== undefined) {
    const max = opts.max;
    schema = schema.refine((v) => !looksNumeric(v) || numericValue(v) <= max, {
      message: `${label} must be at most ${max}`,
    });
  }
  return schema;
}

/** Amount that must be strictly greater than zero (payments, quantities). */
export function positiveNumberText(label: string) {
  return z
    .string()
    .min(1, `${label} is required`)
    .refine(looksNumeric, { message: `${label} must be a valid number` })
    .refine((v) => !looksNumeric(v) || numericValue(v) > 0, {
      message: `${label} must be greater than 0`,
    });
}

const optionalTrimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be under ${max} characters`)
    .optional();

const requiredTrimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} must be under ${max} characters`);

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

const PRODUCT_NAME = requiredTrimmed(1, 150, "Product name");

const PRODUCT_SKU = z
  .string()
  .trim()
  .max(60, "SKU must be under 60 characters")
  .optional();

// Barcodes are EAN/UPC/QR/custom, so stay permissive: optional, bounded, and
// free of whitespace (a scan never has spaces, manual entry often adds one).
const PRODUCT_BARCODE = z
  .string()
  .trim()
  .max(64, "Barcode must be under 64 characters")
  .refine((v) => !v || !/\s/.test(v), {
    message: "Barcode cannot contain spaces",
  })
  .optional();

const PRODUCT_DESCRIPTION = optionalTrimmed(1000, "Description");

const PRODUCT_UNIT = z.enum(PRODUCT_UNIT_VALUES);

const TAX_RATE = numberText("Tax rate", { max: 100 });

/**
 * Create product. `opening_stock` is collected only on create — later stock
 * changes must go through inventory movements, never a raw edit.
 */
export const productFormSchema = z.object({
  name: PRODUCT_NAME,
  sku: PRODUCT_SKU,
  barcode: PRODUCT_BARCODE,
  description: PRODUCT_DESCRIPTION,
  unit: PRODUCT_UNIT,
  purchase_price: numberText("Purchase price"),
  additional_cost: numberText("Additional cost"),
  sale_price: numberText("Sale price"),
  tax_rate: TAX_RATE,
  opening_stock: numberText("Opening stock"),
  low_stock_threshold: numberText("Low stock alert"),
  track_inventory: z.boolean(),
});

export type ProductFormData = z.infer<typeof productFormSchema>;

/** Edit product — same rules minus opening stock, plus the active flag. */
export const productEditSchema = productFormSchema
  .omit({ opening_stock: true })
  .extend({ is_active: z.boolean() });

export type ProductEditFormData = z.infer<typeof productEditSchema>;

/** Manual stock adjustment (applied by the single atomic stock writer). */
export const adjustStockSchema = z.object({
  type: z.enum(["adjustment_in", "adjustment_out"]),
  quantity: positiveNumberText("Quantity"),
  unit_cost: numberText("Unit cost").optional(),
  notes: optionalTrimmed(300, "Notes"),
});

export type AdjustStockFormData = z.infer<typeof adjustStockSchema>;

/**
 * Inline "create product while invoicing" sheet. The barcode comes from the
 * scan (not a field), so it is not validated here.
 */
export const quickProductSchema = z.object({
  name: PRODUCT_NAME,
  price: numberText("Price"),
  unit: PRODUCT_UNIT,
});

export type QuickProductFormData = z.infer<typeof quickProductSchema>;

/** Shop product list filters (search is free text). */
export const productFilterSchema = z.object({
  search: z.string().trim().max(100).optional(),
  low_stock: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

// ── Invoices ────────────────────────────────────────────────────────────────

const isoDate = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => !Number.isNaN(Date.parse(v)), {
      message: `${label} must be a valid date`,
    });

export const lineItemSchema = z.object({
  description: z.string().trim().max(300, "Description must be under 300 characters"),
  // Numeric fields stay permissive here; "required" rules for rows that are
  // actually filled in are enforced by `invoiceSchema`, so a blank placeholder
  // row (from "Add Item") never blocks submission.
  quantity: numberText("Quantity"),
  unit_price: numberText("Price"),
  tax_rate: numberText("Tax rate", { max: 100 }).optional(),
  unit: z.string().trim().max(20).optional(),
  discount: numberText("Discount").optional(),
  discount_type: z.enum(["fixed", "percent"]).optional(),
  notes: optionalTrimmed(300, "Notes"),
  /** Server (Mongo) product id used in the API payload — only when known. */
  product: z.string().optional(),
  /** Local SQLite product id — drives qty merge; never sent to the backend. */
  local_product_id: z.string().optional(),
  /** Barcode captured at entry time (snapshot). */
  barcode: z.string().trim().max(64).optional(),
});

/** A percentage discount can never exceed 100. */
const lineItemValidated = lineItemSchema.refine(
  (item) =>
    item.discount_type !== "percent" ||
    !item.discount ||
    Number(item.discount) <= 100,
  { message: "Discount % cannot exceed 100", path: ["discount"] },
);

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
function applyLineItemRules(items: LineItemLike[], ctx: z.RefinementCtx) {
  const filled = items.filter((item) => isNonEmptyLineItem(item));
  if (filled.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["items"],
      message: "Add at least one item with a description and price",
    });
  }
  items.forEach((item, index) => {
    if (!isNonEmptyLineItem(item)) return;
    if (!item.description?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["items", index, "description"],
        message: "Description is required",
      });
    }
    if (!(Number(item.quantity) > 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["items", index, "quantity"],
        message: "Quantity must be greater than 0",
      });
    }
    if (!(Number(item.unit_price) > 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["items", index, "unit_price"],
        message: "Price must be greater than 0",
      });
    }
  });
}

export const invoiceSchema = z
  .object({
    party_id: z.string().trim().min(1, "Please select a party"),
    date: isoDate("Invoice date"),
    due_date: optionalTrimmed(40, "Due date"),
    reference: optionalTrimmed(100, "Reference"),
    notes: optionalTrimmed(1000, "Notes"),
    terms: optionalTrimmed(1000, "Terms"),
    internal_notes: optionalTrimmed(1000, "Internal notes"),
    discount_type: z.enum(["percentage", "fixed"]),
    discount_value: z
      .string()
      .refine((v) => v.trim() === "" || Number.isFinite(Number(v.trim())), {
        message: "Discount must be a valid number",
      })
      .refine((v) => v.trim() === "" || Number(v.trim()) >= 0, {
        message: "Discount cannot be negative",
      })
      .optional(),
    shipping_charge: numberText("Shipping charge").optional(),
    adjustment: signedNumberText("Adjustment").optional(),
    adjustment_description: optionalTrimmed(200, "Adjustment description"),
    items: z.array(lineItemValidated),
    // Payment
    payment_mode: z.enum(["cash", "due", "partial"]).default("due"),
    initial_payment_amount: numberText("Payment amount").optional(),
    initial_payment_account: z.string().optional(),
    initial_payment_method: z
      .enum(["cash", "bank", "mobile_wallet", "cheque", "other"])
      .optional(),
    initial_payment_reference: optionalTrimmed(100, "Payment reference"),
    initial_payment_notes: optionalTrimmed(300, "Payment notes"),
  })
  .superRefine((data, ctx) => {
    // ── Line items ───────────────────────────────────────────────────────
    applyLineItemRules(data.items, ctx);

    // Percentage discount must be 0–100.
    if (
      data.discount_type === "percentage" &&
      data.discount_value &&
      Number(data.discount_value) > 100
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["discount_value"],
        message: "Discount % cannot exceed 100",
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
          message: "Due date cannot be before the invoice date",
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
            message: "Discount cannot exceed the line subtotal",
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
          message: "Enter the amount received",
        });
      }
      if (!data.initial_payment_account) {
        ctx.addIssue({
          code: "custom",
          path: ["initial_payment_account"],
          message: "Select the account for this payment",
        });
      }
    }
  });

export type InvoiceFormData = z.infer<typeof invoiceSchema>;

export const paymentSchema = z.object({
  amount: positiveNumberText("Amount"),
  method: z.enum(["cash", "bank", "mobile_wallet", "cheque", "other"]),
  account: z.string().optional(),
  reference: optionalTrimmed(100, "Reference"),
  notes: optionalTrimmed(300, "Notes"),
  date: optionalTrimmed(40, "Date"),
});

export type PaymentFormData = z.infer<typeof paymentSchema>;

/**
 * Payment schema bound to the invoice's outstanding balance so the user cannot
 * type more than is owed.
 */
export function createPaymentSchema(maxAmount: number) {
  const max = Number.isFinite(maxAmount) ? Math.max(0, maxAmount) : 0;
  return paymentSchema.refine((data) => !(Number(data.amount) > max + 1e-9), {
    message: `Amount cannot exceed the outstanding ${max.toFixed(2)}`,
    path: ["amount"],
  });
}

export const invoiceFilterSchema = z.object({
  type: z.enum(["sale", "purchase"]).optional(),
  status: z
    .enum(["draft", "pending", "partial", "paid", "overdue", "cancelled"])
    .optional(),
  party: z.string().optional(),
  from_date: optionalTrimmed(40, "From date"),
  to_date: optionalTrimmed(40, "To date"),
  search: optionalTrimmed(100, "Search"),
});

export type InvoiceFilterFormData = z.infer<typeof invoiceFilterSchema>;

export type LineItemFormData = z.infer<typeof lineItemSchema>;

// ── POS (Phase 6) ───────────────────────────────────────────────────────────

/**
 * POS cart lines. Same rules as invoice lines, so a scanned/added line without
 * a price is rejected before it can be charged with a zero total.
 */
export const posCartSchema = z
  .object({ items: z.array(lineItemValidated) })
  .superRefine((data, ctx) => applyLineItemRules(data.items, ctx));

export type PosCartFormData = z.infer<typeof posCartSchema>;

/**
 * POS payment step.
 * - `cash`    → full amount, must land in an account
 * - `partial` → amount received, must land in an account
 * - `due`     → credit sale; requires a customer so the due is traceable
 */
export const posSaleSchema = z
  .object({
    customer_id: z.string().optional(),
    payment_mode: z.enum(["cash", "partial", "due"]),
    account_id: z.string().optional(),
    amount_received: numberText("Amount received").optional(),
    note: optionalTrimmed(200, "Note"),
  })
  .superRefine((data, ctx) => {
    if (data.payment_mode !== "due" && !data.account_id) {
      ctx.addIssue({
        code: "custom",
        path: ["account_id"],
        message: "Select the account that receives the money",
      });
    }
    if (
      data.payment_mode === "partial" &&
      !(Number(data.amount_received) > 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["amount_received"],
        message: "Enter the amount received",
      });
    }
    if (data.payment_mode === "due" && !data.customer_id) {
      ctx.addIssue({
        code: "custom",
        path: ["customer_id"],
        message: "Select a customer for a credit sale",
      });
    }
  });

export type PosSaleFormData = z.infer<typeof posSaleSchema>;

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

/** Digits with optional +, spaces, dashes, parens; 6–20 chars. */
const PHONE = z
  .string()
  .trim()
  .max(20, "Phone must be under 20 characters")
  .refine((v) => !v || /^[+]?[\d\s\-()]{6,20}$/.test(v), {
    message: "Enter a valid phone number",
  })
  .optional();

const EMAIL = z
  .string()
  .trim()
  .max(120, "Email must be under 120 characters")
  .refine((v) => !v || z.string().email().safeParse(v).success, {
    message: "Enter a valid email address",
  })
  .optional();

export const organizationFormSchema = z.object({
  name: requiredTrimmed(2, 120, "Business name"),
  description: optionalTrimmed(500, "Description"),
  business_type: z.enum(BUSINESS_TYPE_VALUES),
  phone: PHONE,
  email: EMAIL,
  address: optionalTrimmed(200, "Address"),
  currency: z.enum(CURRENCY_VALUES),
  status: z.enum(ORGANIZATION_STATUS_VALUES),
});

export type OrganizationFormData = z.infer<typeof organizationFormSchema>;

/** Shop settings. Unknown currencies/statuses can never reach the org cache. */
export const organizationSettingsSchema = z.object({
  currency: z.enum(CURRENCY_VALUES),
  status: z.enum(ORGANIZATION_STATUS_VALUES),
});

export type OrganizationSettingsFormData = z.infer<
  typeof organizationSettingsSchema
>;
