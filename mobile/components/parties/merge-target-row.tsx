import { memo, useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Party } from "@/services/parties";
import { useTheme } from "@/hooks/use-theme";

type Props = {
  party: Party;
  disabled?: boolean;
  onSelect: (party: Party) => void;
};

function partyTxnCount(party: Party) {
  const debit = party.debit_transactions ?? 0;
  const credit = party.credit_transactions ?? 0;
  const live = debit + credit;
  return live > 0 ? live : party.total_transactions ?? 0;
}

function MergeTargetRowComponent({ party, disabled, onSelect }: Props) {
  const { colors } = useTheme();
  const onPress = useCallback(() => onSelect(party), [onSelect, party]);
  const txnCount = partyTxnCount(party);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: colors.border,
          opacity: pressed || disabled ? 0.55 : 1,
        },
      ]}
    >
      <View style={styles.left}>
        <Text
          numberOfLines={1}
          style={[styles.name, { color: colors.text.primary }]}
        >
          {party.name}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.meta, { color: colors.text.tertiary }]}
        >
          {party.code}
          {party.type ? ` · ${party.type}` : ""}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={[styles.count, { color: colors.warning }]}>{txnCount}</Text>
        <Ionicons name="git-merge-outline" size={18} color={colors.warning} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
  },
  meta: {
    fontSize: 11,
    marginTop: 2,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
    flexWrap: "nowrap",
  },
  count: {
    fontSize: 14,
    fontWeight: "700",
    marginRight: 6,
    fontVariant: ["tabular-nums"],
  },
});

export const MergeTargetRow = memo(
  MergeTargetRowComponent,
  (prev, next) =>
    prev.party._id === next.party._id &&
    prev.party.name === next.party.name &&
    prev.party.code === next.party.code &&
    prev.party.type === next.party.type &&
    prev.party.total_transactions === next.party.total_transactions &&
    prev.party.debit_transactions === next.party.debit_transactions &&
    prev.party.credit_transactions === next.party.credit_transactions &&
    prev.disabled === next.disabled &&
    prev.onSelect === next.onSelect,
);
