import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Party, PartyType } from "@/types/party";
import { useTheme } from "@/hooks/use-theme";

type PartyHeaderCardProps = {
  party: Party;
  onEdit?: () => void;
};

export function PartyHeaderCard({ party }: PartyHeaderCardProps) {
  const { colors } = useTheme();

  const getTypeColors = (type: PartyType) => {
    if (type === "customer")
      return { accent: colors.success, icon: "person" as const };
    if (type === "supplier")
      return { accent: colors.warning, icon: "storefront" as const };
    return { accent: colors.info, icon: "people" as const };
  };

  const typeColors = getTypeColors(party.type);

  return (
    <View
      className="p-6 border-b"
      style={{ backgroundColor: colors.card, borderColor: colors.border }}
    >
      <View className="flex-row items-center">
        <View
          className="w-16 h-16 rounded-2xl items-center justify-center"
          style={{ backgroundColor: typeColors.accent + "22" }}
        >
          <Ionicons name={typeColors.icon} size={32} color={typeColors.accent} />
        </View>
        <View className="flex-1 ml-4">
          <View className="flex-row items-center">
            <Text
              className="text-xl font-bold flex-1"
              style={{ color: colors.text.primary }}
            >
              {party.name}
            </Text>
            <View
              className="px-3 py-1 rounded-full"
              style={{ backgroundColor: typeColors.accent + "22" }}
            >
              <Text
                className="text-xs font-medium capitalize"
                style={{ color: typeColors.accent }}
              >
                {party.type}
              </Text>
            </View>
          </View>
          <Text
            className="text-sm mt-1"
            style={{ color: colors.text.secondary }}
          >
            {party.code}
          </Text>
        </View>
      </View>
    </View>
  );
}
