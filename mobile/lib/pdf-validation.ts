/**
 * Utility for validating PDF exports
 * Ensures exported data matches source data
 */

export interface PDFValidation {
  isValid: boolean;
  dataPoints: number;
  checksumMatch: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Simple checksum for data validation
 */
export function calculateDataChecksum(data: unknown): string {
  const json = JSON.stringify(data);
  let hash = 0;

  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
}

/**
 * Validate transaction data before export
 */
export function validateExportData(data: {
  transactions?: any[];
  summary?: any;
  filters?: any;
}): PDFValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let dataPoints = 0;

  // Validate transactions
  if (!Array.isArray(data.transactions)) {
    errors.push("Transactions must be an array");
  } else {
    dataPoints = data.transactions.length;

    for (let i = 0; i < data.transactions.length; i++) {
      const txn = data.transactions[i];

      if (!txn._id) {
        errors.push(`Transaction ${i}: Missing ID`);
      }

      if (!Number.isFinite(txn.amount) || txn.amount < 0) {
        errors.push(`Transaction ${i}: Invalid amount (${txn.amount})`);
      }

      if (!["credit", "debit"].includes(txn.type)) {
        errors.push(`Transaction ${i}: Invalid type (${txn.type})`);
      }

      if (!txn.date) {
        warnings.push(`Transaction ${i}: Missing date`);
      }

      if (!txn.account || !txn.account._id) {
        errors.push(`Transaction ${i}: Missing account information`);
      }
    }
  }

  // Validate summary
  if (data.summary) {
    if (
      typeof data.summary.totalDebit !== "number" ||
      typeof data.summary.totalCredit !== "number"
    ) {
      errors.push("Summary must include numeric debit and credit totals");
    }
  } else {
    warnings.push("No summary data provided");
  }

  // Calculate checksum for version tracking
  const checksumMatch =
    calculateDataChecksum(data.transactions) ===
    calculateDataChecksum(data.summary);

  return {
    isValid: errors.length === 0,
    dataPoints,
    checksumMatch,
    errors,
    warnings,
  };
}

/**
 * Validate PDF file after export
 */
export function validatePDFContent(content: string): {
  hasContent: boolean;
  hasTransactions: boolean;
  hasSummary: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  let hasContent = false;
  let hasTransactions = false;
  let hasSummary = false;

  if (!content || typeof content !== "string") {
    errors.push("PDF content must be a non-empty string");
    return { hasContent, hasTransactions, hasSummary, errors };
  }

  hasContent = content.length > 100; // Arbitrary minimum size

  // Check for transaction indicators
  if (content.includes("Debit") || content.includes("Credit")) {
    hasTransactions = true;
  }

  // Check for summary indicators
  if (
    content.includes("Total") ||
    content.includes("Summary") ||
    content.includes("Balance")
  ) {
    hasSummary = true;
  }

  if (!hasTransactions) {
    errors.push("PDF does not contain transaction data");
  }

  if (!hasSummary) {
    errors.push("PDF does not contain summary information");
  }

  return { hasContent, hasTransactions, hasSummary, errors };
}

/**
 * Compare exported data with original
 */
export function compareExportData(
  original: any[],
  exported: any[],
): {
  matches: boolean;
  missingCount: number;
  addedCount: number;
  differences: string[];
} {
  const differences: string[] = [];

  const originalIds = new Set(original.map((item) => item._id));
  const exportedIds = new Set(exported.map((item) => item._id));

  const missing = original.filter((item) => !exportedIds.has(item._id));
  const added = exported.filter((item) => !originalIds.has(item._id));

  if (missing.length > 0) {
    differences.push(`Missing ${missing.length} items in export`);
  }

  if (added.length > 0) {
    differences.push(`Added ${added.length} unexpected items in export`);
  }

  // Check for data consistency in matching items
  for (const item of original) {
    const match = exported.find((e) => e._id === item._id);
    if (match) {
      if (match.amount !== item.amount) {
        differences.push(
          `Amount mismatch for item ${item._id}: ${item.amount} vs ${match.amount}`,
        );
      }

      if (match.type !== item.type) {
        differences.push(
          `Type mismatch for item ${item._id}: ${item.type} vs ${match.type}`,
        );
      }
    }
  }

  return {
    matches: differences.length === 0,
    missingCount: missing.length,
    addedCount: added.length,
    differences,
  };
}
