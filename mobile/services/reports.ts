import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import dayjs from "dayjs";
import {
  fetchTransactions,
  type Transaction,
  type TransactionFilters,
} from "./transactions";
import { fetchAccountDetail } from "./accounts";

type RawFilters = Record<string, unknown>;

type DisplayFilters = {
  range?: string;
  from?: string;
  to?: string;
  accountId?: string;
  accountName?: string;
  accounts?: string[];
  categoryId?: string;
  categoryNames?: string[];
  counterparty?: string;
  financialScope?: string;
  type?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  includeDeleted?: boolean;
};

type ParsedFilters = {
  filters: TransactionFilters;
  display: DisplayFilters;
};

type Totals = {
  debit: number;
  credit: number;
  net: number;
};

const toStringValue = (
  value: unknown,
  fallbackKeys: string[] = []
): string | undefined => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  for (const key of fallbackKeys) {
    if (
      typeof (value as Record<string, unknown> | undefined)?.[key] === "string"
    ) {
      const nested = (value as Record<string, unknown>)[key];
      if (typeof nested === "string" && nested.trim().length > 0) {
        return nested.trim();
      }
    }
  }
  return undefined;
};

const toNumberValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
};

const parseFilters = (raw: RawFilters): ParsedFilters => {
  const filters: TransactionFilters = {};
  const display: DisplayFilters = {};

  const from =
    toStringValue(raw.from) ??
    toStringValue(raw.startDate) ??
    toStringValue(raw.start_date);
  if (from) {
    filters.from = from;
    display.from = from;
  }

  const to =
    toStringValue(raw.to) ??
    toStringValue(raw.endDate) ??
    toStringValue(raw.end_date);
  if (to) {
    filters.to = to;
    display.to = to;
  }

  const range = toStringValue(raw.range);
  if (range) {
    filters.range = range;
    display.range = range;
  }

  const accountId =
    toStringValue(raw.accountId) ??
    toStringValue(raw.account_id) ??
    toStringValue(raw.account);
  if (accountId) {
    filters.accountId = accountId;
    display.accountId = accountId;
  }

  const accountName =
    toStringValue(raw.accountName) ?? toStringValue(raw.account_name);
  if (accountName) {
    display.accountName = accountName;
  }

  const categoryId =
    toStringValue(raw.categoryId) ??
    toStringValue(raw.category_id) ??
    toStringValue(raw.category);
  if (categoryId) {
    filters.categoryId = categoryId;
    display.categoryId = categoryId;
  }

  const counterparty = toStringValue(raw.counterparty);
  if (counterparty) {
    filters.counterparty = counterparty;
    display.counterparty = counterparty;
  }

  const financialScope =
    toStringValue(raw.financialScope) ?? toStringValue(raw.financial_scope);
  if (financialScope) {
    filters.financialScope =
      financialScope as TransactionFilters["financialScope"];
    display.financialScope = financialScope;
  }

  const type = toStringValue(raw.type);
  if (type) {
    filters.type = type as TransactionFilters["type"];
    display.type = type;
  }

  const search =
    toStringValue(raw.q) ??
    toStringValue(raw.search) ??
    toStringValue(raw.keyword) ??
    toStringValue(raw.query);
  if (search) {
    filters.q = search;
    display.search = search;
  }

  const minAmount =
    toNumberValue(raw.minAmount) ?? toNumberValue(raw.min_amount);
  if (minAmount !== undefined) {
    filters.minAmount = minAmount;
    display.minAmount = minAmount;
  }

  const maxAmount =
    toNumberValue(raw.maxAmount) ?? toNumberValue(raw.max_amount);
  if (maxAmount !== undefined) {
    filters.maxAmount = maxAmount;
    display.maxAmount = maxAmount;
  }

  const includeDeleted =
    parseBoolean(raw.includeDeleted) ?? parseBoolean(raw.include_deleted);
  if (includeDeleted === true) {
    filters.includeDeleted = true;
    display.includeDeleted = true;
  }

  // Carry through pagination values if explicitly provided, otherwise we will override later.
  const page = toNumberValue(raw.page);
  if (page && page > 0) {
    filters.page = page;
  }
  const limit = toNumberValue(raw.limit);
  if (limit && limit > 0) {
    filters.limit = limit;
  }

  return { filters, display };
};

