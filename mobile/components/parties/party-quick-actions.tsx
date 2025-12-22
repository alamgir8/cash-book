import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type PartyQuickActionsProps = {
  onViewLedger: () => void;
  onNewInvoice: () => void;
};

export function PartyQuickActions({
  onViewLedger,
  onNewInvoice,
}: PartyQuickActionsProps) {
  return (
    <View className="flex-row mt-4 gap-3">
      <TouchableOpacity
        className="flex-1 flex-row items-center justify-center py-3 bg-blue-500 rounded-xl"
        onPress={onViewLedger}
      >
        <Ionicons name="document-text" size={20} color="white" />
        <Text className="ml-2 text-white font-medium">View Ledger</Text>
      </TouchableOpacity>
      <TouchableOpacity
        className="flex-1 flex-row items-center justify-center py-3 bg-gray-100 rounded-xl"
        onPress={onNewInvoice}
      >
        <Ionicons name="receipt" size={20} color="#374151" />
        <Text className="ml-2 text-gray-700 font-medium">New Invoice</Text>
      </TouchableOpacity>
    </View>
  );
}
