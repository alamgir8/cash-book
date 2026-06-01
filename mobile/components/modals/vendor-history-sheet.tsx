/**
 * VendorHistorySheet
 *
 * Shows a full ledger of ALL transactions (any category) for a given
 * party or counterparty — similar to the loan DueChainSheet counterparty mode
 * but works for every vendor, not just loan transactions.
 *
 * Displays:
 *   - Total Credit / Total Debit summary cards
 *   - Net balance chip (positive = you are owed, negative = you owe)
 *   - Timeline with running balance per entry (newest-first)
 *   - PDF export
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
import {
  fetchVendorLedger,
  type Transaction,
  type VendorLedger,
} from "@/services/transactions";

type Props = {
  visible: boolean;
  onClose: () => void;
  transaction: Transaction;
};

export const VendorHistorySheet = ({
  visible,
  onClose,
  transaction,
}: Props) => {
  const { colors } = useTheme();
  const { formatAmount } = usePreferences();
  const insets = useSafeAreaInsets();
  const [exportingPdf, setExportingPdf] = React.useState(false);

  const partyId =
    transaction.party && typeof transaction.party === "object"
      ? transaction.party._id
      : typeof transaction.party === "string"
        ? transaction.party
        : undefined;
  const counterparty = transaction.counterparty ?? undefined;

  // Display name: prefer party name, then for_party name, then counterparty string
  const vendorName =
    (typeof transaction.party === "object"
      ? transaction.party?.name
      : undefined) ??
    (typeof transaction.for_party === "object"
      ? transaction.for_party?.name
      : undefined) ??
    transaction.counterparty ??
    "";

  // Only loan_in / loan_out / due transactions show directional "they owe / you owe" language
  const isLoanContext =
    transaction.category?.type === "loan_in" ||
    transaction.category?.type === "loan_out" ||
    transaction.payment_status === "due";

  const ledgerQuery = useQuery({
    queryKey: ["vendor-ledger", partyId, counterparty],
    queryFn: () => fetchVendorLedger({ partyId, counterparty }),
    enabled: visible && !!(partyId || counterparty),
  });

  const ledger = ledgerQuery.data;
  const isLoading = ledgerQuery.isLoading;
  const isError = ledgerQuery.isError;

  // ── PDF Export ───────────────────────────────────────────────────────────
  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      if (!ledger) {
        Alert.alert("Nothing to export", "Please wait for data to load.");
        return;
      }

      const fmt = (n: number) => "৳" + Number(n).toLocaleString("en");
      const s = ledger.summary;
      const title = `${vendorName || ledger.party_name} — Full Ledger`;
      const subtitle = `All transactions with ${vendorName || ledger.party_name}`;

      const net = s.net_balance;
      const netLabel = isLoanContext
        ? net === 0
          ? "Settled"
          : net > 0
            ? "They Owe You"
            : "You Owe Them"
        : net === 0
          ? "Balanced"
          : net > 0
            ? "Net Received"
            : "Net Spent";
      const netColor = net === 0 ? "#16a34a" : net > 0 ? "#f59e0b" : "#dc2626";

      const statsHtml = `<div class="stats-bar">
        <div class="stat-box" style="border-top:3px solid #16a34a">
          <div class="stat-label">Total Credit (In)</div>
          <div class="stat-value" style="color:#16a34a">${fmt(s.total_credit)}</div>
        </div>
        <div class="stat-box" style="border-top:3px solid #dc2626">
          <div class="stat-label">Total Debit (Out)</div>
          <div class="stat-value" style="color:#dc2626">${fmt(s.total_debit)}</div>
        </div>
      </div>`;

      const statusHtml = isLoanContext
        ? `
        <div class="status-chip" style="background:${netColor}10;border-color:${netColor}40">
          <span style="color:${netColor};font-weight:700;font-size:13px">${netLabel}</span>
          <span style="color:${netColor};font-weight:800;font-size:16px;margin-left:auto">${fmt(Math.abs(net))}</span>
        </div>
        <div class="tx-count">${s.transaction_count} transactions total</div>`
        : `<div class="tx-count">${s.transaction_count} transactions total</div>`;

      const chronological = [...ledger.timeline].reverse();
      const rowsHtml = chronological
        .map((e) => {
          const isCredit = e.entry_type === "credit";
          const amtColor = isCredit ? "#16a34a" : "#dc2626";
          const sign = isCredit ? "+" : "-";
          const bal = e.running_balance;
          const balColor =
            bal === 0 ? "#16a34a" : bal > 0 ? "#f59e0b" : "#dc2626";
          const balLabel = isLoanContext
            ? bal === 0
              ? "✓ Clear"
              : bal > 0
                ? `${fmt(bal)} owed to you`
                : `${fmt(Math.abs(bal))} you owe`
            : `${fmt(Math.abs(bal))}`;
          const catName =
            (e as any).category?.name ?? (e as any).category_id?.name ?? "";
          return `
            <tr class="entry-row" style="background:${isCredit ? "#f0fdf4" : "#fef2f2"}">
              <td class="td-date">${dayjs(e.date).format("DD MMM YYYY")}</td>
              <td class="td-type">
                <span class="type-chip" style="background:${amtColor}20;color:${amtColor}">
                  ${isCredit ? "Credit" : "Debit"}${catName ? ` · ${catName}` : ""}
                </span>
              </td>
              <td class="td-note">${e.description ?? "<span style='color:#9ca3af'>—</span>"}</td>
              <td class="td-amount" style="color:${amtColor}">${sign}${fmt(e.amount)}</td>
              <td class="td-balance" style="color:${balColor};font-weight:600">${balLabel}</td>
            </tr>`;
        })
        .join("");

      const finalBal = ledger.summary.net_balance;
      const fbColor =
        finalBal === 0 ? "#16a34a" : finalBal > 0 ? "#f59e0b" : "#dc2626";
      const fbLabel = isLoanContext
        ? finalBal === 0
          ? "✓ Fully Settled"
          : finalBal > 0
            ? `${fmt(finalBal)} — Owed to you`
            : `${fmt(Math.abs(finalBal))} — You owe`
        : `Net: ${fmt(Math.abs(finalBal))}`;

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: #f8fafc; color: #111; padding: 28px; }
    .header { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #cbd5e1; }
    .header h1 { font-size: 22px; font-weight: 800; color: #0f172a; }
    .header .subtitle { font-size: 13px; color: #374151; margin-top: 3px; font-weight: 500; }
    .header .exported { font-size: 12px; color: #374151; margin-top: 6px; }
    .stats-bar { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
    .stat-box { flex: 1; min-width: 100px; background: #fff; border-radius: 10px; padding: 10px 14px; border: 1px solid #cbd5e1; }
    .stat-label { font-size: 10px; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; font-weight: 600; }
    .stat-value { font-size: 15px; font-weight: 800; }
    .status-chip { display: flex; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 16px; margin-bottom: 8px; }
    .tx-count { font-size: 11px; color: #64748b; margin-bottom: 18px; }
    .table-wrap { background: #fff; border-radius: 12px; border: 1px solid #cbd5e1; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    thead tr { background: #0f172a; }
    thead th { color: #f1f5f9; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; padding: 11px 12px; text-align: left; }
    .entry-row td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    .entry-row:last-of-type td { border-bottom: 2px solid #94a3b8; }
    .td-date { width: 90px; font-size: 11.5px; color: #1e293b; white-space: nowrap; font-weight: 600; }
    .td-type { width: 130px; }
    .td-note { color: #1e293b; font-weight: 500; }
    .td-amount { width: 80px; font-weight: 700; text-align: right; white-space: nowrap; }
    .td-balance { width: 140px; text-align: right; font-size: 11.5px; white-space: nowrap; font-weight: 600; }
    .type-chip { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10.5px; font-weight: 600; white-space: nowrap; }
    .final-row { background: #0f172a; }
    .final-row td { padding: 12px; color: #f1f5f9; font-size: 13px; font-weight: 700; }
    .footer { margin-top: 32px; padding: 22px 0 10px; border-top: 2px solid #374151; text-align: center; }
    .footer-generated { font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 10px; }
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
        <tr class="final-row">
          <td colspan="4" style="font-weight:700;font-size:13px;color:#f1f5f9">Closing Balance</td>
          <td style="font-weight:800;font-size:14px;color:${fbColor};text-align:right">${fbLabel}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="footer">
    <div class="footer-generated">Generated by Cash Book — ${dayjs().format("MMMM DD, YYYY hh:mm A")}</div>
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
      Alert.alert("Export failed", e?.message ?? "Unknown error");
    } finally {
      setExportingPdf(false);
    }
  };

  const displayName = vendorName || ledger?.party_name || "";

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
          style={{ backgroundColor: colors.bg.primary, maxHeight: "90%" }}
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
                {displayName ? `${displayName} — Full Ledger` : "Vendor Ledger"}
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: colors.text.tertiary }}
              >
                {`All transactions with ${displayName || "this vendor"}`}
              </Text>
            </View>
            {ledger && (
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
                Loading...
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
                Could not load ledger data
              </Text>
            </View>
          )}

          {ledger && (
            <ScrollView
              className="px-6 py-4"
              contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            >
              {/* Summary cards: credit / debit */}
              <View className="flex-row gap-3">
                <SummaryCard
                  label="Total Credit (In)"
                  value={formatAmount(ledger.summary.total_credit)}
                  color="#16a34a"
                  colors={colors}
                />
                <SummaryCard
                  label="Total Debit (Out)"
                  value={formatAmount(ledger.summary.total_debit)}
                  color="#dc2626"
                  colors={colors}
                />
              </View>

              {/* Net balance chip — only for loan/due contexts */}
              {isLoanContext ? (
                <NetBalanceChip
                  netBalance={ledger.summary.net_balance}
                  transactionCount={ledger.summary.transaction_count}
                  formatAmount={formatAmount}
                  colors={colors}
                />
              ) : (
                <Text
                  className="text-xs"
                  style={{ color: colors.text.tertiary }}
                >
                  {`${ledger.summary.transaction_count} transactions total`}
                </Text>
              )}

              {/* Timeline header */}
              <Text
                className="text-xs font-semibold uppercase tracking-wide mt-2"
                style={{ color: colors.text.tertiary }}
              >
                FULL TRANSACTION HISTORY
              </Text>

              {ledger.timeline.length === 0 && (
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
                    No transactions found
                  </Text>
                </View>
              )}

              {ledger.timeline.map((entry, i) => (
                <VendorLedgerRow
                  key={entry._id}
                  entryType={entry.entry_type}
                  date={entry.date}
                  description={entry.description}
                  amount={entry.amount}
                  runningBalance={entry.running_balance}
                  categoryName={
                    (entry as any).category?.name ??
                    (entry as any).category_id?.name
                  }
                  accountName={entry.account?.name}
                  isLast={i === ledger.timeline.length - 1}
                  showOweBalance={isLoanContext}
                  formatAmount={formatAmount}
                  colors={colors}
                />
              ))}
            </ScrollView>
          )}

          <View style={{ paddingBottom: Math.max(insets.bottom, 12) }} />
        </View>
      </View>
    </Modal>
  );
};

