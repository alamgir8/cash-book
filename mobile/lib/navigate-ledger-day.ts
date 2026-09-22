import { router } from "expo-router";
import { ledgerDayOf } from "@/lib/local-first/ledger-order";

/**
 * Open the Ledger tab filtered to a single calendar day (YYYY-MM-DD).
 * Used from Loan / Vendor / Due history rows.
 */
export function navigateToLedgerDay(date: string | null | undefined): boolean {
  const day = ledgerDayOf(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  router.navigate({
    pathname: "/(app)/transactions",
    params: { startDate: day, endDate: day },
  });
  return true;
}
