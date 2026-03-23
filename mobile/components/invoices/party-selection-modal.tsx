import React from "react";
import { View, Text, TouchableOpacity, Modal, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Party } from "@/services/parties";
import { useTheme } from "@/hooks/useTheme";

interface PartySelectionModalProps {
  visible: boolean;
  onClose: () => void;
  parties: Party[];
  selectedParty: Party | null;
  onSelectParty: (party: Party) => void;
  invoiceType: "sale" | "purchase";
}

export function PartySelectionModal({
  visible,
  onClose,
  parties,
  selectedParty,
  onSelectParty,
  invoiceType,
}: PartySelectionModalProps) {
  const { colors } = useTheme();
  const partyTypeLabel = invoiceType === "sale" ? "Customer" : "Supplier";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View className="flex-1" style={{ backgroundColor: colors.bg.secondary }}>
        <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ backgroundColor: colors.bg.primary, borderColor: colors.border }}>
          <Text className="text-lg font-bold" style={{ color: colors.text.primary }}>
            Select {partyTypeLabel}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className="w-10 h-10 items-center justify-center"
          >
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={parties}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="flex-row items-center p-4 rounded-2xl mb-3 border-2"
              style={{
                borderColor: selectedParty?._id === item._id ? colors.primary : colors.border,
                backgroundColor: selectedParty?._id === item._id ? (colors.primary + '10') : colors.card,
              }}
              onPress={() => onSelectParty(item)}
            >
              <View
                className={\`w-12 h-12 rounded-xl items-center justify-center \${
                  item.type === "customer" ? "bg-emerald-100" : "bg-amber-100"
                }\`}
              >
                <Ionicons
                  name={item.type === "customer" ? "person" : "storefront"}
                  size={24}
                  color={item.type === "customer" ? "#10B981" : "#F59E0B"}
                />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-base font-semibold" style={{ color: colors.text.primary }}>
                  {item.name}
                </Text>
                <Text className="text-sm" style={{ color: colors.text.tertiary }}>
                  {item.phone || item.email || item.code}
                </Text>
              </View>
              {selectedParty?._id === item._id && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="p-8 items-center">
              <View className="w-20 h-20 rounded-full items-center justify-center mb-4" style={{ backgroundColor: colors.bg.tertiary }}>
                <Ionicons name="people-outline" size={40} color={colors.text.tertiary} />
              </View>
              <Text className="text-base font-medium text-center" style={{ color: colors.text.primary }}>
                No {partyTypeLabel}s Found
              </Text>
              <Text className="text-sm text-center mt-1" style={{ color: colors.text.tertiary }}>
                Add a {partyTypeLabel.toLowerCase()} first to create an invoice
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}
