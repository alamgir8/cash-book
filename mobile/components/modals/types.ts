import { z } from "zod";

export const transactionSchema = z.object({
  accountId: z.string().min(1, "Select an account"),
  amount: z.number().positive("Amount must be greater than zero"),
  type: z.enum(["debit", "credit"]),
  date: z.string().optional(),
  description: z.string().optional(),
  comment: z.string().optional(),
  categoryId: z.string().optional().or(z.literal("")),
  party: z.string().optional(), // vendor/supplier Party ObjectId
  for_party: z.string().optional(), // beneficiary/for-whom Party ObjectId
  payment_status: z.enum(["paid", "due"]).default("paid"),
  due_date: z.string().optional(),
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;

/** Extra payload the modal may pass when bulk mode creates multiple rows */
export type TransactionBulkEntry = {
  party?: string;
  for_party?: string;
};

export type TransactionSubmitValues = TransactionFormValues & {
  bulkEntries?: TransactionBulkEntry[];
};

/**
 * Expand bulk vendor/counterparty selections into one entry per person.
 * Rule: only one side may have multiple values.
 */
export function expandBulkPartyEntries(
  parties: string[],
  forParties: string[],
): TransactionBulkEntry[] {
  const ps = parties.map((p) => p.trim()).filter(Boolean);
  const fs = forParties.map((p) => p.trim()).filter(Boolean);

  if (ps.length > 1 && fs.length > 1) {
    throw new Error(
      "Bulk mode allows multiple vendors or multiple counterparties, not both",
    );
  }

  if (ps.length > 1) {
    const forParty = fs[0] || undefined;
    return ps.map((party) => ({ party, for_party: forParty }));
  }

  if (fs.length > 1) {
    const party = ps[0] || undefined;
    return fs.map((for_party) => ({ party, for_party }));
  }

  return [
    {
      party: ps[0] || undefined,
      for_party: fs[0] || undefined,
    },
  ];
}

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