const escapeHtml = (value: string | number): string => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const formatDateLabel = (value?: string): string | undefined => {
  if (!value) return undefined;
  const parsed = dayjs(value);
  if (!parsed.isValid()) return value;
  return parsed.format("MMM D, YYYY");
};

const capitalize = (value?: string): string | undefined => {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatAmount = (
  amount: number | undefined,
  currencySymbol?: string
): string => {
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return "—";
  }
  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? "-" : "";
  const absolute = Math.abs(amount);
  const formatted = formatter.format(absolute);
  if (!currencySymbol) {
    return `${sign}${formatted}`;
  }
  return `${sign}${currencySymbol}${formatted}`;
};

const computeTotals = (transactions: Transaction[]): Totals => {
  const totals = transactions.reduce(
    (acc, txn) => {
      if (txn.type === "credit") {
        acc.credit += txn.amount;
      } else {
        acc.debit += txn.amount;
      }
      return acc;
    },
    { debit: 0, credit: 0 }
  );
  return {
    ...totals,
    net: totals.credit - totals.debit,
  };
};

const collectTransactions = async (
  baseFilters: TransactionFilters
): Promise<{ transactions: Transaction[]; total: number }> => {
  const transactions: Transaction[] = [];
  let currentPage = 1;
  let totalPages = 1;
  let grandTotal = 0;
  const pageSize = 200; // backend caps at 200 per request

  const accountSnapshots = new Map<
    string,
    { after: number; amount: number; type: "credit" | "debit" }
  >();

  do {
    const response = await fetchTransactions({
      ...baseFilters,
      page: currentPage,
      limit: pageSize,
    });

    response.transactions.forEach((txn) => {
      const accountId =
        typeof txn.account === "object" ? txn.account?._id : txn.account;
      if (!accountId) return;
      accountSnapshots.set(accountId, {
        after: Number(txn.balance_after_transaction ?? 0),
        amount: Number(txn.amount ?? 0),
        type: txn.type,
      });
    });

    transactions.push(...response.transactions);
    totalPages = response.pagination.pages ?? 1;
    grandTotal = response.pagination.total ?? transactions.length;
    currentPage += 1;
  } while (currentPage <= totalPages);

  const startingBalances = new Map<string, number>();
  accountSnapshots.forEach((snapshot, accountId) => {
    let starting = snapshot.after;
    if (snapshot.type === "credit") {
      starting -= snapshot.amount;
    } else {
      starting += snapshot.amount;
    }
    startingBalances.set(accountId, starting);
  });

  transactions.sort((a, b) => {
    const left = dayjs(a.date).valueOf();
    const right = dayjs(b.date).valueOf();
    if (left === right) {
      return (
        dayjs(a.createdAt ?? a.date).valueOf() -
        dayjs(b.createdAt ?? b.date).valueOf()
      );
    }
    return left - right;
  });

  const runningBalances = new Map<string, number>();
  transactions.forEach((txn) => {
    const accountId =
      typeof txn.account === "object" ? txn.account?._id : txn.account;
    if (!accountId) return;

    let running = runningBalances.get(accountId);
    if (running === undefined) {
      running = startingBalances.get(accountId) ?? 0;
    }

    if (txn.type === "credit") {
      running += Number(txn.amount ?? 0);
    } else {
      running -= Number(txn.amount ?? 0);
    }

    txn.balance_after_transaction = running;
    runningBalances.set(accountId, running);
  });

  return { transactions, total: grandTotal };
};

