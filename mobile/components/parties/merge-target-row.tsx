import { memo, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Party } from "@/services/parties";
import { useTheme } from "@/hooks/use-theme";

type Props = {
  party: Party;
  disabled?: boolean;
  onSelect: (party: Party) => void;
};

function MergeTargetRowComponent({ party, disabled, onSelect }: Props) {
  const { colors } = useTheme();
  const onPress = useCallback(() => onSelect(party), [onSelect, party]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        opacity: pressed || disabled ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ fontWeight: "500", color: colors.text.primary }}>
          {party.name}
        </Text>
        <Text style={{ fontSize: 12, marginTop: 2, color: colors.text.tertiary }}>
          {party.code}
          {party.type ? ` · ${party.type}` : ""}
        </Text>
      </View>
      <Ionicons name="git-merge-outline" size={18} color={colors.warning} />
    </Pressable>
  );
}

export const MergeTargetRow = memo(
  MergeTargetRowComponent,
  (prev, next) =>
    prev.party._id === next.party._id &&
    prev.party.name === next.party.name &&
    prev.party.code === next.party.code &&
    prev.party.type === next.party.type &&
    prev.disabled === next.disabled &&
    prev.onSelect === next.onSelect,
);
