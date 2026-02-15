import { validateExportData, validatePDFContent } from "@/lib/pdf-validation";
import { auditBalance } from "@/lib/balance-audit";
import { Transaction, TransactionFilters } from "@/services/transactions";

export interface ExportResult {
  success: boolean;
  filename?: string;
  byteSize?: number;
  warnings: string[];
  errors: string[];
  metrics?: {
    transactionCount: number;
    totalDebit: number;
    totalCredit: number;
    processingTimeMs: number;
  };
}

/**
 * Safe export function with validation
 */
export async function safeExportTransactions(
  exportFn: (filters: TransactionFilters) => Promise<string>,
  filters: TransactionFilters,
  transactions: Transaction[],
): Promise<ExportResult> {
  const startTime = Date.now();
  const result: ExportResult = {
    success: false,
    warnings: [],
    errors: [],
    metrics: {
      transactionCount: transactions.length,
      totalDebit: 0,
      totalCredit: 0,
      processingTimeMs: 0,
    },
  };

  try {
    // Pre-export validation
    const dataValidation = validateExportData({
      transactions,
      summary: {
        totalDebit: calculateTotalByType(transactions, "debit"),
        totalCredit: calculateTotalByType(transactions, "credit"),
      },
      filters,
    });

    if (!dataValidation.isValid) {
      result.errors.push(...dataValidation.errors);
      return result;
    }

    result.warnings.push(...dataValidation.warnings);

    // Perform balance audit
    const totalDebit = calculateTotalByType(transactions, "debit");
    const totalCredit = calculateTotalByType(transactions, "credit");
    const reportedBalance = totalCredit - totalDebit;

    const balanceAudit = auditBalance(transactions, reportedBalance);
    if (!balanceAudit.isValid) {
      result.warnings.push(
        `Balance audit warning: ${balanceAudit.discrepancy} discrepancy detected`,
      );
      result.warnings.push(...balanceAudit.errors);
    }

    // Call export function
    const pdfContent = await exportFn(filters);

    // Post-export validation
    const pdfValidation = validatePDFContent(pdfContent);
    if (!pdfValidation.hasContent) {
      result.errors.push("PDF content is empty or too small");
      return result;
    }

    if (!pdfValidation.hasTransactions) {
      result.warnings.push("PDF may not contain transaction data");
    }

    if (!pdfValidation.hasSummary) {
      result.warnings.push("PDF may not contain summary information");
    }

    result.success = true;
    result.byteSize = pdfContent.length;
    result.metrics = {
      transactionCount: transactions.length,
      totalDebit,
      totalCredit,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error during export",
    );
  }

  result.metrics!.processingTimeMs = Date.now() - startTime;
  return result;
}

/**
 * Helper to calculate totals by type
 */
function calculateTotalByType(
  transactions: Transaction[],
  type: "debit" | "credit",
): number {
  return transactions.reduce((sum, txn) => {
    return txn.type === type ? sum + txn.amount : sum;
  }, 0);
}

/**
 * Format export result as user-friendly message
 */
export function formatExportMessage(result: ExportResult): string {
  if (result.success) {
    let msg = "PDF exported successfully";

    if (result.metrics) {
      msg += ` (${result.metrics.transactionCount} transactions)`;
    }

    if (result.warnings.length > 0) {
      msg += ` with ${result.warnings.length} warning(s)`;
    }

    return msg;
  }

  return `Export failed: ${result.errors.join(", ")}`;
}
