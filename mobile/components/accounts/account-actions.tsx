import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

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
  const { colors } = useTheme();

  return (
    <View className="flex-row gap-3">
      <TouchableOpacity
        onPress={onEdit}
        className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 border"
        style={{
          backgroundColor: colors.bg.secondary,
          borderColor: colors.border,
        }}
      >
        <Ionicons name="pencil" size={18} color={colors.text.primary} />
        <Text className="font-semibold" style={{ color: colors.text.primary }}>
          Edit Account
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onExport}
        disabled={exporting}
        className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5"
        style={{ backgroundColor: colors.info, opacity: exporting ? 0.7 : 1 }}
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
