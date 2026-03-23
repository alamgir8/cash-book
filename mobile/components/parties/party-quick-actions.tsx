import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

type PartyQuickActionsProps = {
  onViewLedger: () => void;
  onNewInvoice: () => void;
};

export function PartyQuickActions({
  onViewLedger,
  onNewInvoice,
}: PartyQuickActionsProps) {
  const { colors } = useTheme();

  return (
    <View className="flex-row mt-4 gap-3">
      <TouchableOpacity
        className="flex-1 flex-row items-center justify-center py-3 rounded-xl"
        style={{ backgroundColor: colors.primary }}
        onPress={onViewLedger}
      >
        <Ionicons name="document-text" size={20} color="white" />
        <Text className="ml-2 text-white font-medium">View Ledger</Text>
      </TouchableOpacity>
      <TouchableOpacity
        className="flex-1 flex-row items-center justify-center py-3 rounded-xl"
        style={{ backgroundColor: colors.bg.secondary }}
        onPress={onNewInvoice}
      >
        <Ionicons name="receipt" size={20} color={colors.text.primary} />
        <Text className="ml-2 font-medium" style={{ color: colors.text.primary }}>New Invoice</Text>
      </TouchableOpacity>
    </View>
  );
}
