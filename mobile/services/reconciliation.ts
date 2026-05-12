import { api } from "../lib/api";

export type AccountDiscrepancy = {
  account_id: string;
  account_name: string;
  stored_balance: number;
  computed_balance: number;
  difference: number;
  opening_balance: number;
  total_credit: number;
  total_debit: number;
};

export type BalanceVerificationReport = {
  verified_at: string;
  accounts_checked: number;
  discrepancies: AccountDiscrepancy[];
  transfers_checked: number;
  orphaned_transfer_legs: {
    transfer_id: string;
    debit_transaction_id: string;
    credit_transaction_id: string;
    debit_deleted: boolean;
    credit_deleted: boolean;
    amount: number;
  }[];
  is_consistent: boolean;
};

export type ReconciliationResult = {
  message: string;
  accounts_processed: number;
  transactions_updated: number;
  corrections_made: number;
  corrections: {
    account_id: string;
    account_name: string;
    previous_balance: number;
    corrected_balance: number;
    difference: number;
    transactions_updated: number;
  }[];
  is_fully_consistent: boolean;
};

/**
 * Verify account balances without making changes.
 * Returns a detailed report of any discrepancies.
 */
export const verifyBalances = async (
  organizationId?: string,
): Promise<BalanceVerificationReport> => {
  const params = organizationId ? { organizationId } : undefined;
  const response = await api.get<BalanceVerificationReport>(
    "/reconciliation/verify",
    { params },
  );
  return response.data;
};

/**
 * Recalculate and fix all account balances from transaction history.
 */
export const reconcileBalances = async (
  organizationId?: string,
): Promise<ReconciliationResult> => {
  const params = organizationId ? { organizationId } : undefined;
  const response = await api.post<ReconciliationResult>(
    "/reconciliation/reconcile",
    {},
    { params },
  );
  return response.data;
};
