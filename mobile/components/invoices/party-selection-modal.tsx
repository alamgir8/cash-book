import React from "react";
import { View, Text, TouchableOpacity, Modal, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Party } from "@/services/parties";

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
  const partyTypeLabel = invoiceType === "sale" ? "Customer" : "Supplier";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View className="flex-1 bg-slate-50">
        <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-slate-100">
          <Text className="text-lg font-bold text-slate-900">
            Select {partyTypeLabel}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className="w-10 h-10 items-center justify-center"
          >
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>
        <FlatList
          data={parties}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              className={`flex-row items-center p-4 rounded-2xl mb-3 border-2 ${
                selectedParty?._id === item._id
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-slate-100 bg-white"
              }`}
              onPress={() => onSelectParty(item)}
            >
              <View
                className={`w-12 h-12 rounded-xl items-center justify-center ${
                  item.type === "customer" ? "bg-emerald-100" : "bg-amber-100"
                }`}
              >
                <Ionicons
                  name={item.type === "customer" ? "person" : "storefront"}
                  size={24}
                  color={item.type === "customer" ? "#10B981" : "#F59E0B"}
                />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-base font-semibold text-slate-900">
                  {item.name}
                </Text>
                <Text className="text-sm text-slate-500">
                  {item.phone || item.email || item.code}
                </Text>
              </View>
              {selectedParty?._id === item._id && (
                <Ionicons name="checkmark-circle" size={24} color="#6366F1" />
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="p-8 items-center">
              <View className="w-20 h-20 rounded-full bg-slate-100 items-center justify-center mb-4">
                <Ionicons name="people-outline" size={40} color="#94A3B8" />
              </View>
              <Text className="text-base font-medium text-slate-700 text-center">
                No {partyTypeLabel}s Found
              </Text>
              <Text className="text-sm text-slate-500 text-center mt-1">
                Add a {partyTypeLabel.toLowerCase()} first to create an invoice
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}
