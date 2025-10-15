export const DEFAULT_CATEGORIES = [
  // Credit / Inflow categories
  { type: "income", flow: "credit", name: "Salary", color: "#16a34a" },
  { type: "income", flow: "credit", name: "Business Income", color: "#22c55e" },
  { type: "income", flow: "credit", name: "Investment Return", color: "#0ea5e9" },
  { type: "sell", flow: "credit", name: "Product Sales", color: "#0f766e" },
  { type: "sell", flow: "credit", name: "Service Sales", color: "#0284c7" },
  { type: "donation_in", flow: "credit", name: "Donations In", color: "#6366f1" },
  { type: "loan_in", flow: "credit", name: "Loan Received", color: "#f97316" },
  { type: "loan_in", flow: "credit", name: "Loan Repayment Received", color: "#fb923c" },
  { type: "other_income", flow: "credit", name: "Other Credit", color: "#a855f7" },

  // Debit / Outflow categories
  { type: "expense", flow: "debit", name: "Rent", color: "#ef4444" },
  { type: "expense", flow: "debit", name: "Utilities", color: "#f97316" },
  { type: "expense", flow: "debit", name: "Food & Dining", color: "#f59e0b" },
  { type: "expense", flow: "debit", name: "Transportation", color: "#facc15" },
  { type: "expense", flow: "debit", name: "Healthcare", color: "#f472b6" },
  { type: "expense", flow: "debit", name: "Education", color: "#38bdf8" },
  { type: "expense", flow: "debit", name: "Entertainment", color: "#c084fc" },
  { type: "purchase", flow: "debit", name: "Inventory Purchase", color: "#10b981" },
  { type: "purchase", flow: "debit", name: "Equipment Purchase", color: "#14b8a6" },
  { type: "loan_out", flow: "debit", name: "Loan Given", color: "#f97316" },
  { type: "loan_out", flow: "debit", name: "Loan Repayment Paid", color: "#fb7185" },
  { type: "donation_out", flow: "debit", name: "Donations Out", color: "#6366f1" },
  { type: "salary", flow: "debit", name: "Employee Salary", color: "#fbbf24" },
  { type: "other_expense", flow: "debit", name: "Other Debit", color: "#94a3b8" },
];