const buildFiltersSection = (
  display: DisplayFilters,
  currencySymbol?: string
): string => {
  const chips: string[] = [];

  if (display.range) {
    chips.push(`Range: ${capitalize(display.range)}`);
  }

  if (display.from || display.to) {
    const fromLabel = formatDateLabel(display.from) ?? "Start";
    const toLabel = formatDateLabel(display.to) ?? "Present";
    chips.push(`Dates: ${fromLabel} → ${toLabel}`);
  }

  if (display.accountName) {
    chips.push(`Account: ${display.accountName}`);
  } else if (display.accounts && display.accounts.length > 0) {
    chips.push(`Accounts Included: ${display.accounts.join(", ")}`);
  } else if (display.accountId) {
    chips.push(`Account ID: ${display.accountId}`);
  }

  if (display.categoryNames && display.categoryNames.length > 0) {
    chips.push(
      `Categories: ${display.categoryNames
        .map((name) => name || "Unknown")
        .join(", ")}`
    );
  } else if (display.categoryId) {
    chips.push(`Category ID: ${display.categoryId}`);
  }

  if (display.counterparty) {
    chips.push(`Counterparty: ${display.counterparty}`);
  }

  if (display.financialScope) {
    const scopeLabels: Record<string, string> = {
      actual: "Actual (income & expense)",
      income: "Income only",
      expense: "Expense only",
      both: "Income & expense",
    };
    const scopeLabel =
      scopeLabels[display.financialScope] ?? capitalize(display.financialScope);
    chips.push(`Scope: ${scopeLabel}`);
  }

  if (display.type) {
    chips.push(`Flow: ${capitalize(display.type)}`);
  }

  if (display.search) {
    chips.push(`Search: “${display.search}”`);
  }

  if (display.minAmount !== undefined || display.maxAmount !== undefined) {
    const min =
      display.minAmount !== undefined
        ? formatAmount(display.minAmount, currencySymbol)
        : "Any";
    const max =
      display.maxAmount !== undefined
        ? formatAmount(display.maxAmount, currencySymbol)
        : "Any";
    chips.push(`Amount Range: ${min} → ${max}`);
  }

  if (display.includeDeleted) {
    chips.push("Including deleted transactions");
  }

  if (chips.length === 0) {
    return "";
  }

  const chipHtml = chips
    .map((chip) => `<span class="chip">${escapeHtml(chip)}</span>`)
    .join("");

  return `
    <section class="filters">
      <h2>Applied Filters</h2>
      <div class="chips">
        ${chipHtml}
      </div>
    </section>
  `;
};

