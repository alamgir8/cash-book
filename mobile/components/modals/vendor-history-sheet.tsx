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
import { useActiveOrgId } from "@/hooks/use-organization";
import {
  fetchVendorLedger,
  type Transaction,
  type VendorLedger,
} from "@/services/transactions";
import { navigateToLedgerDay } from "@/lib/navigate-ledger-day";

type Props = {
  visible: boolean;
  onClose: () => void;
  transaction: Transaction;
  /** vendor = party/vendor column; for_party = For / counterparty party */
  mode?: "vendor" | "for_party";
};

export const VendorHistorySheet = ({
  visible,
  onClose,
  transaction,
  mode = "vendor",
}: Props) => {
  const { colors } = useTheme();
  const { formatAmount } = usePreferences();
  const insets = useSafeAreaInsets();
  const organizationId = useActiveOrgId();
  const [exportingPdf, setExportingPdf] = React.useState(false);

  const openDayOnLedger = React.useCallback(
    (date: string) => {
      if (!navigateToLedgerDay(date)) return;
      onClose();
    },
    [onClose],
  );

  const partyRefId = (ref: Transaction["party"] | Transaction["for_party"]) => {
    if (!ref) return undefined;
    if (typeof ref === "object") return ref._id || undefined;
    if (typeof ref === "string") return ref;
    return undefined;
  };
  const partyRefName = (ref: Transaction["party"] | Transaction["for_party"]) => {
    if (ref && typeof ref === "object" && ref.name?.trim()) return ref.name.trim();
    return undefined;
  };

  const isForPartyMode = mode === "for_party";

  // Vendor ledger: party only. For ledger: for_party, else legacy counterparty text.
  const partyId = isForPartyMode
    ? partyRefId(transaction.for_party)
    : partyRefId(transaction.party);
  const rawCp = transaction.counterparty?.trim() || "";
  const counterparty =
    !partyId &&
    !isForPartyMode &&
    rawCp &&
    rawCp.toLowerCase() !== "transfer"
      ? rawCp
      : undefined;
  // For-mode without linked party: fall back to counterparty string when it
  // is not the vendor name (legacy free-text "For").
  const forCounterparty =
    isForPartyMode &&
    !partyId &&
    rawCp &&
    rawCp.toLowerCase() !== "transfer"
      ? rawCp
      : undefined;

  const displayName = isForPartyMode
    ? partyRefName(transaction.for_party) || forCounterparty || ""
    : partyRefName(transaction.party) ||
      transaction.vendor?.trim() ||
      counterparty ||
      "";

  const ledgerTitle = isForPartyMode ? "Counterparty Ledger" : "Full Ledger";
  const ledgerSubtitle = isForPartyMode
    ? `All transactions for ${displayName || "this counterparty"}`
    : `All transactions with ${displayName || "this vendor"}`;

  // Only loan_in / loan_out / due transactions show directional "they owe / you owe" language
  const isLoanContext =
    transaction.category?.type === "loan_in" ||
    transaction.category?.type === "loan_out" ||
    transaction.payment_status === "due";

  const queryPartyId = partyId;
  const queryCounterparty = isForPartyMode ? forCounterparty : counterparty;

  const ledgerQuery = useQuery({
    queryKey: [
      isForPartyMode ? "for-party-ledger" : "vendor-ledger",
      queryPartyId,
      queryCounterparty,
      organizationId ?? "personal",
    ],
    queryFn: () =>
      fetchVendorLedger({
        partyId: isForPartyMode ? undefined : queryPartyId,
        forPartyId: isForPartyMode ? queryPartyId : undefined,
        counterparty: queryCounterparty,
        organizationId,
        role: isForPartyMode ? "for_party" : "vendor",
      }),
    enabled: visible && !!(queryPartyId || queryCounterparty),
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

      const { buildHistoryPdfHtml, formatHistoryAmount } = await import(
        "@/lib/history-pdf"
      );

      const s = ledger.summary;
      const name = displayName || ledger.party_name;
      const title = `${name} — ${ledgerTitle}`;
      const subtitle = isForPartyMode
        ? `All transactions for ${name}`
        : `All transactions with ${name}`;

      const net = s.net_balance;
      const banner =
        isLoanContext
          ? {
              label:
                net === 0
                  ? "Settled"
                  : net > 0
                    ? "They Owe You"
                    : "You Owe Them",
              value: formatHistoryAmount(Math.abs(net)),
              tone:
                net === 0
                  ? ("credit" as const)
                  : net > 0
                    ? ("sky" as const)
                    : ("debit" as const),
            }
          : net !== 0
            ? {
                label: net > 0 ? "Net Received" : "Net Spent",
                value: formatHistoryAmount(Math.abs(net)),
                tone: net > 0 ? ("credit" as const) : ("debit" as const),
              }
            : null;

      const chronological = [...ledger.timeline].reverse();
      const rows = chronological.map((e) => {
        const isCredit = e.entry_type === "credit";
        const bal = Number(e.running_balance) || 0;
        const catName =
          (e as any).category?.name ?? (e as any).category_id?.name ?? "";
        const typeLabel = `${isCredit ? "Credit" : "Debit"}${catName ? ` · ${catName}` : ""}`;
        const balance = isLoanContext
          ? bal === 0
            ? "✓ Clear"
            : bal > 0
              ? `${formatHistoryAmount(bal)} owed to you`
              : `${formatHistoryAmount(Math.abs(bal))} you owe`
          : formatHistoryAmount(Math.abs(bal));
        return {
          date: dayjs(e.date).format("MMM D, YYYY"),
          typeLabel,
          typeTone: isCredit ? ("credit" as const) : ("debit" as const),
          note: e.description,
          amount: formatHistoryAmount(
            isCredit ? Number(e.amount) : -Number(e.amount),
            true,
          ),
          amountTone: isCredit ? ("credit" as const) : ("debit" as const),
          balance,
          balanceTone:
            bal === 0
              ? ("credit" as const)
              : bal > 0
                ? ("sky" as const)
                : ("debit" as const),
        };
      });

      const closing = {
        label: "Closing Balance",
        value: isLoanContext
          ? net === 0
            ? "✓ Fully Settled"
            : net > 0
              ? `${formatHistoryAmount(net)} — Owed to you`
              : `${formatHistoryAmount(Math.abs(net))} — You owe`
          : `Net: ${formatHistoryAmount(Math.abs(net))}`,
        tone:
          net === 0
            ? ("credit" as const)
            : net > 0
              ? ("sky" as const)
              : ("debit" as const),
      };

      const html = buildHistoryPdfHtml({
        title,
        subtitle,
        metaRight: `${s.transaction_count} transactions total`,
        kpis: [
          {
            label: "Total Credit (In)",
            value: formatHistoryAmount(s.total_credit),
            tone: "credit",
          },
          {
            label: "Total Debit (Out)",
            value: formatHistoryAmount(s.total_debit),
            tone: "debit",
          },
        ],
        banner,
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
      Alert.alert("Export failed", e?.message ?? "Unknown error");
    } finally {
      setExportingPdf(false);
    }
  };

  const resolvedName = displayName || ledger?.party_name || "";

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
                {resolvedName
                  ? `${resolvedName} — ${ledgerTitle}`
                  : ledgerTitle}
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: colors.text.tertiary }}
              >
                {ledgerSubtitle}
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
              {/* Summary cards: credit / debit — same chip style as Loan Given */}
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
                  color="#fb7185"
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
                  onPress={() => openDayOnLedger(entry.date)}
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
  const color = isSettled ? "#16a34a" : youAreOwed ? "#f59e0b" : "#fb7185";
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
  onPress?: () => void;
};

