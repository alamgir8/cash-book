import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PartyType } from "@/types/party";
import { useTheme } from "@/hooks/useTheme";

type PartyTypeOption = {
  value: PartyType;
  label: string;
  icon: string;
  color: string;
};

const partyTypes: PartyTypeOption[] = [
  {
    value: "customer",
    label: "Customer",
    icon: "person",
    color: "#10B981",
  },
  {
    value: "supplier",
    label: "Supplier",
    icon: "storefront",
    color: "#F97316",
  },
  {
    value: "both",
    label: "Both",
    icon: "people",
    color: "#6366F1",
  },
];

type PartyTypeSelectorProps = {
  selectedType: PartyType;
  onSelect: (type: PartyType) => void;
};

export function PartyTypeSelector({
  selectedType,
  onSelect,
}: PartyTypeSelectorProps) {
  const { colors } = useTheme();

  return (
    <View className="mx-4 mt-4 rounded-2xl p-5 shadow-sm" style={{ backgroundColor: colors.card }}>
      <Text className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
        Party Type <Text style={{ color: colors.error }}>*</Text>
      </Text>
      <View className="flex-row gap-3">
        {partyTypes.map((type) => (
          <TouchableOpacity
            key={type.value}
            onPress={() => onSelect(type.value)}
            className="flex-1 p-4 rounded-xl border-2 items-center"
            style={{
              borderColor: selectedType === type.value ? colors.primary : colors.border,
              backgroundColor: selectedType === type.value ? (colors.primary + '10') : colors.bg.secondary,
            }}
          >
            <View
              className="w-12 h-12 rounded-full items-center justify-center mb-2"
              style={{
                backgroundColor:
                  selectedType === type.value ? type.color + "20" : colors.bg.tertiary,
              }}
            >
              <Ionicons
                name={type.icon as any}
                size={24}
                color={selectedType === type.value ? type.color : colors.text.tertiary}
              />
            </View>
            <Text
              className="text-sm font-medium"
              style={{ color: selectedType === type.value ? colors.primary : colors.text.tertiary }}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export { partyTypes };
