/**
 * Shared HTML/CSS for Vendor / Counterparty / Loan / Payment history PDFs.
 * Matches the polished full-transaction export in services/reports.ts.
 */

import dayjs from "dayjs";

/** Accent palette — same family as full transaction export. */
export const HistoryPdfColors = {
  credit: "#0f766e",
  creditSoft: "#d1fae5",
  creditText: "#065f46",
  debit: "#be123c",
  debitSoft: "#ffe4e6",
  debitText: "#881337",
  sky: "#0284c7",
  skySoft: "#e0f2fe",
  skyText: "#0369a1",
  amber: "#b45309",
  amberSoft: "#fef3c7",
  amberText: "#92400e",
  ink: "#0f172a",
  muted: "#64748b",
} as const;

export type HistoryPdfKpi = {
  label: string;
  value: string;
  /** CSS color for the value */
  tone?: "credit" | "debit" | "sky" | "amber" | "ink";
};

export type HistoryPdfBanner = {
  label: string;
  value: string;
  tone: "credit" | "debit" | "sky" | "amber";
};

export type HistoryPdfRow = {
  date: string;
  typeLabel: string;
  typeTone: "credit" | "debit" | "sky" | "amber";
  note?: string | null;
  amount: string;
  amountTone: "credit" | "debit" | "sky" | "amber" | "ink";
  balance: string;
  balanceTone: "credit" | "debit" | "sky" | "amber" | "ink";
};

export type HistoryPdfClosing = {
  label: string;
  value: string;
  tone: "credit" | "debit" | "sky" | "amber" | "ink";
};

export type BuildHistoryPdfHtmlArgs = {
  title: string;
  subtitle?: string;
  metaRight?: string;
  kpis: HistoryPdfKpi[];
  banner?: HistoryPdfBanner | null;
  progressPct?: number | null;
  rows: HistoryPdfRow[];
  closing?: HistoryPdfClosing | null;
};

const escapeHtml = (value: string | number): string =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toneColor = (
  tone: HistoryPdfKpi["tone"] | HistoryPdfRow["amountTone"],
) => {
  switch (tone) {
    case "credit":
      return HistoryPdfColors.credit;
    case "debit":
      return HistoryPdfColors.debit;
    case "sky":
      return HistoryPdfColors.sky;
    case "amber":
      return HistoryPdfColors.amber;
    default:
      return HistoryPdfColors.ink;
  }
};

const badgeCss = (tone: HistoryPdfRow["typeTone"]) => {
  switch (tone) {
    case "credit":
      return `background:${HistoryPdfColors.creditSoft};color:${HistoryPdfColors.creditText}`;
    case "debit":
      return `background:${HistoryPdfColors.debitSoft};color:${HistoryPdfColors.debitText}`;
    case "sky":
      return `background:${HistoryPdfColors.skySoft};color:${HistoryPdfColors.skyText}`;
    case "amber":
      return `background:${HistoryPdfColors.amberSoft};color:${HistoryPdfColors.amberText}`;
  }
};

const bannerClass = (tone: HistoryPdfBanner["tone"]) => {
  if (tone === "credit") return "banner positive";
  if (tone === "debit") return "banner negative";
  if (tone === "sky") return "banner sky";
  return "banner amber";
};

/**
 * Build a full HTML document for history ledger PDFs.
 */
