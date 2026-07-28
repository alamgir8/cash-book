import { memo, useCallback } from "react";
import { View, Text, Pressable, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Party } from "@/services/parties";
import { useTheme } from "@/hooks/use-theme";

function formatPartyBalanceLabel(balance: number) {
  const absBalance = Math.abs(balance);
  const formatted = absBalance.toLocaleString();
  if (balance > 0) return `${formatted} receivable`;
  if (balance < 0) return `${formatted} payable`;
  return "0 (settled)";
}

type Props = {
  party: Party;
  canManage: boolean;
  showDeleteActions: boolean;
  onOpen: (party: Party) => void;
  onLedger: (party: Party) => void;
  onEdit: (party: Party) => void;
  onMerge: (party: Party) => void;
  onDelete: (party: Party) => void;
};

function PartyListCardComponent({
  party,
  canManage,
  showDeleteActions,
  onOpen,
  onLedger,
  onEdit,
  onMerge,
  onDelete,
}: Props) {
  const { colors } = useTheme();
  const isCustomer = party.type === "customer";
  const typeColor = isCustomer ? colors.success : colors.warning;
  const debitCount = party.debit_transactions ?? 0;
  const creditCount = party.credit_transactions ?? 0;
  const totalCount =
    debitCount + creditCount || party.total_transactions || 0;

  const open = useCallback(() => onOpen(party), [onOpen, party]);
  const ledger = useCallback(() => onLedger(party), [onLedger, party]);
  const edit = useCallback(() => onEdit(party), [onEdit, party]);
  const merge = useCallback(() => onMerge(party), [onMerge, party]);
  const remove = useCallback(() => onDelete(party), [onDelete, party]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.bg.secondary,
          borderColor: colors.border,
        },
      ]}
    >
      <Pressable
        onPress={open}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View style={styles.headerRow}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: typeColor + "20" },
            ]}
          >
            <Ionicons
              name={isCustomer ? "person" : "storefront"}
              size={20}
              color={typeColor}
            />
          </View>
          <View style={styles.headerText}>
            <View style={styles.nameRow}>
              <Text
                numberOfLines={1}
                style={[styles.name, { color: colors.text.primary }]}
              >
                {party.name}
              </Text>
              <View
                style={[styles.typeBadge, { backgroundColor: typeColor + "20" }]}
              >
                <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                  {party.type}
                </Text>
              </View>
            </View>
            <Text style={[styles.meta, { color: colors.text.secondary }]}>
              {party.code}
              {party.phone ? ` • ${party.phone}` : ""}
            </Text>
            <Text
              style={[
                styles.balance,
                {
                  color:
                    party.current_balance > 0
                      ? colors.success
                      : party.current_balance < 0
                        ? colors.error
                        : colors.text.secondary,
                },
              ]}
            >
              {formatPartyBalanceLabel(party.current_balance)}
            </Text>
            <View style={styles.countRow}>
              <View
                style={[
                  styles.countChip,
                  { backgroundColor: colors.success + "18" },
                ]}
              >
                <Text style={[styles.countText, { color: colors.success }]}>
                  Debit {debitCount}
                </Text>
              </View>
              <View
                style={[
                  styles.countChip,
                  { backgroundColor: colors.error + "18" },
                ]}
              >
                <Text style={[styles.countText, { color: colors.error }]}>
                  Credit {creditCount}
                </Text>
              </View>
              <View
                style={[
                  styles.countChip,
                  { backgroundColor: colors.bg.tertiary },
                ]}
              >
                <Text
                  style={[styles.countText, { color: colors.text.secondary }]}
                >
                  Total {totalCount}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>

      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.bg.tertiary }]}
          activeOpacity={0.7}
          onPress={ledger}
        >
          <Ionicons
            name="document-text"
            size={16}
            color={colors.text.secondary}
          />
          <Text
            numberOfLines={1}
            style={[styles.actionLabel, { color: colors.text.secondary }]}
          >
            Ledger
          </Text>
        </TouchableOpacity>

        {canManage ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.bg.tertiary }]}
            activeOpacity={0.7}
            onPress={edit}
          >
            <Ionicons name="pencil" size={16} color={colors.text.secondary} />
            <Text
              numberOfLines={1}
              style={[styles.actionLabel, { color: colors.text.secondary }]}
            >
              Edit
            </Text>
          </TouchableOpacity>
        ) : null}

        {canManage && showDeleteActions ? (
          <>
            <TouchableOpacity
              style={[
                styles.actionBtnCompact,
                { backgroundColor: colors.warning + "20" },
              ]}
              activeOpacity={0.7}
              onPress={merge}
            >
              <Ionicons
                name="git-merge-outline"
                size={16}
                color={colors.warning}
              />
              <Text
                numberOfLines={1}
                style={[styles.actionLabelMedium, { color: colors.warning }]}
              >
                Merge
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionBtnCompact,
                { backgroundColor: colors.error + "20" },
              ]}
              activeOpacity={0.7}
              onPress={remove}
            >
              <Ionicons name="trash" size={16} color={colors.error} />
              <Text
                numberOfLines={1}
                style={[styles.actionLabelMedium, { color: colors.error }]}
              >
                Delete
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  balance: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  countRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  countChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countText: {
    fontSize: 11,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  actionBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  actionBtnCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 3,
  },
  actionLabel: {
    marginLeft: 3,
    fontSize: 12,
  },
  actionLabelMedium: {
    fontSize: 12,
    fontWeight: "500",
  },
});

export const PartyListCard = memo(
  PartyListCardComponent,
  (prev, next) =>
    prev.party._id === next.party._id &&
    prev.party.name === next.party.name &&
    prev.party.type === next.party.type &&
    prev.party.code === next.party.code &&
    prev.party.phone === next.party.phone &&
    prev.party.current_balance === next.party.current_balance &&
    prev.party.debit_transactions === next.party.debit_transactions &&
    prev.party.credit_transactions === next.party.credit_transactions &&
    prev.party.total_transactions === next.party.total_transactions &&
    prev.canManage === next.canManage &&
    prev.showDeleteActions === next.showDeleteActions &&
    prev.onOpen === next.onOpen &&
    prev.onLedger === next.onLedger &&
    prev.onEdit === next.onEdit &&
    prev.onMerge === next.onMerge &&
    prev.onDelete === next.onDelete,
);
