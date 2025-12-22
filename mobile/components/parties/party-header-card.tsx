import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Party, PartyType } from "@/types/party";

type PartyHeaderCardProps = {
  party: Party;
  onEdit: () => void;
};

export function PartyHeaderCard({ party, onEdit }: PartyHeaderCardProps) {
  const getTypeColor = (type: PartyType) => {
    if (type === "customer")
      return { bg: "bg-green-100", text: "text-green-700", icon: "#10B981" };
    if (type === "supplier")
      return { bg: "bg-orange-100", text: "text-orange-700", icon: "#F97316" };
    return { bg: "bg-blue-100", text: "text-blue-700", icon: "#3B82F6" };
  };

  const typeColors = getTypeColor(party.type);

  return (
    <View className="bg-white p-6 border-b border-gray-100">
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
            <Text className="text-xl font-bold text-gray-900 flex-1">
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
          <Text className="text-sm text-gray-500 mt-1">{party.code}</Text>
        </View>
      </View>
    </View>
  );
}
