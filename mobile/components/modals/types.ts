import { z } from "zod";

export const transactionSchema = z.object({
  accountId: z.string().min(1, "Select an account"),
  amount: z.number().positive("Amount must be greater than zero"),
  type: z.enum(["debit", "credit"]),
  date: z.string().optional(),
  description: z.string().optional(),
  comment: z.string().optional(),
  categoryId: z.string().optional().or(z.literal("")),
  counterparty: z.string().optional(),
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;

export const transferSchema = z
  .object({
    fromAccountId: z.string().min(1, "Select source account"),
    toAccountId: z.string().min(1, "Select destination account"),
    amount: z.number().positive("Amount must be greater than zero"),
    date: z.string().optional(),
    description: z.string().optional(),
    comment: z.string().optional(),
    counterparty: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.fromAccountId &&
      value.toAccountId &&
      value.fromAccountId === value.toAccountId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toAccountId"],
        message: "Destination account must be different from source account",
      });
    }
  });

export type TransferFormValues = z.infer<typeof transferSchema>;

export type SelectOption = {
  value: string;
  label: string;
  subtitle?: string;
  group?: string;
  flow?: string;
};
