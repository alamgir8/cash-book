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
import { useActiveOrgId } from "@/hooks/use-organization";
import {
  fetchDueChain,
  fetchCounterpartyLedger,
  type Transaction,
} from "@/services/transactions";
import { navigateToLedgerDay } from "@/lib/navigate-ledger-day";

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
  const organizationId = useActiveOrgId();

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
  const partyId = transaction.party
    ? typeof transaction.party === "object"
      ? transaction.party._id
      : transaction.party
    : undefined;
  const forPartyId = transaction.for_party
    ? typeof transaction.for_party === "object"
      ? transaction.for_party._id
      : transaction.for_party
    : undefined;

  const vendorName =
    typeof transaction.party === "object"
      ? transaction.party?.name?.trim()
      : undefined;
  const forName =
    typeof transaction.for_party === "object"
      ? transaction.for_party?.name?.trim()
      : undefined;

  // Pair-scoped history when both Vendor + For are set (matches card chips).
  // Otherwise fall back to the "other" person only — never query "self" alone.
  // loan_out (given): borrower = for_party (fallback party)
  // loan_in (received): lender = party (fallback for_party)
  const hasPair = !!(partyId && forPartyId);
  const otherPartyId = hasPair
    ? undefined
    : transaction.category?.type === "loan_out"
      ? forPartyId || partyId
      : partyId || forPartyId;

  const useCounterpartyMode =
    !!(hasPair || otherPartyId || transaction.counterparty) && isLoanCategory;
  const rawCp = transaction.counterparty?.trim() || "";
  const counterparty =
    !hasPair &&
    !otherPartyId &&
    rawCp &&
    rawCp.toLowerCase() !== "transfer"
      ? rawCp
      : "";

  // Display: pair name when both sides exist, else the other party alone.
  const partyDisplayName = hasPair
    ? [vendorName, forName].filter(Boolean).join(" ↔ ") ||
      vendorName ||
      forName ||
      ""
    : transaction.category?.type === "loan_out"
      ? (forName ??
        vendorName ??
        counterparty ??
        "")
      : (vendorName ??
        forName ??
        counterparty ??
        "");

  const ledgerScopeSubtitle = hasPair
    ? t("loanHistoryBetweenParties")
    : `${t("allTransactionsWith")} ${partyDisplayName}`;

  // PDF export state
  const [exportingPdf, setExportingPdf] = React.useState(false);

  const openDayOnLedger = React.useCallback(
    (date: string) => {
      if (!navigateToLedgerDay(date)) return;
      onClose();
    },
    [onClose],
  );

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      if (!ledger && !chain) {
        Alert.alert(t("nothingToExport"), t("loadDataFirst"));
        return;
      }

      const { buildHistoryPdfHtml, formatHistoryAmount } = await import(
        "@/lib/history-pdf"
      );
      type Tone = "credit" | "debit" | "sky" | "amber";

      let title = "";
      let subtitle = "";
      let metaRight = "";
      let kpis: {
        label: string;
        value: string;
        tone?: Tone | "ink";
      }[] = [];
      let banner: {
        label: string;
        value: string;
        tone: Tone;
      } | null = null;
      let progressPct: number | null = null;
      let rows: {
        date: string;
        typeLabel: string;
        typeTone: Tone;
        note?: string | null;
        amount: string;
        amountTone: Tone | "ink";
        balance: string;
        balanceTone: Tone | "ink";
      }[] = [];
      let closing: {
        label: string;
        value: string;
        tone: Tone | "ink";
      } | null = null;

      // ── COUNTERPARTY LEDGER MODE ─────────────────────────────────────────
      if (useCounterpartyMode && ledger) {
        const s = ledger.summary;
        title = `${partyDisplayName} — Full Ledger`;
        subtitle = hasPair
          ? `${s.transaction_count} loan transactions between these parties`
          : `${s.transaction_count} transactions (Me ↔ ${partyDisplayName})`;
        metaRight = `${s.transaction_count} transactions`;

        if (s.total_borrowed > 0) {
          kpis.push({
            label: "Total Borrowed",
            value: formatHistoryAmount(s.total_borrowed),
            tone: "sky",
          });
        }
        if (s.total_repaid > 0) {
          kpis.push({
            label: "I Repaid",
            value: formatHistoryAmount(s.total_repaid),
            tone: "credit",
          });
        }
        if (s.total_given > 0) {
          kpis.push({
            label: "Total Given",
            value: formatHistoryAmount(s.total_given),
            tone: "amber",
          });
        }
        if (s.total_received_back > 0) {
          kpis.push({
            label: "Returned to Me",
            value: formatHistoryAmount(s.total_received_back),
            tone: "credit",
          });
        }
        if (kpis.length === 0) {
          kpis = [
            {
              label: "Transactions",
              value: String(s.transaction_count),
              tone: "ink",
            },
          ];
        }

        const netAbs = Math.abs(s.net_owed_by_me);
        const paidTotal = s.total_repaid + s.total_received_back;
        const settledVolume =
          paidTotal > 0 ? paidTotal : s.total_borrowed + s.total_given;
        banner = {
          label: s.is_settled
            ? paidTotal > 0
              ? "Fully Settled · Total paid"
              : "Fully Settled"
            : s.net_owed_by_me > 0
              ? "I Owe Them"
              : "They Owe Me",
          value: formatHistoryAmount(s.is_settled ? settledVolume : netAbs),
          tone: s.is_settled
            ? "credit"
            : s.net_owed_by_me > 0
              ? "debit"
              : "sky",
        };

        const labelMap: Record<string, string> = {
          borrow: "Borrowed",
          repayment: "Repaid",
          loan_given: "Loan Given",
          loan_received_back: "Returned",
        };
        const toneMap: Record<string, Tone> = {
          borrow: "sky",
          repayment: "credit",
          loan_given: "amber",
          loan_received_back: "credit",
        };

        const chronological = [...ledger.timeline].reverse();
        rows = chronological.map((e) => {
          const bal = e.running_balance;
          const typeTone = toneMap[e.entry_type] ?? "sky";
          return {
            date: dayjs(e.date).format("MMM D, YYYY"),
            typeLabel: labelMap[e.entry_type] ?? e.entry_type,
            typeTone,
            note: e.description,
            amount: formatHistoryAmount(e.amount),
            amountTone: typeTone,
            balance:
              bal === 0
                ? "✓ Clear"
                : bal > 0
                  ? `${formatHistoryAmount(bal)} they owe`
                  : `${formatHistoryAmount(Math.abs(bal))} I owe`,
            balanceTone:
              bal === 0 ? "credit" : bal > 0 ? "sky" : "debit",
          };
        });

        const fbBal = ledger.summary.owed_by_them - ledger.summary.owed_by_me;
        closing = {
          label: "Closing Balance",
          value:
            fbBal === 0
              ? "✓ Fully Settled"
              : fbBal > 0
                ? `${formatHistoryAmount(fbBal)} — They owe you`
                : `${formatHistoryAmount(Math.abs(fbBal))} — You owe them`,
          tone: fbBal === 0 ? "credit" : fbBal > 0 ? "sky" : "debit",
        };

        // ── SINGLE DUE CHAIN MODE ────────────────────────────────────────────
      } else if (chain) {
        const s = chain.summary;
        const rootName =
          chain.root.vendor ??
          chain.root.counterparty ??
          chain.root.description ??
          "Due Transaction";
        title = "Payment History";
        subtitle = `For: ${rootName}`;
        const pct = Math.round(
          Math.min(100, (s.total_paid / Math.max(s.original_amount, 1)) * 100),
        );
        progressPct = pct;
        metaRight = `${chain.payments.length + 1} timeline events`;

        kpis = [
          {
            label: "Original Due",
            value: formatHistoryAmount(s.original_amount),
            tone: "amber",
          },
          {
            label: "Total Paid",
            value: formatHistoryAmount(s.total_paid),
            tone: "credit",
          },
          {
            label: "Remaining",
            value: formatHistoryAmount(s.remaining),
            tone: s.remaining > 0 ? "sky" : "credit",
          },
          {
            label: "Progress",
            value: `${pct}%`,
            tone: "credit",
          },
        ];

        banner = {
          label: s.is_settled ? "Fully Settled" : "Not Yet Fully Paid",
          value: s.settled_at
            ? `Settled on ${dayjs(s.settled_at).format("MMM D, YYYY")}`
            : formatHistoryAmount(s.remaining),
          tone: s.is_settled ? "credit" : "amber",
        };

        rows = [
          {
            date: dayjs(chain.root.date).format("MMM D, YYYY"),
            typeLabel: "Original Due",
            typeTone: "amber",
            note: chain.root.description,
            amount: formatHistoryAmount(chain.root.amount),
            amountTone: "amber",
            balance: `${formatHistoryAmount(chain.root.amount)} left`,
            balanceTone: "amber",
          },
          ...chain.payments.map((p, i) => {
            const isFinal = p.remaining_after === 0;
            return {
              date: dayjs(p.date).format("MMM D, YYYY"),
              typeLabel: isFinal
                ? `Final Payment (#${i + 1})`
                : `Partial #${i + 1}`,
              typeTone: "credit" as const,
              note: p.description,
              amount: formatHistoryAmount(p.amount),
              amountTone: "credit" as const,
              balance: isFinal
                ? "✓ Fully paid"
                : `${formatHistoryAmount(p.remaining_after)} left`,
              balanceTone: "credit" as const,
            };
          }),
        ];

        closing = {
          label: "Closing Balance",
          value: s.is_settled
            ? "✓ Fully Settled"
            : `${formatHistoryAmount(s.remaining)} remaining`,
          tone: s.is_settled ? "credit" : "sky",
        };
      }

      const html = buildHistoryPdfHtml({
        title,
        subtitle,
        metaRight,
        kpis,
        banner,
        progressPct,
        rows,
        closing,
      });

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
    queryKey: [
      "counterparty-ledger",
      hasPair ? "pair" : "solo",
      hasPair ? partyId : otherPartyId,
      hasPair ? forPartyId : "",
      counterparty,
      organizationId ?? "personal",
      transaction.category?.type ?? "",
    ],
    queryFn: () =>
      fetchCounterpartyLedger({
        // Pair (Vendor + For) when both exist — matches card loan chips and
        // excludes third-party intermediary loans (e.g. Alamin↔Shahana must
        // not appear inside Alamgir↔Shahana history).
        partyId: hasPair ? partyId : otherPartyId,
        forPartyId: hasPair ? forPartyId : undefined,
        counterparty: counterparty || undefined,
        organizationId,
      }),
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
                {useCounterpartyMode
                  ? `${partyDisplayName} — ${t("fullLedger")}`
                  : t("paymentHistory")}
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: colors.text.tertiary }}
              >
                {useCounterpartyMode
                  ? ledgerScopeSubtitle
                  : transaction.vendor
                    ? `${t("vendorLabel2")} ${transaction.vendor}`
                    : partyDisplayName
                      ? `${t("forLabel2")} ${partyDisplayName}`
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
              {/* Summary cards — show whenever either side has volume */}
              {ledger.summary.total_given > 0 ||
              ledger.summary.total_received_back > 0 ? (
                ledger.summary.total_given > 0 ? (
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
                ) : (
                  <View className="flex-row">
                    <SummaryCard
                      label={t("totalPaidLabel")}
                      value={formatAmount(ledger.summary.total_received_back)}
                      color="#0d9488"
                      colors={colors}
                    />
                  </View>
                )
              ) : null}
              {ledger.summary.total_borrowed > 0 ||
              ledger.summary.total_repaid > 0 ? (
                ledger.summary.total_borrowed > 0 ? (
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
                ) : (
                  <View className="flex-row">
                    <SummaryCard
                      label={t("totalPaidLabel")}
                      value={formatAmount(ledger.summary.total_repaid)}
                      color="#16a34a"
                      colors={colors}
                    />
                  </View>
                )
              ) : null}

              {/* Outstanding / Settled */}
              <View
                className="rounded-xl p-4"
                style={{
                  backgroundColor: ledger.summary.is_settled
                    ? "#16a34a15"
                    : ledger.summary.net_owed_by_me > 0
                      ? "#fb718515"
                      : "#f59e0b15",
                  borderWidth: 1,
                  borderColor: ledger.summary.is_settled
                    ? "#16a34a40"
                    : ledger.summary.net_owed_by_me > 0
                      ? "#fb718540"
                      : "#f59e0b40",
                }}
              >
                {(() => {
                  const paidTotal =
                    ledger.summary.total_repaid +
                    ledger.summary.total_received_back;
                  const volumeTotal =
                    paidTotal > 0
                      ? paidTotal
                      : ledger.summary.total_borrowed +
                        ledger.summary.total_given;
                  return (
                    <>
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
                                ? "#fb7185"
                                : "#f59e0b",
                          }}
                        >
                          {ledger.summary.is_settled
                            ? formatAmount(volumeTotal)
                            : formatAmount(
                                Math.abs(ledger.summary.net_owed_by_me),
                              )}
                        </Text>
                      </View>
                      {ledger.summary.is_settled && paidTotal > 0 ? (
                        <Text
                          className="text-xs mt-0.5"
                          style={{ color: "#16a34a" }}
                        >
                          {t("totalPaidLabel")}
                        </Text>
                      ) : null}
                    </>
                  );
                })()}
                {ledger.summary.owed_by_them > 0 &&
                  ledger.summary.owed_by_me > 0 && (
                    <>
                      <Text
                        className="text-xs mt-0.5"
                        style={{ color: "#fb7185" }}
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
                  onPress={() => openDayOnLedger(entry.date)}
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
                onPress={() => openDayOnLedger(chain.root.date)}
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
                  onPress={() => openDayOnLedger(p.date)}
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
  onPress?: () => void;
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
  onPress,
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

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        disabled={!onPress}
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
        <View className="flex-row justify-between items-center mt-1">
          <Text className="text-xs" style={{ color: colors.text.tertiary }}>
            {dayjs(date).format("MMM DD, YYYY")}
            {onPress ? "  ·  " : ""}
            {onPress ? (
              <Text style={{ color: colors.info }}>{t("viewDayLedger")}</Text>
            ) : null}
          </Text>
          <Text
            className="text-xs font-medium"
            style={{
              color:
                runningBalance < 0
                  ? "#fb7185"
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
      </TouchableOpacity>
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
  onPress?: () => void;
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
  onPress,
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

    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={!onPress}
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
    </TouchableOpacity>
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