const buildReportHtml = ({
  transactions,
  totals,
  generatedAt,
  accountName,
  currencySymbol,
  displayFilters,
  totalCount,
  showBalanceColumn,
}: {
  transactions: Transaction[];
  totals: Totals;
  generatedAt: string;
  accountName?: string;
  currencySymbol?: string;
  displayFilters: DisplayFilters;
  totalCount: number;
  showBalanceColumn: boolean;
}): string => {
  const title = accountName
    ? `${accountName} · Transactions Report`
    : "Transactions Report";

  const filtersSection = buildFiltersSection(displayFilters, currencySymbol);

  const rows =
    transactions.length > 0
      ? transactions
          .map((txn, index) => {
            const dateLabel = dayjs(txn.date).isValid()
              ? dayjs(txn.date).format("MMM DD, YYYY")
              : txn.date;

            const accountLabel = txn.account?.name ?? "—";
            const categoryLabel = txn.category?.name ?? "—";
            const counterpartyLabel = txn.counterparty ?? "—";

            const descriptionParts: string[] = [];
            if (txn.description)
              descriptionParts.push(escapeHtml(txn.description));
            if (txn.keyword) {
              descriptionParts.push(
                `<span class="text-muted">Tag: ${escapeHtml(
                  txn.keyword
                )}</span>`
              );
            }
            const descriptionCell =
              descriptionParts.length > 0
                ? descriptionParts.join("<br />")
                : "—";

            const amountClass =
              txn.type === "credit" ? "amount credit" : "amount debit";
            const typeBadgeClass =
              txn.type === "credit" ? "badge credit" : "badge debit";

            const balanceAfter = txn.balance_after_transaction ?? undefined;

            return `
              <tr>
                <td class="col-id">${index + 1}</td>
                <td class="col-date">${escapeHtml(dateLabel)}</td>
                <td class="col-account">${escapeHtml(accountLabel)}</td>
                <td class="col-category">${escapeHtml(categoryLabel)}</td>
                <td class="col-counterparty">${escapeHtml(
                  counterpartyLabel
                )}</td>
                <td class="col-type"><span class="${typeBadgeClass}">${escapeHtml(
              capitalize(txn.type) ?? txn.type
            )}</span></td>
                <td class="col-desc">${descriptionCell}</td>
                <td class="${amountClass} col-amt">${escapeHtml(
              formatAmount(txn.amount, currencySymbol)
            )}</td>
                ${
                  showBalanceColumn
                    ? `<td class="amount balance col-bal">${escapeHtml(
                        formatAmount(balanceAfter, currencySymbol)
                      )}</td>`
                    : ""
                }
              </tr>
            `;
          })
          .join("")
      : `<tr><td class="empty" colspan="${
          showBalanceColumn ? 9 : 8
        }">No transactions found for the selected filters.</td></tr>`;

  const bannerClass = totals.net >= 0 ? "banner positive" : "banner negative";

  const summaryCards = `
    <section class="kpis">
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-label">Total Transactions</div>
          <div class="kpi-value">${escapeHtml(
            String(transactions.length)
          )}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Total Credit</div>
          <div class="kpi-value positive">${escapeHtml(
            formatAmount(totals.credit, currencySymbol)
          )}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Total Debit</div>
          <div class="kpi-value negative">${escapeHtml(
            formatAmount(totals.debit, currencySymbol)
          )}</div>
        </div>
      </div>
      <div class="${bannerClass}">
        <div class="banner-icon">🏷️</div>
        <div class="banner-text">
          <div class="banner-title">Net Position</div>
          <div class="banner-value">${escapeHtml(
            formatAmount(totals.net, currencySymbol)
          )}</div>
        </div>
      </div>
    </section>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
      color: #0f172a;
      background: #f6f7fb;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .page {
      padding: 8px;
      min-height: 100%;
    }

    /* Hero header (like cricket PDF top bar) */
    .hero {
      background: #34a4eb;
      color: #ecfdf5;
      border-radius: 6px;
      padding: 18px 18px 16px;
      box-shadow: 0 10px 28px rgba(4, 120, 87, 0.22);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }
    .hero-title {
      margin: 0;
      font-weight: 800;
      letter-spacing: .2px;
      font-size: 20px;
      line-height: 1.2;
    }
    .hero-sub {
      margin-top: 4px;
      color: #d1fae5;
      font-size: 12px;
    }
    .hero-meta {
      text-align: right;
      font-size: 12px;
      color: #bbf7d0;
      line-height: 1.5;
    }

    /* KPIs row like “Match Summary” cards */
    .kpis { margin: 16px 2px 14px; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 12px;
    }
    .kpi {
      grid-column: span 4;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 14px 16px;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
    }
    .kpi-label {
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: #1f2937;
      font-weight: 800;
    }
    .kpi-value {
      margin-top: 8px;
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
    }
    .kpi-value.positive { color: #0f766e; }
    .kpi-value.negative { color: #b91c1c; }

    /* Net banner (like winner ribbon) */
    .banner {
      display: flex;
      align-items: center;
      gap: 12px;
      border-radius: 12px;
      padding: 12px 14px;
      margin-top: 12px;
      border: 1px solid;
    }
    .banner.positive {
      background: #ecfdf5;
      border-color: #a7f3d0;
      color: #065f46;
    }
    .banner.negative {
      background: #fef2f2;
      border-color: #fecaca;
      color: #7f1d1d;
    }
    .banner-icon { font-size: 16px; }
    .banner-title {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: .08em;
      opacity: .9;
      font-weight: 800;
    }
    .banner-value {
      font-size: 18px;
      font-weight: 800;
      margin-top: 2px;
    }

    /* Filters block (compact chips like “Applied Filters”) */
    .filters {
      margin: 14px 2px 14px;
    }
    .filters h2 {
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: #475569;
      margin: 0 0 8px 0;
    }
    .filters .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      padding: 6px 12px;
      border-radius: 999px;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      color: #3730a3;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    /* Table (roomy, sticky header like score table) */
    .table-wrap {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      box-shadow: 0 12px 26px rgba(15, 23, 42, 0.06);
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead th {
      position: sticky;
      top: 0;
      background: #34a4eb;
      color: #ecfdf5;
      padding: 12px 10px;
      font-size: 12px;
      letter-spacing: .08em;
      text-transform: uppercase;
      text-align: left;
      font-weight: 800;
    }
    tbody td {
      padding: 12px 10px;
      font-size: 14px;
      color: #0f172a;
      border-bottom: 1px solid #eef2f7;
      vertical-align: top;
    }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr:hover { background: #eff6ff; }

    .col-id { width: 36px; color:#64748b; }
    .col-date { width: 110px; }
    .col-account { width: 120px; }
    .col-category { width: 120px; }
    .col-counterparty { width: 120px; }
    .col-type { width: 86px; }
    .col-amt, .col-bal { width: 110px; white-space: nowrap; }

    .amount { text-align: right; font-weight: 800; }
    .amount.credit { color: #0f766e; }
    .amount.debit { color: #b91c1c; }
    .amount.balance { color: #0f172a; }

    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .04em;
    }
    .badge.credit { background: #d1fae5; color: #065f46; }
    .badge.debit  { background: #fee2e2; color: #7f1d1d; }

    .text-muted { color: #64748b; font-size: 12px; }
    .empty {
      text-align: center;
      padding: 42px;
      font-size: 14px;
      font-weight: 700;
      color: #475569;
    }

    footer {
      margin-top: 18px;
      font-size: 12px;
      color: #64748b;
      text-align: center;
    }

    /* Print */
    @page { margin-top: 14mm; margin-bottom: 14mm; margin-left: 8mm; margin-right: 8mm; }
    @media print {
      .page { padding: 0; }
      .hero { box-shadow: none; }
      .kpi, .table-wrap { box-shadow: none; }
      thead th { box-shadow: inset 0 -1px 0 #0b1220; }
    }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <div>
        <h1 class="hero-title">${escapeHtml(title)}</h1>
        ${
          accountName
            ? `<div class="hero-sub">Account: ${escapeHtml(accountName)}</div>`
            : ""
        }
      </div>
      <div class="hero-meta">
        <div>Generated: ${escapeHtml(generatedAt)}</div>
        <div>Total in report: ${escapeHtml(String(transactions.length))}${
    totalCount > transactions.length
      ? ` of ${escapeHtml(String(totalCount))} records`
      : ""
  }</div>
      </div>
    </section>

    ${summaryCards}

    ${filtersSection.replace(
      '<div class="filters">',
      '<div class="filters"><h2>Applied Filters</h2>'
    )}

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
          <th>#</th>
          <th>Date</th>
          <th>Account</th>
          <th>Category</th>
          <th>Counterparty</th>
          <th>Type</th>
          <th>Description</th>
          <th>Amount</th>
          ${showBalanceColumn ? "<th>Balance</th>" : ""}
        </tr>
      </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    <footer>Generated by Cash Book — ${escapeHtml(generatedAt)}</footer>
    <p style="margin: 20px 0 0; text-align: center; color: #666; font-size: 12px;">
  Develop By • 
  <a href="https://www.linkedin.com/in/alamgir8" target="_blank" style="color: #0a66c2; text-decoration: none;">
    🔗 Alamgir Hossain
  </a>
  &nbsp;|&nbsp;
  <a href="https://github.com/alamgir8" target="_blank" style="color: #333; text-decoration: none;">
    🐱 GitHub
  </a>
  &nbsp;|&nbsp;
  <a href="https://themeforest.net/user/themereaact" target="_blank" style="color: #10b981; text-decoration: none;">
    🌿 ThemeForest
  </a>
</p>
  </div>
</body>
</html>
  `;
};

