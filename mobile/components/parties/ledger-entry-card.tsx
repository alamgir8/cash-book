import { memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import type { LedgerEntry } from "@/services/parties";
import {
  formatLedgerDate,
  formatLedgerAmount,
  formatLedgerBalance,
} from "@/lib/party-utils";

type Props = {
  entry: LedgerEntry;
  onPress?: () => void;
};

function LedgerEntryCardComponent({ entry, onPress }: Props) {
  const { colors } = useTheme();
  const isDebit = entry.type === "debit";
  const accent = isDebit ? colors.success : colors.error;
  const amount = isDebit ? entry.debit : entry.credit;
  const balance = entry.running_balance ?? 0;
  const balanceColor =
    balance > 0
      ? colors.success
      : balance < 0
        ? colors.error
        : colors.text.secondary;
  const isDue = entry.payment_status === "due";
  const interactive = Boolean(onPress);

  return (
    <TouchableOpacity
      activeOpacity={interactive ? 0.75 : 1}
      disabled={!interactive}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.bg.secondary,
          borderColor: isDue ? "#d97706" + "60" : colors.border,
          borderWidth: isDue ? 1.5 : 1,
        },
      ]}
    >
      {isDue ? (
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: "#d97706" + "20" }]}>
            <Ionicons name="time-outline" size={12} color="#d97706" />
            <Text style={[styles.badgeText, { color: "#d97706" }]}>DUE</Text>
          </View>
        </View>
      ) : null}

      {/* Header: account + date | amount + type — mirrors transaction cards */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.accountRow}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <Text
              numberOfLines={1}
              style={[styles.accountName, { color: colors.text.primary }]}
            >
              {entry.account_name || "Account"}
            </Text>
          </View>
          <Text style={[styles.dateText, { color: colors.text.tertiary }]}>
            {formatLedgerDate(entry.date)}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.amount, { color: accent }]}>
            {isDebit ? "+" : "-"}
            {formatLedgerAmount(amount)}
          </Text>
          <View style={[styles.typePill, { backgroundColor: accent + "20" }]}>
            <Text style={[styles.typePillText, { color: accent }]}>
              {entry.type.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {entry.description ? (
        <Text
          numberOfLines={2}
          style={[styles.description, { color: colors.text.secondary }]}
        >
          {entry.description}
        </Text>
      ) : null}

      {entry.comment ? (
        <Text
          numberOfLines={2}
          style={[styles.comment, { color: colors.text.tertiary }]}
        >
          {entry.comment}
        </Text>
      ) : null}

      {/* Chip-style meta */}
      {(entry.category_name || entry.reference) && (
        <View style={styles.chipRow}>
          {entry.category_name ? (
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: colors.info + "25",
                  borderColor: colors.info + "40",
                },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.info }]}>
                {entry.category_name}
              </Text>
            </View>
          ) : null}
          {entry.reference ? (
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: colors.bg.tertiary,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.text.secondary }]}>
                {entry.reference}
              </Text>
            </View>
          ) : null}
          {entry.payment_status === "paid" ? (
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: colors.success + "20",
                  borderColor: colors.success + "40",
                },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.success }]}>
                Paid
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Balance after — ledger-specific */}
      <View
        style={[
          styles.balanceRow,
          {
            backgroundColor: colors.bg.tertiary,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.balanceCol}>
          <Text style={[styles.balanceLabel, { color: colors.text.tertiary }]}>
            Debit
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: entry.debit > 0 ? colors.success : colors.text.tertiary,
            }}
          >
            {entry.debit > 0 ? formatLedgerAmount(entry.debit) : "—"}
          </Text>
        </View>
        <View style={styles.balanceCol}>
          <Text style={[styles.balanceLabel, { color: colors.text.tertiary }]}>
            Credit
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: entry.credit > 0 ? colors.error : colors.text.tertiary,
            }}
          >
            {entry.credit > 0 ? formatLedgerAmount(entry.credit) : "—"}
          </Text>
        </View>
        <View style={[styles.balanceCol, { alignItems: "flex-end" }]}>
          <Text style={[styles.balanceLabel, { color: colors.text.tertiary }]}>
            Balance after
          </Text>
          <Text style={{ fontSize: 15, fontWeight: "800", color: balanceColor }}>
            {formatLedgerBalance(balance)}
          </Text>
        </View>
      </View>

      {entry.invoice_id ? (
        <View style={styles.invoiceRow}>
          <Ionicons name="document-text-outline" size={14} color={colors.info} />
          <Text style={[styles.invoiceText, { color: colors.info }]}>
            View linked invoice
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.info} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
    borderRadius: 16,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  accountName: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
  },
  dateText: {
    fontSize: 13,
    marginTop: 4,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 20,
    fontWeight: "700",
  },
  typePill: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  description: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  comment: {
    marginTop: 4,
    fontSize: 12,
    fontStyle: "italic",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  balanceRow: {
    flexDirection: "row",
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  balanceCol: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
  },
  invoiceText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
});

export const LedgerEntryCard = memo(LedgerEntryCardComponent);
