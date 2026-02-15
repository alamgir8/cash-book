import { Transaction } from "@/services/transactions";

/**
 * Utility for validating balance calculations
 * Ensures floating-point precision issues don't cause discrepancies
 */

export interface BalanceAudit {
  isValid: boolean;
  discrepancy: number;
  calculatedBalance: number;
  reportedBalance: number;
  errors: string[];
  warnings: string[];
}

const PRECISION = 100; // 2 decimal places

/**
 * Round to 2 decimal places to avoid floating point errors
 */
function roundAmount(amount: number): number {
  return Math.round(amount * PRECISION) / PRECISION;
}

/**
 * Calculate balance from transaction list
 */
export function calculateBalanceFromTransactions(
  transactions: Transaction[],
  startingBalance: number = 0,
): number {
  let balance = roundAmount(startingBalance);

  for (const txn of transactions) {
    const amount = roundAmount(txn.amount);
    if (txn.type === "credit") {
      balance = roundAmount(balance + amount);
    } else {
      balance = roundAmount(balance - amount);
    }
  }

  return balance;
}

/**
 * Audit balance calculations
 */
export function auditBalance(
  transactions: Transaction[],
  reportedBalance: number,
  startingBalance: number = 0,
): BalanceAudit {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate transaction data
  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i];

    if (!Number.isFinite(txn.amount)) {
      errors.push(`Transaction ${i}: Invalid amount (${txn.amount})`);
    }

    if (!["credit", "debit"].includes(txn.type)) {
      errors.push(
        `Transaction ${i}: Invalid type (${txn.type}). Must be 'credit' or 'debit'`,
      );
    }

    if (!txn.date) {
      warnings.push(`Transaction ${i}: Missing date`);
    }
  }

  // Calculate balance
  const calculatedBalance = calculateBalanceFromTransactions(
    transactions,
    startingBalance,
  );

  // Compare with reported balance
  const discrepancy = Math.abs(calculatedBalance - reportedBalance);
  const TOLERANCE = 0.01; // Allow 1 cent discrepancy due to floating point

  if (discrepancy > TOLERANCE) {
    errors.push(
      `Balance mismatch: calculated ${calculatedBalance}, reported ${reportedBalance} (discrepancy: ${discrepancy})`,
    );
  }

  return {
    isValid: errors.length === 0,
    discrepancy: roundAmount(discrepancy),
    calculatedBalance: roundAmount(calculatedBalance),
    reportedBalance: roundAmount(reportedBalance),
    errors,
    warnings,
  };
}

/**
 * Validate transaction amounts
 */
export function validateTransactionAmount(amount: unknown): {
  isValid: boolean;
  value?: number;
  error?: string;
} {
  // Must be a number
  if (typeof amount !== "number") {
    return { isValid: false, error: "Amount must be a number" };
  }

  // Must be finite
  if (!Number.isFinite(amount)) {
    return { isValid: false, error: "Amount must be a finite number" };
  }

  // Must be positive
  if (amount < 0) {
    return { isValid: false, error: "Amount must be positive" };
  }

  // Must have at most 2 decimal places
  const rounded = roundAmount(amount);
  if (Math.abs(amount - rounded) > 0.001) {
    return {
      isValid: false,
      error: `Amount has too many decimal places (max 2 allowed)`,
    };
  }

  return { isValid: true, value: rounded };
}

/**
 * Reconcile transactions - fix floating point errors
 */
export function reconcileBalance(
  transactions: Transaction[],
  targetBalance: number,
): {
  adjustedTransactions: Transaction[];
  correctionAmount: number;
} {
  const calculated = calculateBalanceFromTransactions(transactions);
  const correctionAmount = roundAmount(targetBalance - calculated);

  if (Math.abs(correctionAmount) < 0.01) {
    // No correction needed
    return { adjustedTransactions: transactions, correctionAmount: 0 };
  }

  // Apply correction to the last transaction
  const adjusted = [...transactions];
  if (adjusted.length > 0) {
    const lastIndex = adjusted.length - 1;
    const lastTxn = { ...adjusted[lastIndex] };
    lastTxn.amount = roundAmount(lastTxn.amount + Math.abs(correctionAmount));
    adjusted[lastIndex] = lastTxn;
  }

  return { adjustedTransactions: adjusted, correctionAmount };
}
