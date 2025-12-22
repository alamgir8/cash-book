import { z } from "zod";

/**
 * Party form validation schema
 */
export const partyFormSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  type: z.enum(["customer", "supplier", "both"], {
    required_error: "Party type is required",
  }),
  code: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postal_code: z.string().optional(),
    })
    .optional(),
  tax_id: z.string().optional(),
  credit_limit: z.string().optional(),
  payment_terms_days: z.string().optional(),
  opening_balance: z.string().optional(),
  opening_balance_type: z.enum(["receivable", "payable"]),
  notes: z.string().optional(),
});

/**
 * Party filters validation schema
 */
export const partyFiltersSchema = z.object({
  type: z.enum(["customer", "supplier", "both"]).optional(),
  search: z.string().optional(),
  archived: z.boolean().or(z.literal("all")).optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});