// ─── Net balance chip ─────────────────────────────────────────────────────────

const NetBalanceChip = ({
  netBalance,
  transactionCount,
  formatAmount,
  colors,
}: {
  netBalance: number;
  transactionCount: number;
  formatAmount: (n: number) => string;
  colors: any;
}) => {
  const isSettled = netBalance === 0;
  const youAreOwed = netBalance > 0;
  const color = isSettled ? "#16a34a" : youAreOwed ? "#f59e0b" : "#dc2626";
  const label = isSettled
    ? "Settled"
    : youAreOwed
      ? "They Owe You"
      : "You Owe Them";
  const icon = isSettled
    ? "checkmark-circle-outline"
    : youAreOwed
      ? "trending-up-outline"
      : "trending-down-outline";

  return (
    <View
      className="rounded-xl p-4"
      style={{
        backgroundColor: color + "15",
        borderWidth: 1,
        borderColor: color + "40",
      }}
    >
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center gap-2">
          <Ionicons name={icon as any} size={18} color={color} />
          <Text className="text-sm font-semibold" style={{ color }}>
            {label}
          </Text>
        </View>
        <Text className="text-base font-bold" style={{ color }}>
          {formatAmount(Math.abs(netBalance))}
        </Text>
      </View>
      <Text className="text-xs mt-1" style={{ color: colors.text.tertiary }}>
        {`${transactionCount} transactions total`}
      </Text>
    </View>
  );
};

