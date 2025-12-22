import type {
  PartyType,
  PartyFormData,
  CreatePartyPayload,
  UpdatePartyPayload,
  PartyAddress,
} from "@/types/party";

/**
 * Format party balance for display
 */
export function formatPartyBalance(balance: number): string {
  const absBalance = Math.abs(balance);
  const formatted = absBalance.toLocaleString();
  if (balance > 0) return `${formatted} Receivable`;
  if (balance < 0) return `${formatted} Payable`;
  return "Settled";
}

/**
 * Get balance color based on amount
 */
export function getPartyBalanceColor(balance: number): string {
  if (balance > 0) return "text-green-600";
  if (balance < 0) return "text-red-600";
  return "text-gray-500";
}

/**
 * Get party type label
 */
export function getPartyTypeLabel(type: PartyType): string {
  const typeLabels: Record<PartyType, string> = {
    customer: "Customer",
    supplier: "Supplier",
    both: "Customer & Supplier",
  };
  return typeLabels[type] || type;
}

/**
 * Get party type icon
 */
export function getPartyTypeIcon(type: PartyType): string {
  const typeIcons: Record<PartyType, string> = {
    customer: "person",
    supplier: "storefront",
    both: "people",
  };
  return typeIcons[type] || "person";
}

/**
 * Get party type color
 */
export function getPartyTypeColor(type: PartyType): {
  bg: string;
  text: string;
  icon: string;
} {
  const typeColors: Record<
    PartyType,
    { bg: string; text: string; icon: string }
  > = {
    customer: {
      bg: "bg-green-100",
      text: "text-green-700",
      icon: "#10B981",
    },
    supplier: {
      bg: "bg-orange-100",
      text: "text-orange-700",
      icon: "#F97316",
    },
    both: {
      bg: "bg-blue-100",
      text: "text-blue-700",
      icon: "#3B82F6",
    },
  };
  return typeColors[type] || typeColors.customer;
}

/**
 * Transform party form data to create payload
 */
export function transformPartyFormToCreatePayload(
  formData: PartyFormData
): CreatePartyPayload {
  const payload: CreatePartyPayload = {
    name: formData.name,
    type: formData.type,
  };

  if (formData.code) payload.code = formData.code;
  if (formData.phone) payload.phone = formData.phone;
  if (formData.email) payload.email = formData.email;
  if (formData.tax_id) payload.tax_id = formData.tax_id;
  if (formData.notes) payload.notes = formData.notes;

  // Address
  if (formData.address) {
    const hasAddressData = Object.values(formData.address).some(
      (val) => val && val.trim()
    );
    if (hasAddressData) {
      payload.address = formData.address;
    }
  }

  // Numeric fields
  if (formData.credit_limit) {
    const creditLimit = parseFloat(formData.credit_limit);
    if (!isNaN(creditLimit)) payload.credit_limit = creditLimit;
  }

  if (formData.payment_terms_days) {
    const paymentTerms = parseInt(formData.payment_terms_days);
    if (!isNaN(paymentTerms)) payload.payment_terms_days = paymentTerms;
  }

  if (formData.opening_balance) {
    const openingBalance = parseFloat(formData.opening_balance);
    if (!isNaN(openingBalance) && openingBalance !== 0) {
      // For receivable: positive balance (customer owes us)
      // For payable: negative balance (we owe supplier)
      payload.opening_balance =
        formData.opening_balance_type === "receivable"
          ? openingBalance
          : -openingBalance;
    }
  }

  return payload;
}

/**
 * Transform party form data to update payload
 */
export function transformPartyFormToUpdatePayload(
  formData: Partial<PartyFormData>
): UpdatePartyPayload {
  const payload: UpdatePartyPayload = {};

  if (formData.name) payload.name = formData.name;
  if (formData.type) payload.type = formData.type;
  if (formData.code !== undefined) payload.code = formData.code;
  if (formData.phone !== undefined) payload.phone = formData.phone;
  if (formData.email !== undefined) payload.email = formData.email;
  if (formData.tax_id !== undefined) payload.tax_id = formData.tax_id;
  if (formData.notes !== undefined) payload.notes = formData.notes;

  // Address
  if (formData.address) {
    payload.address = formData.address;
  }

  // Numeric fields
  if (formData.credit_limit !== undefined) {
    const creditLimit = parseFloat(formData.credit_limit);
    if (!isNaN(creditLimit)) payload.credit_limit = creditLimit;
  }

  if (formData.payment_terms_days !== undefined) {
    const paymentTerms = parseInt(formData.payment_terms_days);
    if (!isNaN(paymentTerms)) payload.payment_terms_days = paymentTerms;
  }

  return payload;
}

/**
 * Format party address for display
 */
export function formatPartyAddress(
  address: PartyAddress | string | undefined
): string {
  if (!address) return "Not specified";
  if (typeof address === "string") return address;

  return (
    [
      address.street,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ]
      .filter(Boolean)
      .join(", ") || "Not specified"
  );
}

/**
 * Format date for ledger display
 */
export function formatLedgerDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format amount for ledger display
 */
export function formatLedgerAmount(amount: number): string {
  return Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format ledger balance with Dr/Cr notation
 */
export function formatLedgerBalance(balance: number): string {
  const absBalance = Math.abs(balance);
  const formatted = absBalance.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (balance > 0) return `${formatted} Dr`;
  if (balance < 0) return `${formatted} Cr`;
  return "0.00";
}

/**
 * Filter parties by type
 */
export function filterPartiesByType<T extends { type: PartyType }>(
  parties: T[],
  type?: PartyType
): T[] {
  if (!type) return parties;
  return parties.filter(
    (party) => party.type === type || party.type === "both"
  );
}

/**
 * Sort parties by balance (highest to lowest)
 */
export function sortPartiesByBalance<T extends { current_balance: number }>(
  parties: T[]
): T[] {
  return [...parties].sort((a, b) => b.current_balance - a.current_balance);
}

/**
 * Sort parties by name (alphabetically)
 */
export function sortPartiesByName<T extends { name: string }>(
  parties: T[]
): T[] {
  return [...parties].sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );
}

/**
 * Calculate total balance for parties
 */
export function calculateTotalPartyBalance<
  T extends { current_balance: number }
>(parties: T[]): number {
  return parties.reduce((total, party) => total + party.current_balance, 0);
}