export const exportTransactionsPdf = async (
  rawFilters: RawFilters = {}
): Promise<string> => {
  const { filters, display } = parseFilters(rawFilters);

  let accountName: string | undefined;
  let currencySymbol: string | undefined;

  if (filters.accountId) {
    try {
      const detail = await fetchAccountDetail(filters.accountId);
      accountName = detail.account?.name;
      currencySymbol = detail.account?.currency_symbol;
      display.accountName = accountName ?? display.accountName;
    } catch (error) {
      console.warn("Failed to load account detail for report:", error);
    }
  }

  const { transactions, total } = await collectTransactions(filters);

  if (!display.accountName && !filters.accountId) {
    const accountNames = Array.from(
      new Set(
        transactions
          .map((txn) => txn.account?.name?.trim())
          .filter((name): name is string => Boolean(name))
      )
    );
    if (accountNames.length > 0) {
      display.accounts = accountNames;
    }
  }

  if (!display.categoryNames || display.categoryNames.length === 0) {
    const categoryNames = Array.from(
      new Set(
        transactions
          .map((txn) => txn.category?.name?.trim())
          .filter((name): name is string => Boolean(name))
      )
    );
    if (categoryNames.length > 0) {
      display.categoryNames = categoryNames;
    }
  }

  const totals = computeTotals(transactions);
  const generatedAt = dayjs().format("MMM D, YYYY h:mm A");

  const html = buildReportHtml({
    transactions,
    totals,
    generatedAt,
    accountName,
    currencySymbol,
    displayFilters: display,
    totalCount: total,
    showBalanceColumn:
      !filters.financialScope || filters.financialScope === "actual",
  });

  const { uri } = await Print.printToFileAsync({ html });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri);
  }

  return uri;
};

