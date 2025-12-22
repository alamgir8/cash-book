import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PartyType } from "@/types/party";

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
  return (
    <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
      <Text className="text-base font-semibold text-slate-800 mb-4">
        Party Type <Text className="text-red-500">*</Text>
      </Text>
      <View className="flex-row gap-3">
        {partyTypes.map((type) => (
          <TouchableOpacity
            key={type.value}
            onPress={() => onSelect(type.value)}
            className={`flex-1 p-4 rounded-xl border-2 items-center ${
              selectedType === type.value
                ? "border-indigo-500 bg-indigo-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <View
              className="w-12 h-12 rounded-full items-center justify-center mb-2"
              style={{
                backgroundColor:
                  selectedType === type.value ? type.color + "20" : "#F1F5F9",
              }}
            >
              <Ionicons
                name={type.icon as any}
                size={24}
                color={selectedType === type.value ? type.color : "#94A3B8"}
              />
            </View>
            <Text
              className={`text-sm font-medium ${
                selectedType === type.value
                  ? "text-indigo-600"
                  : "text-slate-500"
              }`}
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