/** Matches Loan Given / Payment History timeline cards. */
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
  onPress,
}: VendorLedgerRowProps) => {
  const isCredit = entryType === "credit";
  // Same accent language as loan given (teal/green in) + light rose out
  const typeColor = isCredit ? "#0d9488" : "#fb7185";
  const icon = isCredit ? "arrow-down-outline" : "arrow-up-outline";
  const sign = isCredit ? "+" : "-";
  const label = isCredit ? "Credit" : "Debit";

  const balColor =
    runningBalance === 0
      ? "#16a34a"
      : runningBalance > 0
        ? "#f59e0b"
        : "#fb7185";
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
          style={{ backgroundColor: typeColor }}
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
          <View className="flex-1 mr-2">
            <Text
              className="text-xs font-semibold"
              style={{ color: typeColor }}
            >
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
          <Text className="text-sm font-bold" style={{ color: typeColor }}>
            {`${sign}${formatAmount(amount)}`}
          </Text>
        </View>
        <View className="flex-row justify-between items-center mt-1.5 gap-2">
          <Text
            className="text-xs flex-shrink"
            style={{ color: colors.text.tertiary, flex: 1 }}
            numberOfLines={1}
          >
            {`${dayjs(date).format("MMM DD, YYYY")}${accountName ? ` · ${accountName}` : ""}${onPress ? " · Day" : ""}`}
          </Text>
          <Text
            className="text-xs font-medium"
            style={{ color: balColor }}
            numberOfLines={1}
          >
            {`Balance: ${balLabel}`}
          </Text>
        </View>
      </TouchableOpacity>
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
