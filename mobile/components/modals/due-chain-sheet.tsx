/**
 * DueChainSheet
 *
 * Two modes:
 *  1. COUNTERPARTY LEDGER — for loan-type transactions (no payment_status, has
 *     counterparty). Shows ALL borrows + repayments with running balance.
 *  2. SINGLE DUE CHAIN — for due/payment transactions. Shows payment progress
 *     bar and partial payment timeline.
 */
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useTheme } from "@/hooks/use-theme";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import {
  fetchDueChain,
  fetchCounterpartyLedger,
  type Transaction,
} from "@/services/transactions";

type Props = {
  visible: boolean;
  onClose: () => void;
  transaction: Transaction; // any transaction in the chain
};

export const DueChainSheet = ({ visible, onClose, transaction }: Props) => {
  const { colors } = useTheme();
  const { formatAmount } = usePreferences();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Use counterparty ledger ONLY for loan-category transactions.
  // The backend's counterparty-ledger endpoint only queries loan_in/loan_out
  // categories — so calling it for a vendor due (expense category with
  // counterparty tagged) returns 0 results and shows "Fully Settled / 0".
  //
  // Discriminator: category type. Loan categories have type "loan_in" or
  // "loan_out". Everything else (vendor dues, general expenses, etc.) should
  // use the single due-chain view.
  //
  // NOTE: We cannot use payment_status === "due" as the discriminator because
  // the migration script also sets payment_status: "due" on Loan Received /
  // Loan Given transactions — those must still use counterparty ledger mode.
  const isLoanCategory =
    transaction.category?.type === "loan_in" ||
    transaction.category?.type === "loan_out";
  const useCounterpartyMode = !!transaction.counterparty && isLoanCategory;
  const counterparty = transaction.counterparty ?? "";

  // PDF export state
  const [exportingPdf, setExportingPdf] = React.useState(false);

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      if (!ledger && !chain) {
        Alert.alert(t("nothingToExport"), t("loadDataFirst"));
        return;
      }

      // ── Colour palette (mirrors the in-app theme) ──────────────────────────
      const C = {
        borrow: {
          bg: "#eff6ff",
          border: "#bfdbfe",
          text: "#1d4ed8",
          dot: "#3b82f6",
        },
        repayment: {
          bg: "#f0fdf4",
          border: "#bbf7d0",
          text: "#15803d",
          dot: "#16a34a",
        },
        loan_given: {
          bg: "#fffbeb",
          border: "#fde68a",
          text: "#b45309",
          dot: "#f59e0b",
        },
        loan_received_back: {
          bg: "#f0fdfa",
          border: "#99f6e4",
          text: "#0f766e",
          dot: "#0d9488",
        },
        due: {
          bg: "#fff7ed",
          border: "#fed7aa",
          text: "#c2410c",
          dot: "#f97316",
        },
        payment: {
          bg: "#f0fdf4",
          border: "#bbf7d0",
          text: "#15803d",
          dot: "#16a34a",
        },
        final: {
          bg: "#f0fdf4",
          border: "#86efac",
          text: "#15803d",
          dot: "#16a34a",
        },
      } as Record<
        string,
        { bg: string; border: string; text: string; dot: string }
      >;

      const labelMap: Record<string, string> = {
        borrow: "Borrowed",
        repayment: "Repaid",
        loan_given: "Loan Given",
        loan_received_back: "Returned",
      };

      const fmt = (n: number) => "৳" + Number(n).toLocaleString("en");

      let title = "";
      let subtitle = "";
      let statsHtml = "";
      let statusHtml = "";
      let rowsHtml = "";
      let finalBalanceHtml = "";

      // ── COUNTERPARTY LEDGER MODE ─────────────────────────────────────────
      if (useCounterpartyMode && ledger) {
        const s = ledger.summary;
        title = `${counterparty} — Full Ledger`;
        subtitle = `${s.transaction_count} transactions`;

        // Stats bar
        const stats = [
          s.total_borrowed > 0
            ? {
                label: "Total Borrowed",
                value: fmt(s.total_borrowed),
                color: "#3b82f6",
              }
            : null,
          s.total_repaid > 0
            ? {
                label: "I Repaid",
                value: fmt(s.total_repaid),
                color: "#16a34a",
              }
            : null,
          s.total_given > 0
            ? {
                label: "Total Given",
                value: fmt(s.total_given),
                color: "#f59e0b",
              }
            : null,
          s.total_received_back > 0
            ? {
                label: "Returned to Me",
                value: fmt(s.total_received_back),
                color: "#0d9488",
              }
            : null,
        ].filter(Boolean) as { label: string; value: string; color: string }[];

        statsHtml = `<div class="stats-bar">${stats
          .map(
            (st) => `
          <div class="stat-box" style="border-top: 3px solid ${st.color}">
            <div class="stat-label">${st.label}</div>
            <div class="stat-value" style="color:${st.color}">${st.value}</div>
          </div>`,
          )
          .join("")}</div>`;

        // Status chip
        const isSettled = s.is_settled;
        const netAbs = Math.abs(s.net_owed_by_me);
        const statusColor = isSettled
          ? "#16a34a"
          : s.net_owed_by_me > 0
            ? "#dc2626"
            : "#d97706";
        const statusBg = isSettled
          ? "#f0fdf4"
          : s.net_owed_by_me > 0
            ? "#fef2f2"
            : "#fffbeb";
        const statusLabel = isSettled
          ? "✅ Fully Settled"
          : s.net_owed_by_me > 0
            ? "⏳ I Owe Them"
            : "⏳ They Owe Me";
        statusHtml = `
          <div class="status-chip" style="background:${statusBg};border-color:${statusColor}40">
            <span style="color:${statusColor};font-weight:700;font-size:13px">${statusLabel}</span>
            <span style="color:${statusColor};font-weight:800;font-size:16px;margin-left:auto">${fmt(netAbs)}</span>
          </div>`;

        // Timeline rows (newest first from backend, reverse to oldest-first for PDF)
        const chronological = [...ledger.timeline].reverse();
        rowsHtml = chronological
          .map((e) => {
            const cfg = C[e.entry_type] ?? C.borrow;
            const bal = e.running_balance;
            const balLabel =
              bal === 0
                ? "✓ Clear"
                : bal > 0
                  ? `${fmt(bal)} they owe`
                  : `${fmt(Math.abs(bal))} I owe`;
            const balColor =
              bal === 0 ? "#16a34a" : bal > 0 ? "#d97706" : "#dc2626";
            return `
            <tr class="entry-row" style="background:${cfg.bg}">
              <td class="td-date">${dayjs(e.date).format("DD MMM YYYY")}</td>
              <td class="td-type">
                <span class="type-chip" style="background:${cfg.dot}20;color:${cfg.text};border:1px solid ${cfg.border}">
                  ${labelMap[e.entry_type] ?? e.entry_type}
                </span>
              </td>
              <td class="td-note">${e.description ?? "<span style='color:#9ca3af'>—</span>"}</td>
              <td class="td-amount" style="color:${cfg.text}">${fmt(e.amount)}</td>
              <td class="td-balance" style="color:${balColor};font-weight:600">${balLabel}</td>
            </tr>`;
          })
          .join("");

        // Final balance row
        const fb = ledger.summary;
        const fbBal = fb.owed_by_them - fb.owed_by_me;
        const fbColor =
          fbBal === 0 ? "#16a34a" : fbBal > 0 ? "#d97706" : "#dc2626";
        const fbLabel =
          fbBal === 0
            ? "✓ Fully Settled"
            : fbBal > 0
              ? `${fmt(fbBal)} — They owe you`
              : `${fmt(Math.abs(fbBal))} — You owe them`;
        finalBalanceHtml = `
          <tr class="final-row">
            <td colspan="4" style="font-weight:700;font-size:13px;color:#111">Closing Balance</td>
            <td style="font-weight:800;font-size:14px;color:${fbColor};text-align:right">${fbLabel}</td>
          </tr>`;

        // ── SINGLE DUE CHAIN MODE ────────────────────────────────────────────
      } else if (chain) {
        const s = chain.summary;
        const rootName =
          chain.root.vendor ??
          chain.root.counterparty ??
          chain.root.description ??
          "Due Transaction";
        title = `Payment History`;
        subtitle = rootName;
        const pct = Math.round(
          Math.min(100, (s.total_paid / s.original_amount) * 100),
        );
        const isSettled = s.is_settled;
        const paidColor = "#0d9488";
        const paidStrongColor = "#059669";
        const paidLightBg = "#ecfdf5";
        const paidBorder = "#99f6e4";

        statsHtml = `<div class="stats-bar">
          <div class="stat-box" style="border-top:3px solid #f97316">
            <div class="stat-label">Original Due</div>
            <div class="stat-value" style="color:#f97316">${fmt(s.original_amount)}</div>
          </div>
          <div class="stat-box" style="border-top:3px solid ${paidColor}">
            <div class="stat-label">Total Paid</div>
            <div class="stat-value" style="color:${paidStrongColor}">${fmt(s.total_paid)}</div>
          </div>
          <div class="stat-box" style="border-top:3px solid ${paidColor}">
            <div class="stat-label">Remaining</div>
            <div class="stat-value" style="color:${paidStrongColor}">${fmt(s.remaining)}</div>
          </div>
          <div class="stat-box" style="border-top:3px solid ${paidColor}">
            <div class="stat-label">Progress</div>
            <div class="stat-value" style="color:${paidStrongColor}">${pct}%</div>
          </div>
        </div>
        <div class="progress-wrap">
          <div class="progress-bar" style="width:${pct}%;background:linear-gradient(90deg, #0d9488, #10b981)"></div>
        </div>`;

        statusHtml = `
          <div class="status-chip" style="background:${paidLightBg};border-color:${paidBorder}">
            <span style="color:${paidStrongColor};font-weight:700;font-size:13px">
              ${isSettled ? "✅ Fully Settled" : "⏳ Not Yet Fully Paid"}
            </span>
            ${s.settled_at ? `<span style="color:${paidColor};font-size:11px;margin-left:8px">Settled on ${dayjs(s.settled_at).format("DD MMM YYYY")}</span>` : ""}
          </div>`;

        // Due row
        const dueRow = `
          <tr class="entry-row" style="background:${C.due.bg}">
            <td class="td-date">${dayjs(chain.root.date).format("DD MMM YYYY")}</td>
            <td class="td-type"><span class="type-chip" style="background:${C.due.dot}20;color:${C.due.text};border:1px solid ${C.due.border}">Original Due</span></td>
            <td class="td-note">${chain.root.description ?? "<span style='color:#9ca3af'>—</span>"}</td>
            <td class="td-amount" style="color:${C.due.text}">${fmt(chain.root.amount)}</td>
            <td class="td-balance" style="color:${C.due.text};font-weight:600">${fmt(chain.root.amount)} left</td>
          </tr>`;

        const payRows = chain.payments
          .map((p, i) => {
            const isFinal = p.remaining_after === 0;
            const cfg = isFinal ? C.final : C.payment;
            return `
            <tr class="entry-row" style="background:${cfg.bg}">
              <td class="td-date">${dayjs(p.date).format("DD MMM YYYY")}</td>
              <td class="td-type"><span class="type-chip" style="background:${cfg.dot}20;color:${cfg.text};border:1px solid ${cfg.border}">${isFinal ? `Final Payment (#${i + 1})` : `Partial #${i + 1}`}</span></td>
              <td class="td-note">${p.description ?? "<span style='color:#9ca3af'>—</span>"}</td>
              <td class="td-amount" style="color:${cfg.text}">${fmt(p.amount)}</td>
              <td class="td-balance" style="color:${paidStrongColor};font-weight:600">${isFinal ? "✓ Fully paid" : `${fmt(p.remaining_after)} left`}</td>
            </tr>`;
          })
          .join("");

        rowsHtml = dueRow + payRows;

        finalBalanceHtml = `
          <tr class="final-row">
            <td colspan="4" style="font-weight:700;font-size:13px;color:#111">Closing Balance</td>
            <td style="font-weight:800;font-size:14px;color:${paidStrongColor};text-align:right">
              ${isSettled ? "✓ Fully Settled" : `${fmt(s.remaining)} remaining`}
            </td>
          </tr>`;
      }

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: #f8fafc; color: #111; padding: 28px; }

    /* ── Header ── */
    .header { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #e2e8f0; }
    .header h1 { font-size: 22px; font-weight: 800; color: #0f172a; }
    .header .subtitle { font-size: 13px; color: #64748b; margin-top: 3px; }
    .header .exported { font-size: 11px; color: #94a3b8; margin-top: 6px; }

    /* ── Stats bar ── */
    .stats-bar { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
    .stat-box { flex: 1; min-width: 100px; background: #fff; border-radius: 10px; padding: 10px 14px; border: 1px solid #e2e8f0; }
    .stat-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .stat-value { font-size: 15px; font-weight: 800; }

    /* ── Progress bar (chain mode only) ── */
    .progress-wrap { height: 8px; background: #e2e8f0; border-radius: 99px; overflow: hidden; margin-bottom: 14px; }
    .progress-bar  { height: 8px; border-radius: 99px; }

    /* ── Status chip ── */
    .status-chip { display: flex; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 16px; margin-bottom: 18px; }

    /* ── Table ── */
    .table-wrap { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    thead tr { background: #1e293b; }
    thead th { color: #e2e8f0; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; padding: 10px 12px; text-align: left; }
    .entry-row td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .entry-row:last-of-type td { border-bottom: 2px solid #cbd5e1; }

    /* ── Column widths ── */
    .td-date    { width: 90px; font-size: 11px; color: #94a3b8; white-space: nowrap; font-weight: 500; }
    .td-type    { width: 120px; }
    .td-note    { color: #334155; }
    .td-amount  { width: 80px; font-weight: 700; text-align: right; white-space: nowrap; }
    .td-balance { width: 130px; text-align: right; font-size: 11.5px; white-space: nowrap; }

    /* ── Type chip ── */
    .type-chip { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10.5px; font-weight: 600; white-space: nowrap; }

    /* ── Final / closing row ── */
    .final-row { background: #1e293b; }
    .final-row td { padding: 11px 12px; color: #e2e8f0; font-size: 12px; }

    /* ── Footer ── */
    .footer { margin-top: 28px; padding: 22px 0 10px; border-top: 2px solid #111827; text-align: center; color: #64748b; }
    .footer-generated { font-size: 12px; font-weight: 600; color: #94a3b8; margin-bottom: 26px; }
    .footer-dev { font-size: 14px; color: #525252; }
    .footer-dev a { color: #0284c7; text-decoration: none; font-weight: 600; }
    .footer-dev .theme { color: #10b981; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="subtitle">${subtitle}</div>
    <div class="exported">Exported on ${dayjs().format("DD MMM YYYY, hh:mm A")}</div>
  </div>

  ${statsHtml}
  ${statusHtml}

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="td-date">Date</th>
          <th class="td-type">Type</th>
          <th>Note / Description</th>
          <th class="td-amount" style="text-align:right">Amount</th>
          <th class="td-balance" style="text-align:right">Running Balance</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        ${finalBalanceHtml}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <div class="footer-generated">Generated by Cash Book — ${dayjs().format("MMMM DD, YYYY hh:mm A")}</div>
    <div class="footer-dev">
      Developed By • <a>🔗 Alamgir Hossain</a> &nbsp;|&nbsp; 🐱 GitHub &nbsp;|&nbsp; <span class="theme">🌿 ThemeForest</span>
    </div>
  </div>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: title,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("PDF saved", uri);
      }
    } catch (e: any) {
      Alert.alert(t("exportFailed"), e?.message ?? "Unknown error");
    } finally {
      setExportingPdf(false);
    }
  };

  const ledgerQuery = useQuery({
    queryKey: ["counterparty-ledger", counterparty],
    queryFn: () => fetchCounterpartyLedger(counterparty),
    enabled: visible && useCounterpartyMode,
  });

  const chainQuery = useQuery({
    queryKey: ["due-chain", transaction._id],
    queryFn: () => fetchDueChain(transaction._id),
    enabled: visible && !useCounterpartyMode,
  });

  const isLoading = useCounterpartyMode
    ? ledgerQuery.isLoading
    : chainQuery.isLoading;
  const isError = useCounterpartyMode
    ? ledgerQuery.isError
    : chainQuery.isError;
  const ledger = ledgerQuery.data;
  const chain = chainQuery.data;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        }}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          className="rounded-t-3xl"
          style={{ backgroundColor: colors.bg.primary, maxHeight: "88%" }}
        >
          {/* Header */}
          <View
            className="flex-row justify-between items-center px-6 pt-6 pb-4 border-b"
            style={{ borderColor: colors.border }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text
                className="text-lg font-bold"
                style={{ color: colors.text.primary }}
              >
                {useCounterpartyMode
                  ? `${counterparty} — ${t("fullLedger")}`
                  : t("paymentHistory")}
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: colors.text.tertiary }}
              >
                {useCounterpartyMode
                  ? `${t("allTransactionsWith")} ${counterparty}`
                  : transaction.vendor
                    ? `${t("vendorLabel2")} ${transaction.vendor}`
                    : transaction.counterparty
                      ? `${t("forLabel2")} ${transaction.counterparty}`
                      : t("dueTransactionChain")}
              </Text>
            </View>
            {/* PDF export button */}
            {(ledger || chain) && (
              <TouchableOpacity
                onPress={handleExportPdf}
                disabled={exportingPdf}
                className="w-8 h-8 rounded-full items-center justify-center mr-2"
                style={{ backgroundColor: colors.bg.tertiary }}
              >
                {exportingPdf ? (
                  <ActivityIndicator size="small" color={colors.info} />
                ) : (
                  <Ionicons
                    name="share-outline"
                    size={17}
                    color={colors.text.secondary}
                  />
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.bg.tertiary }}
            >
              <Ionicons name="close" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {isLoading && (
            <View className="py-12 items-center">
              <ActivityIndicator color={colors.info} />
              <Text
                className="text-sm mt-3"
                style={{ color: colors.text.tertiary }}
              >
                {t("loading")}
              </Text>
            </View>
          )}

          {isError && (
            <View className="py-12 items-center px-6">
              <Ionicons name="warning-outline" size={32} color={colors.error} />
              <Text
                className="text-sm mt-2 text-center"
                style={{ color: colors.text.secondary }}
              >
                {t("couldNotLoad")}
              </Text>
            </View>
          )}

          {/* ─── COUNTERPARTY LEDGER MODE ────────────────────────────── */}
          {ledger && useCounterpartyMode && (
            <ScrollView
              className="px-6 py-4"
              contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            >
              {/* Summary cards */}
              {ledger.summary.total_given > 0 && (
                <View className="flex-row gap-3">
                  <SummaryCard
                    label={t("totalGiven")}
                    value={formatAmount(ledger.summary.total_given)}
                    color="#f59e0b"
                    colors={colors}
                  />
                  <SummaryCard
                    label={t("returnedToMe")}
                    value={formatAmount(ledger.summary.total_received_back)}
                    color="#0d9488"
                    colors={colors}
                  />
                </View>
              )}
              {ledger.summary.total_borrowed > 0 && (
                <View className="flex-row gap-3">
                  <SummaryCard
                    label={t("totalBorrowed")}
                    value={formatAmount(ledger.summary.total_borrowed)}
                    color="#3b82f6"
                    colors={colors}
                  />
                  <SummaryCard
                    label={t("iRepaid")}
                    value={formatAmount(ledger.summary.total_repaid)}
                    color="#16a34a"
                    colors={colors}
                  />
                </View>
              )}

              {/* Outstanding / Settled */}
              <View
                className="rounded-xl p-4"
                style={{
                  backgroundColor: ledger.summary.is_settled
                    ? "#16a34a15"
                    : ledger.summary.net_owed_by_me > 0
                      ? "#ef444415"
                      : "#f59e0b15",
                  borderWidth: 1,
                  borderColor: ledger.summary.is_settled
                    ? "#16a34a40"
                    : ledger.summary.net_owed_by_me > 0
                      ? "#ef444440"
                      : "#f59e0b40",
                }}
              >
                <View className="flex-row justify-between items-center">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {ledger.summary.is_settled
                      ? t("fullySettled")
                      : ledger.summary.net_owed_by_me > 0
                        ? t("iOweThem")
                        : t("theyOweMe")}
                  </Text>
                  <Text
                    className="text-base font-bold"
                    style={{
                      color: ledger.summary.is_settled
                        ? "#16a34a"
                        : ledger.summary.net_owed_by_me > 0
                          ? "#ef4444"
                          : "#f59e0b",
                    }}
                  >
                    {formatAmount(Math.abs(ledger.summary.net_owed_by_me))}
                  </Text>
                </View>
                {ledger.summary.owed_by_them > 0 &&
                  ledger.summary.owed_by_me > 0 && (
                    <>
                      <Text
                        className="text-xs mt-0.5"
                        style={{ color: "#ef4444" }}
                      >
                        {t("iOweThem2")}{" "}
                        {formatAmount(ledger.summary.owed_by_me)}
                      </Text>
                      <Text
                        className="text-xs mt-0.5"
                        style={{ color: "#f59e0b" }}
                      >
                        {t("theyOweThem2")}{" "}
                        {formatAmount(ledger.summary.owed_by_them)}
                      </Text>
                    </>
                  )}
                <Text
                  className="text-xs mt-1"
                  style={{ color: colors.text.tertiary }}
                >
                  {ledger.summary.transaction_count} {t("transactionsTotal")}
                </Text>
              </View>

              {/* Timeline */}
              <Text
                className="text-xs font-semibold uppercase tracking-wide mt-2"
                style={{ color: colors.text.tertiary }}
              >
                {t("fullTransactionHistory")}
              </Text>

              {ledger.timeline.map((entry, i) => (
                <LedgerRow
                  key={entry._id}
                  entryType={entry.entry_type}
                  date={entry.date}
                  description={entry.description}
                  amount={entry.amount}
                  runningBalance={entry.running_balance}
                  isLast={i === ledger.timeline.length - 1}
                  formatAmount={formatAmount}
                  colors={colors}
                  t={t}
                />
              ))}
            </ScrollView>
          )}

          {/* ─── SINGLE CHAIN MODE ───────────────────────────────────── */}
          {chain && !useCounterpartyMode && (
            <ScrollView
              className="px-6 py-4"
              contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            >
              {/* Progress bar */}
              <View
                className="rounded-xl p-4"
                style={{
                  backgroundColor: chain.summary.is_settled
                    ? "#16a34a15"
                    : "#d9770615",
                  borderWidth: 1,
                  borderColor: chain.summary.is_settled
                    ? "#16a34a40"
                    : "#d9770640",
                }}
              >
                <View className="flex-row justify-between mb-2">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {chain.summary.is_settled
                      ? t("fullySettled")
                      : chain.summary.payment_count === 0
                        ? t("notYetPaid")
                        : t("partiallyPaid")}
                  </Text>
                  <Text
                    className="text-sm font-bold"
                    style={{
                      color: chain.summary.is_settled ? "#16a34a" : "#d97706",
                    }}
                  >
                    {Math.round(
                      Math.min(
                        100,
                        (chain.summary.total_paid /
                          chain.summary.original_amount) *
                          100,
                      ),
                    )}
                    %
                  </Text>
                </View>
                <View
                  className="rounded-full overflow-hidden"
                  style={{ height: 8, backgroundColor: colors.bg.tertiary }}
                >
                  <View
                    className="rounded-full h-full"
                    style={{
                      width: `${Math.min(100, (chain.summary.total_paid / chain.summary.original_amount) * 100)}%`,
                      backgroundColor: chain.summary.is_settled
                        ? "#16a34a"
                        : "#d97706",
                    }}
                  />
                </View>
                <View className="flex-row justify-between mt-2">
                  <Text
                    className="text-xs"
                    style={{ color: colors.text.secondary }}
                  >
                    {t("paid2")} {formatAmount(chain.summary.total_paid)}
                  </Text>
                  <Text
                    className="text-xs"
                    style={{ color: colors.text.secondary }}
                  >
                    {t("remaining")} {formatAmount(chain.summary.remaining)}
                  </Text>
                </View>
                {chain.summary.settled_at && (
                  <Text className="text-xs mt-1" style={{ color: "#16a34a" }}>
                    {t("settledOn")}{" "}
                    {dayjs(chain.summary.settled_at).format("MMM DD, YYYY")}
                  </Text>
                )}
              </View>

              <Text
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: colors.text.tertiary }}
              >
                {t("transactionTimeline")}
              </Text>

              <TimelineRow
                icon="time-outline"
                iconBg="#d97706"
                label={t("originalDue")}
                date={chain.root.date}
                amount={chain.root.amount}
                note={chain.root.description}
                sub={`${t("remaining")} ${formatAmount(chain.root.amount)}`}
                isFirst
                formatAmount={formatAmount}
                colors={colors}
              />

              {chain.payments.map((p, i) => (
                <TimelineRow
                  key={p._id}
                  icon={
                    p.remaining_after === 0
                      ? "checkmark-circle"
                      : "cash-outline"
                  }
                  iconBg={p.remaining_after === 0 ? "#16a34a" : colors.info}
                  label={
                    p.remaining_after === 0
                      ? `${t("finalPayment")} (#${i + 1})`
                      : `${t("partialPayment")} (#${i + 1})`
                  }
                  date={p.date}
                  amount={p.amount}
                  note={p.description}
                  sub={`${t("afterThis")} ${formatAmount(p.remaining_after)} ${t("left")}`}
                  isLast={i === chain.payments.length - 1}
                  formatAmount={formatAmount}
                  colors={colors}
                />
              ))}

              {chain.payments.length === 0 && (
                <View
                  className="rounded-xl p-4 items-center"
                  style={{
                    backgroundColor: colors.bg.secondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    className="text-sm"
                    style={{ color: colors.text.tertiary }}
                  >
                    {t("noPaymentsYet")}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          <View style={{ paddingBottom: Math.max(insets.bottom, 12) }} />
        </View>
      </View>
    </Modal>
  );
};

// ─── Ledger row (counterparty mode) ────────────────────────────────────────

type LedgerEntryType =
  | "borrow"
  | "repayment"
  | "loan_given"
  | "loan_received_back";

const ledgerEntryConfig: Record<
  LedgerEntryType,
  { color: string; icon: string; label: string; sign: string }
> = {
  borrow: {
    color: "#3b82f6",
    icon: "arrow-down-outline",
    label: "Borrowed",
    sign: "+",
  },
  repayment: {
    color: "#16a34a",
    icon: "arrow-up-outline",
    label: "Repaid",
    sign: "-",
  },
  loan_given: {
    color: "#f59e0b",
    icon: "arrow-up-outline",
    label: "Loan Given",
    sign: "-",
  },
  loan_received_back: {
    color: "#0d9488",
    icon: "arrow-down-outline",
    label: "Returned",
    sign: "+",
  },
};

type LedgerRowProps = {
  entryType: LedgerEntryType;
  date: string;
  description?: string;
  amount: number;
  runningBalance: number;
  isLast: boolean;
  formatAmount: (n: number) => string;
  colors: any;
  t: (key: any) => string;
};

const LedgerRow = ({
  entryType,
  date,
  description,
  amount,
  runningBalance,
  isLast,
  formatAmount,
  colors,
  t,
}: LedgerRowProps) => {
  const cfg = ledgerEntryConfig[entryType] ?? ledgerEntryConfig.borrow;
  const labelMap: Record<LedgerEntryType, string> = {
    borrow: t("borrowed"),
    repayment: t("repaid"),
    loan_given: t("loanGiven"),
    loan_received_back: t("returned"),
  };
  const label = labelMap[entryType] ?? cfg.label;
  return (
    <View className="flex-row gap-3">
      <View className="items-center" style={{ width: 32 }}>
        <View
          className="w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: cfg.color }}
        >
          <Ionicons name={cfg.icon as any} size={15} color="white" />
        </View>
        {!isLast && (
          <View
            style={{
              flex: 1,
              width: 2,
              backgroundColor: colors.border,
              marginTop: 2,
              minHeight: 20,
            }}
          />
        )}
      </View>

      <View
        className="flex-1 rounded-xl p-3 mb-2"
        style={{
          backgroundColor: colors.bg.secondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View className="flex-row justify-between items-start">
          <Text className="text-xs font-semibold" style={{ color: cfg.color }}>
            {label}
          </Text>
          <Text className="text-sm font-bold" style={{ color: cfg.color }}>
            {cfg.sign}
            {formatAmount(amount)}
          </Text>
        </View>
        {!!description && (
          <Text
            className="text-xs mt-0.5"
            style={{ color: colors.text.primary }}
            numberOfLines={2}
          >
            {description}
          </Text>
        )}
        <View className="flex-row justify-between mt-1">
          <Text className="text-xs" style={{ color: colors.text.tertiary }}>
            {dayjs(date).format("MMM DD, YYYY")}
          </Text>
          <Text
            className="text-xs font-medium"
            style={{
              color:
                runningBalance < 0
                  ? "#ef4444"
                  : runningBalance > 0
                    ? "#f59e0b"
                    : "#16a34a",
            }}
          >
            {t("balance2")}{" "}
            {runningBalance === 0
              ? t("fullyPaid")
              : `${formatAmount(Math.abs(runningBalance))}${runningBalance < 0 ? ` ${t("youOwe")}` : ` ${t("theyOwe")}`}`}
          </Text>
        </View>
      </View>
    </View>
  );
};

// ─── Timeline row (single chain mode) ──────────────────────────────────────

type RowProps = {
  icon: any;
  iconBg: string;
  label: string;
  date: string;
  amount: number;
  note?: string;
  sub?: string;
  isFirst?: boolean;
  isLast?: boolean;
  formatAmount: (n: number) => string;
  colors: any;
};

const TimelineRow = ({
  icon,
  iconBg,
  label,
  date,
  amount,
  note,
  sub,
  isFirst,
  isLast,
  formatAmount,
  colors,
}: RowProps) => (
  <View className="flex-row gap-3">
    <View className="items-center" style={{ width: 32 }}>
      <View
        className="w-8 h-8 rounded-full items-center justify-center"
        style={{ backgroundColor: iconBg }}
      >
        <Ionicons name={icon} size={16} color="white" />
      </View>
      {!isLast && (
        <View
          style={{
            flex: 1,
            width: 2,
            backgroundColor: colors.border,
            marginTop: 2,
            minHeight: 20,
          }}
        />
      )}
    </View>

    <View
      className="flex-1 rounded-xl p-3 mb-2"
      style={{
        backgroundColor: colors.bg.secondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row justify-between items-start">
        <Text
          className="text-sm font-semibold"
          style={{ color: colors.text.primary }}
        >
          {label}
        </Text>
        <Text
          className="text-sm font-bold"
          style={{ color: isFirst ? "#d97706" : "#16a34a" }}
        >
          {formatAmount(amount)}
        </Text>
      </View>
      <Text className="text-xs mt-0.5" style={{ color: colors.text.tertiary }}>
        {dayjs(date).format("MMM DD, YYYY")}
        {note ? ` · ${note}` : ""}
      </Text>
      {sub && (
        <Text className="text-xs mt-1" style={{ color: colors.text.secondary }}>
          {sub}
        </Text>
      )}
    </View>
  </View>
);

// ─── Summary card ────────────────────────────────────────────────────────────

const SummaryCard = ({
  label,
  value,
  color,
  colors,
}: {
  label: string;
  value: string;
  color: string;
  colors: any;
}) => (
  <View
    className="flex-1 rounded-xl p-3"
    style={{
      backgroundColor: color + "15",
      borderWidth: 1,
      borderColor: color + "40",
    }}
  >
    <Text className="text-xs" style={{ color: colors.text.tertiary }}>
      {label}
    </Text>
    <Text className="text-sm font-bold mt-0.5" style={{ color }}>
      {value}
    </Text>
  </View>
);
