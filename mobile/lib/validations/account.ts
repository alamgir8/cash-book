import { z } from "zod";

/**
 * Account form validation schema
 */
export const accountFormSchema = z.object({
  name: z
    .string()
    .min(1, "Account name is required")
    .max(100, "Account name must be less than 100 characters"),
  description: z.string().optional(),
  kind: z.string().optional(),
  opening_balance: z.number().optional(),
  currency_code: z.string().optional(),
  currency_symbol: z.string().optional(),
});

/**
 * Account filters validation schema
 */
export const accountFiltersSchema = z.object({
  search: z.string().optional(),
  kind: z.string().optional(),
  archived: z.boolean().optional(),
  minBalance: z.number().optional(),
  maxBalance: z.number().optional(),
});
