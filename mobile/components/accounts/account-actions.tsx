import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

type AccountActionsProps = {
  onEdit: () => void;
  onExport: () => void;
};

export function AccountActions({ onEdit, onExport }: AccountActionsProps) {
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
        className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5"
        style={{ backgroundColor: colors.info }}
      >
        <Ionicons name="download-outline" size={18} color="#fff" />
        <Text className="text-white font-semibold">Export</Text>
        <Ionicons name="chevron-down" size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
