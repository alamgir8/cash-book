import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type AccountActionsProps = {
  onEdit: () => void;
  onExport: () => void;
  exporting: boolean;
};

export function AccountActions({
  onEdit,
  onExport,
  exporting,
}: AccountActionsProps) {
  return (
    <View className="flex-row gap-3">
      <TouchableOpacity
        onPress={onEdit}
        className="flex-1 flex-row items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 bg-gray-50 active:bg-gray-100"
      >
        <Ionicons name="pencil" size={18} color="#334155" />
        <Text className="text-gray-700 font-semibold">Edit Account</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onExport}
        disabled={exporting}
        className="flex-1 flex-row items-center justify-center gap-2 bg-blue-500 rounded-xl py-2.5 active:opacity-90"
      >
        <Ionicons
          name={exporting ? "cloud-download" : "document-text-outline"}
          size={18}
          color="#fff"
        />
        <Text className="text-white font-semibold">
          {exporting ? "Exporting..." : "Export PDF"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