// ============ GROUPED EXPORTS ============

type GroupedData = {
  name: string;
  transactions: Transaction[];
  totals: Totals;
};

const buildGroupedReportHtml = ({
  groups,
  grandTotals,
  generatedAt,
  currencySymbol,
  groupByLabel,
  totalTransactions,
}: {
  groups: GroupedData[];
  grandTotals: Totals;
  generatedAt: string;
  currencySymbol?: string;
  groupByLabel: string;
  totalTransactions: number;
}): string => {
  const title = `Transactions by ${groupByLabel}`;

  const groupSections = groups
    .map((group) => {
      const rows = group.transactions
        .map((txn, index) => {
          const dateLabel = txn.date
            ? dayjs(txn.date).format("MMM D, YYYY")
            : "—";
          const accountLabel = txn.account?.name ?? "—";
          const categoryLabel = txn.category?.name ?? "Uncategorized";
          const counterpartyLabel = txn.counterparty?.trim() || "—";
          const typeBadgeClass =
            txn.type === "credit" ? "badge positive" : "badge negative";
          const amountClass =
            txn.type === "credit" ? "amount positive" : "amount negative";
          const description = txn.description?.trim() || "";
          const keyword = txn.keyword?.trim() || "";
          const descriptionCell = [description, keyword]
            .filter(Boolean)
            .join(" · ");

          return `
            <tr>
              <td class="col-idx">${index + 1}</td>
              <td class="col-date">${escapeHtml(dateLabel)}</td>
              <td class="col-account">${escapeHtml(accountLabel)}</td>
              <td class="col-category">${escapeHtml(categoryLabel)}</td>
              <td class="col-counterparty">${escapeHtml(counterpartyLabel)}</td>
              <td class="col-type"><span class="${typeBadgeClass}">${escapeHtml(
            capitalize(txn.type) ?? txn.type
          )}</span></td>
              <td class="col-desc">${escapeHtml(descriptionCell)}</td>
              <td class="${amountClass} col-amt">${escapeHtml(
            formatAmount(txn.amount, currencySymbol)
          )}</td>
            </tr>
          `;
        })
        .join("");

      const groupBannerClass =
        group.totals.net >= 0
          ? "group-banner positive"
          : "group-banner negative";

      return `
        <div class="group-section">
          <div class="group-header">
            <h3>${escapeHtml(group.name)}</h3>
            <div class="group-stats">
              <span class="stat credit">Credit: ${escapeHtml(
                formatAmount(group.totals.credit, currencySymbol)
              )}</span>
              <span class="stat debit">Debit: ${escapeHtml(
                formatAmount(group.totals.debit, currencySymbol)
              )}</span>
              <span class="${groupBannerClass}">Net: ${escapeHtml(
        formatAmount(group.totals.net, currencySymbol)
      )}</span>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Category</th>
                  <th>Counterparty</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
          <div class="group-count">${group.transactions.length} transaction${
        group.transactions.length === 1 ? "" : "s"
      }</div>
        </div>
      `;
    })
    .join("");

  const bannerClass =
    grandTotals.net >= 0 ? "banner positive" : "banner negative";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans";
      color: #0f172a;
      background: #f6f7fb;
      -webkit-font-smoothing: antialiased;
    }

    .page { padding: 8px; min-height: 100%; }

    .hero {
      background: #34a4eb;
      color: #ecfdf5;
      border-radius: 6px;
      padding: 18px;
      box-shadow: 0 10px 28px rgba(4, 120, 87, 0.22);
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
    }
    .hero-title { margin: 0; font-weight: 800; font-size: 20px; }
    .hero-sub { margin-top: 4px; color: #d1fae5; font-size: 12px; }
    .hero-meta { text-align: right; font-size: 12px; color: #bbf7d0; }

    .kpis { margin: 16px 2px 14px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 12px; }
    .kpi {
      grid-column: span 4;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 14px 16px;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
    }
    .kpi-label { font-size: 16px; text-transform: uppercase; letter-spacing: .08em; color: #1f2937; font-weight: 800; }
    .kpi-value { margin-top: 8px; font-size: 22px; font-weight: 800; color: #0f172a; }
    .kpi-value.positive { color: #0f766e; }
    .kpi-value.negative { color: #b91c1c; }

    .banner {
      display: flex;
      align-items: center;
      gap: 12px;
      border-radius: 12px;
      padding: 12px 14px;
      margin-top: 12px;
      border: 1px solid;
    }
    .banner.positive { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
    .banner.negative { background: #fef2f2; border-color: #fecaca; color: #7f1d1d; }
    .banner-icon { font-size: 16px; }
    .banner-title { font-size: 14px; text-transform: uppercase; letter-spacing: .08em; font-weight: 800; }
    .banner-value { font-size: 18px; font-weight: 800; margin-top: 2px; }

    .group-section {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      margin-bottom: 16px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
    }
    .group-header {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 14px 16px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .group-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: #1e293b; }
    .group-stats { display: flex; gap: 12px; flex-wrap: wrap; }
    .group-stats .stat { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px; }
    .group-stats .stat.credit { background: #ecfdf5; color: #065f46; }
    .group-stats .stat.debit { background: #fef2f2; color: #991b1b; }
    .group-banner { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 6px; }
    .group-banner.positive { background: #d1fae5; color: #065f46; }
    .group-banner.negative { background: #fecaca; color: #991b1b; }
    .group-count { padding: 10px 16px; background: #f8fafc; font-size: 12px; color: #64748b; text-align: right; border-top: 1px solid #e5e7eb; }

    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead { background: #f1f5f9; }
    th { padding: 10px 8px; text-align: left; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; color: #334155; }
    tr:hover td { background: #f8fafc; }

    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .badge.positive { background: #d1fae5; color: #065f46; }
    .badge.negative { background: #fee2e2; color: #991b1b; }
    .amount { font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .amount.positive { color: #047857; }
    .amount.negative { color: #dc2626; }

    footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 24px; padding-bottom: 16px; }
  </style>
</head>
<body>
  <div class="page">
    <header class="hero">
      <div>
        <h1 class="hero-title">${escapeHtml(title)}</h1>
        <div class="hero-sub">${escapeHtml(
          String(totalTransactions)
        )} transactions in ${escapeHtml(
    String(groups.length)
  )} ${groupByLabel.toLowerCase()}${groups.length === 1 ? "" : "s"}</div>
      </div>
      <div class="hero-meta">
        <div>Generated</div>
        <div>${escapeHtml(generatedAt)}</div>
      </div>
    </header>

    <section class="kpis">
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-label">Total Transactions</div>
          <div class="kpi-value">${escapeHtml(String(totalTransactions))}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Total Credit</div>
          <div class="kpi-value positive">${escapeHtml(
            formatAmount(grandTotals.credit, currencySymbol)
          )}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Total Debit</div>
          <div class="kpi-value negative">${escapeHtml(
            formatAmount(grandTotals.debit, currencySymbol)
          )}</div>
        </div>
      </div>
      <div class="${bannerClass}">
        <div class="banner-icon">🏷️</div>
        <div class="banner-text">
          <div class="banner-title">Net Position</div>
          <div class="banner-value">${escapeHtml(
            formatAmount(grandTotals.net, currencySymbol)
          )}</div>
        </div>
      </div>
    </section>

    ${groupSections}

    <footer>Generated by Cash Book — ${escapeHtml(generatedAt)}</footer>
    <p style="margin: 20px 0 0; text-align: center; color: #666; font-size: 12px;">
      Developed By • 
      <a href="https://www.linkedin.com/in/alamgir8" target="_blank" style="color: #0a66c2; text-decoration: none;">
        🔗 Alamgir Hossain
      </a>
      &nbsp;|&nbsp;
      <a href="https://github.com/alamgir8" target="_blank" style="color: #333; text-decoration: none;">
        🐱 GitHub
      </a>
      &nbsp;|&nbsp;
      <a href="https://themeforest.net/user/themereaact" target="_blank" style="color: #10b981; text-decoration: none;">
        🌿 ThemeForest
      </a>
    </p>
  </div>
</body>
</html>
  `;
};

export const exportTransactionsByCategoryPdf = async (): Promise<string> => {
  const { transactions } = await collectTransactions({});
  const generatedAt = dayjs().format("MMM D, YYYY h:mm A");

  // Group by category
  const groupMap = new Map<string, Transaction[]>();
  transactions.forEach((txn) => {
    const categoryName = txn.category?.name?.trim() || "Uncategorized";
    if (!groupMap.has(categoryName)) {
      groupMap.set(categoryName, []);
    }
    groupMap.get(categoryName)!.push(txn);
  });

  const groups: GroupedData[] = Array.from(groupMap.entries())
    .map(([name, txns]) => ({
      name,
      transactions: txns,
      totals: computeTotals(txns),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const grandTotals = computeTotals(transactions);

  const html = buildGroupedReportHtml({
    groups,
    grandTotals,
    generatedAt,
    groupByLabel: "Category",
    totalTransactions: transactions.length,
  });

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri);
  }
  return uri;
};

export const exportTransactionsByCounterpartyPdf =
  async (): Promise<string> => {
    const { transactions } = await collectTransactions({});
    const generatedAt = dayjs().format("MMM D, YYYY h:mm A");

    // Group by counterparty
    const groupMap = new Map<string, Transaction[]>();
    transactions.forEach((txn) => {
      const counterparty = txn.counterparty?.trim() || "No Counterparty";
      if (!groupMap.has(counterparty)) {
        groupMap.set(counterparty, []);
      }
      groupMap.get(counterparty)!.push(txn);
    });

    const groups: GroupedData[] = Array.from(groupMap.entries())
      .map(([name, txns]) => ({
        name,
        transactions: txns,
        totals: computeTotals(txns),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const grandTotals = computeTotals(transactions);

    const html = buildGroupedReportHtml({
      groups,
      grandTotals,
      generatedAt,
      groupByLabel: "Counterparty",
      totalTransactions: transactions.length,
    });

    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
    return uri;
  };

export const exportTransactionsByAccountPdf = async (): Promise<string> => {
  const { transactions } = await collectTransactions({});
  const generatedAt = dayjs().format("MMM D, YYYY h:mm A");

  // Group by account
  const groupMap = new Map<string, Transaction[]>();
  transactions.forEach((txn) => {
    const accountName = txn.account?.name?.trim() || "Unknown Account";
    if (!groupMap.has(accountName)) {
      groupMap.set(accountName, []);
    }
    groupMap.get(accountName)!.push(txn);
  });

  const groups: GroupedData[] = Array.from(groupMap.entries())
    .map(([name, txns]) => ({
      name,
      transactions: txns,
      totals: computeTotals(txns),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const grandTotals = computeTotals(transactions);

  const html = buildGroupedReportHtml({
    groups,
    grandTotals,
    generatedAt,
    groupByLabel: "Account",
    totalTransactions: transactions.length,
  });

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri);
  }
  return uri;
};
