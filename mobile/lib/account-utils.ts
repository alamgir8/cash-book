import type { AccountPayload, AccountFormData } from "@/types/account";

/**
 * Format account balance for display
 */
export function formatAccountBalance(
  balance: number,
  options?: { showSign?: boolean }
): { value: number; isPositive: boolean; sign: string } {
  const isPositive = balance >= 0;
  const absValue = Math.abs(balance);
  const sign = options?.showSign ? (isPositive ? "+" : "-") : "";

  return {
    value: absValue,
    isPositive,
    sign,
  };
}

/**
 * Calculate account net flow
 */
export function calculateAccountNetFlow(
  totalCredit?: number,
  totalDebit?: number
): number {
  return (totalCredit ?? 0) - (totalDebit ?? 0);
}

/**
 * Transform account form data to API payload
 */
export function transformAccountFormData(
  formData: AccountFormData
): AccountPayload {
  return {
    name: formData.name,
    description: formData.description || undefined,
    kind: formData.kind || undefined,
    opening_balance: formData.opening_balance || undefined,
    currency_code: formData.currency_code || undefined,
    currency_symbol: formData.currency_symbol || undefined,
  };
}

/**
 * Get account kind display label
 */
export function getAccountKindLabel(kind?: string): string {
  if (!kind) return "General";

  const kindMap: Record<string, string> = {
    cash: "Cash",
    bank: "Bank",
    mobile: "Mobile Money",
    credit: "Credit Card",
    loan: "Loan",
    investment: "Investment",
    other: "Other",
  };

  return kindMap[kind.toLowerCase()] || kind;
}

/**
 * Get account kind icon name
 */
export function getAccountKindIcon(kind?: string): string {
  if (!kind) return "wallet-outline";

  const iconMap: Record<string, string> = {
    cash: "cash-outline",
    bank: "business-outline",
    mobile: "phone-portrait-outline",
    credit: "card-outline",
    loan: "trending-down-outline",
    investment: "trending-up-outline",
    other: "wallet-outline",
  };

  return iconMap[kind.toLowerCase()] || "wallet-outline";
}

/**
 * Sort accounts by balance (highest to lowest)
 */
export function sortAccountsByBalance<T extends { balance: number }>(
  accounts: T[]
): T[] {
  return [...accounts].sort((a, b) => b.balance - a.balance);
}

/**
 * Filter accounts by kind
 */
export function filterAccountsByKind<T extends { kind?: string }>(
  accounts: T[],
  kind?: string
): T[] {
  if (!kind) return accounts;
  return accounts.filter(
    (account) => account.kind?.toLowerCase() === kind.toLowerCase()
  );
}

/**
 * Calculate total balance across all accounts
 */
export function calculateTotalBalance<T extends { balance: number }>(
  accounts: T[]
): number {
  return accounts.reduce((total, account) => total + account.balance, 0);
}
