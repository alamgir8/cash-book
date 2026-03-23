import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Party, PartyType } from "@/types/party";
import { useTheme } from "@/hooks/useTheme";

type PartyHeaderCardProps = {
  party: Party;
  onEdit: () => void;
};

export function PartyHeaderCard({ party, onEdit }: PartyHeaderCardProps) {
  const { colors } = useTheme();

  const getTypeColor = (type: PartyType) => {
    if (type === "customer")
      return { bg: "bg-green-100", text: "text-green-700", icon: "#10B981" };
    if (type === "supplier")
      return { bg: "bg-orange-100", text: "text-orange-700", icon: "#F97316" };
    return { bg: "bg-blue-100", text: "text-blue-700", icon: "#3B82F6" };
  };

  const typeColors = getTypeColor(party.type);

  return (
    <View className="p-6 border-b" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
      <View className="flex-row items-center">
        <View
          className={`w-16 h-16 rounded-2xl items-center justify-center ${typeColors.bg}`}
        >
          <Ionicons
            name={party.type === "customer" ? "person" : "storefront"}
            size={32}
            color={typeColors.icon}
          />
        </View>
        <View className="flex-1 ml-4">
          <View className="flex-row items-center">
            <Text className="text-xl font-bold flex-1" style={{ color: colors.text.primary }}>
              {party.name}
            </Text>
            <View className={`px-3 py-1 rounded-full ${typeColors.bg}`}>
              <Text
                className={`text-xs font-medium capitalize ${typeColors.text}`}
              >
                {party.type}
              </Text>
            </View>
          </View>
          <Text className="text-sm mt-1" style={{ color: colors.text.tertiary }}>{party.code}</Text>
        </View>
      </View>
    </View>
  );
}
