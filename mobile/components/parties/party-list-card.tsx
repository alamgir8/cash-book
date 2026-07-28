import { memo, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
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
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <Pressable onPress={open} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: typeColor + "20",
            }}
          >
            <Ionicons
              name={isCustomer ? "person" : "storefront"}
              size={24}
              color={typeColor}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: "600",
                  color: colors.text.primary,
                }}
              >
                {party.name}
              </Text>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: typeColor + "20",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "500",
                    color: typeColor,
                    textTransform: "capitalize",
                  }}
                >
                  {party.type}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 14, marginTop: 2, color: colors.text.secondary }}>
              {party.code}
              {party.phone ? ` • ${party.phone}` : ""}
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                marginTop: 4,
                color:
                  party.current_balance > 0
                    ? colors.success
                    : party.current_balance < 0
                      ? colors.error
                      : colors.text.secondary,
              }}
            >
              {formatPartyBalanceLabel(party.current_balance)}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: colors.success + "18",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.success }}>
                  Debit {debitCount}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: colors.error + "18",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.error }}>
                  Credit {creditCount}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: colors.bg.tertiary,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "500", color: colors.text.secondary }}>
                  Total {totalCount}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>

      <View
        style={{
          flexDirection: "row",
          marginTop: 12,
          paddingTop: 12,
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Pressable
          onPress={ledger}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: colors.bg.tertiary,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="document-text" size={16} color={colors.text.secondary} />
          <Text style={{ marginLeft: 4, fontSize: 14, color: colors.text.secondary }}>
            Ledger
          </Text>
        </Pressable>

        {canManage ? (
          <>
            <Pressable
              onPress={edit}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: colors.bg.tertiary,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="pencil" size={16} color={colors.text.secondary} />
              <Text style={{ marginLeft: 4, fontSize: 14, color: colors.text.secondary }}>
                Edit
              </Text>
            </Pressable>

            {showDeleteActions ? (
              <>
                <Pressable
                  onPress={merge}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: colors.warning + "20",
                    opacity: pressed ? 0.7 : 1,
                    gap: 4,
                  })}
                >
                  <Ionicons name="git-merge-outline" size={16} color={colors.warning} />
                  <Text style={{ fontSize: 14, fontWeight: "500", color: colors.warning }}>
                    Merge
                  </Text>
                </Pressable>
                <Pressable
                  onPress={remove}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: colors.error + "20",
                    opacity: pressed ? 0.7 : 1,
                    gap: 4,
                  })}
                >
                  <Ionicons name="trash" size={16} color={colors.error} />
                  <Text style={{ fontSize: 14, fontWeight: "500", color: colors.error }}>
                    Delete
                  </Text>
                </Pressable>
              </>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

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
