import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
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
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: isDue ? "#d97706" + "60" : colors.border,
        borderWidth: isDue ? 1.5 : 1,
        marginBottom: 10,
        borderRadius: 16,
        padding: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
      }}
    >
      {/* Top: date + type */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons
            name="calendar-outline"
            size={13}
            color={colors.text.tertiary}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "500",
              color: colors.text.tertiary,
            }}
          >
            {formatLedgerDate(entry.date)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {isDue ? (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: "#d97706" + "20",
              }}
            >
              <Text
                style={{ fontSize: 10, fontWeight: "700", color: "#d97706" }}
              >
                DUE
              </Text>
            </View>
          ) : null}
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: accent + "18",
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                color: accent,
                textTransform: "uppercase",
              }}
            >
              {entry.type}
            </Text>
          </View>
        </View>
      </View>

      {/* Description */}
      <Text
        numberOfLines={2}
        style={{
          fontSize: 15,
          fontWeight: "700",
          color: colors.text.primary,
          marginBottom: 4,
        }}
      >
        {entry.description || "Transaction"}
      </Text>

      {/* Meta row */}
      {(entry.category_name || entry.account_name || entry.reference) && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 4,
          }}
        >
          {entry.category_name ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons
                name="pricetag-outline"
                size={12}
                color={colors.text.secondary}
              />
              <Text style={{ fontSize: 12, color: colors.text.secondary }}>
                {entry.category_name}
              </Text>
            </View>
          ) : null}
          {entry.account_name ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons
                name="wallet-outline"
                size={12}
                color={colors.text.secondary}
              />
              <Text style={{ fontSize: 12, color: colors.text.secondary }}>
                {entry.account_name}
              </Text>
            </View>
          ) : null}
          {entry.reference ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons
                name="link-outline"
                size={12}
                color={colors.text.secondary}
              />
              <Text style={{ fontSize: 12, color: colors.text.secondary }}>
                {entry.reference}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {entry.comment ? (
        <Text
          numberOfLines={2}
          style={{
            fontSize: 12,
            fontStyle: "italic",
            color: colors.text.tertiary,
            marginBottom: 8,
            marginTop: 2,
          }}
        >
          {entry.comment}
        </Text>
      ) : (
        <View style={{ height: 6 }} />
      )}

      {/* Amount + running balance */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginTop: 4,
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "600",
              color: colors.text.tertiary,
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            {isDebit ? "Debit" : "Credit"}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: accent }}>
            {formatLedgerAmount(amount)}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginBottom: 2,
            }}
          >
            <Ionicons
              name="git-commit-outline"
              size={12}
              color={colors.text.tertiary}
            />
            <Text
              style={{
                fontSize: 10,
                fontWeight: "600",
                color: colors.text.tertiary,
                textTransform: "uppercase",
              }}
            >
              Balance after
            </Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: "800", color: balanceColor }}>
            {formatLedgerBalance(balance)}
          </Text>
        </View>
      </View>

      {/* Mini debit/credit columns for classic ledger feel */}
      <View
        style={{
          flexDirection: "row",
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 10,
              color: colors.text.tertiary,
              textTransform: "uppercase",
            }}
          >
            Debit
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: entry.debit > 0 ? colors.success : colors.text.tertiary,
              marginTop: 2,
            }}
          >
            {entry.debit > 0 ? formatLedgerAmount(entry.debit) : "—"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 10,
              color: colors.text.tertiary,
              textTransform: "uppercase",
            }}
          >
            Credit
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: entry.credit > 0 ? colors.error : colors.text.tertiary,
              marginTop: 2,
            }}
          >
            {entry.credit > 0 ? formatLedgerAmount(entry.credit) : "—"}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text
            style={{
              fontSize: 10,
              color: colors.text.tertiary,
              textTransform: "uppercase",
            }}
          >
            Running
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: balanceColor,
              marginTop: 2,
            }}
          >
            {formatLedgerBalance(balance)}
          </Text>
        </View>
      </View>

      {entry.invoice_id ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginTop: 10,
          }}
        >
          <Ionicons name="document-text-outline" size={12} color={colors.info} />
          <Text style={{ fontSize: 11, fontWeight: "600", color: colors.info }}>
            View linked invoice
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export const LedgerEntryCard = memo(LedgerEntryCardComponent);