// ─── Vendor ledger row ────────────────────────────────────────────────────────

type VendorLedgerRowProps = {
  entryType: "credit" | "debit";
  date: string;
  description?: string;
  amount: number;
  runningBalance: number;
  categoryName?: string;
  accountName?: string;
  isLast: boolean;
  showOweBalance?: boolean;
  formatAmount: (n: number) => string;
  colors: any;
};

const VendorLedgerRow = ({
  entryType,
  date,
  description,
  amount,
  runningBalance,
  categoryName,
  accountName,
  isLast,
  showOweBalance = false,
  formatAmount,
  colors,
}: VendorLedgerRowProps) => {
  const isCredit = entryType === "credit";
  const color = isCredit ? "#16a34a" : "#dc2626";
  const icon = isCredit ? "arrow-down-outline" : "arrow-up-outline";
  const sign = isCredit ? "+" : "-";
  const label = isCredit ? "Credit" : "Debit";

  const balColor =
    runningBalance === 0
      ? "#16a34a"
      : runningBalance > 0
        ? "#f59e0b"
        : "#dc2626";
  const balLabel = showOweBalance
    ? runningBalance === 0
      ? "Clear"
      : runningBalance > 0
        ? `${formatAmount(Math.abs(runningBalance))} they owe`
        : `${formatAmount(Math.abs(runningBalance))} you owe`
    : formatAmount(Math.abs(runningBalance));

  return (
    <View className="flex-row gap-3">
      <View className="items-center" style={{ width: 32 }}>
        <View
          className="w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: color }}
        >
          <Ionicons name={icon as any} size={15} color="white" />
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
          <View className="flex-1 mr-2">
            <Text className="text-xs font-semibold" style={{ color }}>
              {`${label}${categoryName ? ` · ${categoryName}` : ""}`}
            </Text>
            {!!description && (
              <Text
                className="text-xs mt-0.5"
                style={{ color: colors.text.primary }}
                numberOfLines={2}
              >
                {description}
              </Text>
            )}
          </View>
          <Text className="text-sm font-bold" style={{ color }}>
            {`${sign}${formatAmount(amount)}`}
          </Text>
        </View>
        <View className="flex-row justify-between mt-1.5">
          <Text className="text-xs" style={{ color: colors.text.tertiary }}>
            {`${dayjs(date).format("MMM DD, YYYY")}${accountName ? ` · ${accountName}` : ""}`}
          </Text>
          <Text className="text-xs font-medium" style={{ color: balColor }}>
            {`Balance: ${balLabel}`}
          </Text>
        </View>
      </View>
    </View>
  );
};

// ─── Summary card ─────────────────────────────────────────────────────────────

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