export function buildHistoryPdfHtml(args: BuildHistoryPdfHtmlArgs): string {
  const generatedAt = dayjs().format("MMM D, YYYY h:mm A");
  const title = escapeHtml(args.title);
  const subtitle = args.subtitle ? escapeHtml(args.subtitle) : "";
  const metaRight = args.metaRight
    ? escapeHtml(args.metaRight)
    : `${args.rows.length} rows`;

  const kpiSpan = args.kpis.length <= 2 ? 6 : args.kpis.length === 3 ? 4 : 3;

  const kpisHtml = args.kpis
    .map((k) => {
      const color = toneColor(k.tone ?? "ink");
      return `
        <div class="kpi" style="grid-column: span ${kpiSpan}">
          <div class="kpi-label">${escapeHtml(k.label)}</div>
          <div class="kpi-value" style="color:${color}">${escapeHtml(k.value)}</div>
        </div>`;
    })
    .join("");

  const bannerHtml = args.banner
    ? `
      <div class="${bannerClass(args.banner.tone)}">
        <div class="banner-icon">${args.banner.tone === "credit" ? "✅" : "⏳"}</div>
        <div style="flex:1">
          <div class="banner-title">${escapeHtml(args.banner.label)}</div>
        </div>
        <div class="banner-value">${escapeHtml(args.banner.value)}</div>
      </div>`
    : "";

  const progressHtml =
    args.progressPct != null
      ? `
      <div class="progress-wrap">
        <div class="progress-bar" style="width:${Math.max(0, Math.min(100, args.progressPct))}%"></div>
      </div>`
      : "";

  const rowsHtml = args.rows
    .map((r, i) => {
      const note = r.note?.trim()
        ? escapeHtml(r.note.trim())
        : `<span class="text-muted">—</span>`;
      return `
        <tr class="${i % 2 === 1 ? "alt" : ""}">
          <td class="td-date">${escapeHtml(r.date)}</td>
          <td class="td-type"><span class="badge" style="${badgeCss(r.typeTone)}">${escapeHtml(r.typeLabel)}</span></td>
          <td class="td-note">${note}</td>
          <td class="td-amount" style="color:${toneColor(r.amountTone)}">${escapeHtml(r.amount)}</td>
          <td class="td-balance" style="color:${toneColor(r.balanceTone)}">${escapeHtml(r.balance)}</td>
        </tr>`;
    })
    .join("");

  const closingHtml = args.closing
    ? `
        <tr class="closing">
          <td colspan="4">${escapeHtml(args.closing.label)}</td>
          <td class="td-balance" style="color:${toneColor(args.closing.tone)}">${escapeHtml(args.closing.value)}</td>
        </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
      color: #0f172a;
      background: #f6f7fb;
      -webkit-font-smoothing: antialiased;
    }
    .page { padding: 12px 18px; min-height: 100%; }

    .hero {
      background: #fff;
      color: #0f172a;
      border-radius: 0;
      padding: 8px 8px 16px;
      margin-bottom: 18px;
      border-bottom: 2px solid #e2e8f0;
      box-shadow: none;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .hero-title {
      margin: 0;
      font-weight: 800;
      letter-spacing: .2px;
      font-size: 22px;
      line-height: 1.25;
      color: #0f172a;
    }
    .hero-sub {
      margin-top: 4px;
      color: #374151;
      font-size: 13px;
      font-weight: 500;
    }
    .hero-meta {
      text-align: right;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
      white-space: nowrap;
    }

    .kpis { margin: 0 0 14px; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 12px;
    }
    .kpi {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 14px 16px;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
    }
    .kpi-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: #64748b;
      font-weight: 800;
    }
    .kpi-value {
      margin-top: 8px;
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      word-break: break-word;
    }

    .banner {
      display: flex;
      align-items: center;
      gap: 12px;
      border-radius: 12px;
      padding: 12px 14px;
      margin: 0 0 14px;
      border: 1px solid;
    }
    .banner.positive { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
    .banner.negative { background: #fff1f2; border-color: #fecdd3; color: #881337; }
    .banner.sky { background: #f0f9ff; border-color: #bae6fd; color: #0369a1; }
    .banner.amber { background: #fffbeb; border-color: #fde68a; color: #92400e; }
    .banner-icon { font-size: 16px; }
    .banner-title {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: .06em;
      font-weight: 800;
    }
    .banner-value { font-size: 18px; font-weight: 800; }

    .progress-wrap {
      height: 10px;
      background: #e2e8f0;
      border-radius: 99px;
      overflow: hidden;
      margin: 0 0 14px;
    }
    .progress-bar {
      height: 100%;
      border-radius: 99px;
      background: linear-gradient(90deg, #0f766e, #14b8a6);
    }

    .table-wrap {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 13px;
    }
    thead th {
      background: #f8fafc;
      color: #0f172a;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .06em;
      padding: 12px 10px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    tbody td {
      padding: 12px 10px;
      border-bottom: 1px solid #eef2f7;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    tbody tr.alt td { background: #f8fafc; }
    tbody tr:hover td { background: #eff6ff; }

    /* Widths apply to th + td; body styles scoped to td so headers stay uniform */
    .td-date { width: 16%; }
    .td-type { width: 18%; }
    .td-note { width: 34%; }
    .td-amount { width: 14%; text-align: right; white-space: nowrap; }
    .td-balance { width: 18%; text-align: right; }
    td.td-date { color: #0f172a; font-weight: 600; white-space: nowrap; }
    td.td-note { color: #1e293b; font-weight: 500; }
    td.td-amount { font-weight: 800; }
    td.td-balance { font-weight: 700; }

    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .03em;
      max-width: 100%;
      white-space: normal;
      line-height: 1.3;
    }

    .closing td {
      background: #f1f5f9;
      border-bottom: none;
      padding: 14px 10px;
      font-weight: 800;
      font-size: 13px;
      color: #0f172a;
    }

    .text-muted { color: #94a3b8; }

    footer {
      margin-top: 18px;
      font-size: 12px;
      color: #64748b;
      text-align: center;
    }
    .dev {
      margin: 16px 0 0;
      text-align: center;
      color: #666;
      font-size: 12px;
      line-height: 1.6;
    }
    .dev a { text-decoration: none; font-weight: 700; }
    .dev .linkedin { color: #0a66c2; }
    .dev .github { color: #333; }
    .dev .theme { color: #0d9488; }

    @page { margin-top: 14mm; margin-bottom: 14mm; margin-left: 10mm; margin-right: 10mm; }
    @media print {
      .page { padding: 0 6px; }
      .hero, .kpi, .table-wrap { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <div>
        <h1 class="hero-title">${title}</h1>
        ${subtitle ? `<div class="hero-sub">${subtitle}</div>` : ""}
      </div>
      <div class="hero-meta">
        <div>Generated: ${escapeHtml(generatedAt)}</div>
        <div>${metaRight}</div>
      </div>
    </section>

    <section class="kpis">
      <div class="kpi-grid">${kpisHtml}</div>
    </section>

    ${bannerHtml}
    ${progressHtml}

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="td-date">Date</th>
            <th class="td-type">Type</th>
            <th class="td-note">Note / Description</th>
            <th class="td-amount" style="text-align:right">Amount</th>
            <th class="td-balance" style="text-align:right">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="5" style="text-align:center;padding:32px;color:#64748b;font-weight:700">No transactions</td></tr>`}
          ${closingHtml}
        </tbody>
      </table>
    </div>

    <footer>Generated by Cash Book — ${escapeHtml(generatedAt)}</footer>
    <p class="dev">
      Develop By •
      <a class="linkedin" href="https://www.linkedin.com/in/alamgir8" target="_blank">🔗 Alamgir Hossain</a>
      &nbsp;|&nbsp;
      <a class="github" href="https://github.com/alamgir8" target="_blank">🐱 GitHub</a>
      &nbsp;|&nbsp;
      <a class="theme" href="https://themeforest.net/user/htmllover" target="_blank">🌿 ThemeForest</a>
    </p>
  </div>
</body>
</html>`;
}

export function formatHistoryAmount(n: number, withSign = false): string {
  const abs = Math.abs(Number(n) || 0);
  const formatted = "৳" + abs.toLocaleString("en");
  if (!withSign) return formatted;
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
}
