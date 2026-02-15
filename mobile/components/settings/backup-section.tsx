import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

interface BackupSectionProps {
  backingUp: boolean;
  restoring: boolean;
  onBackup: () => void;
  onRestore: () => void;
}

export function BackupSection({
  backingUp,
  restoring,
  onBackup,
  onRestore,
}: BackupSectionProps) {
  const { colors } = useTheme();

  return (
    <View
      className="rounded-3xl p-6 border shadow-lg"
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center gap-4 mb-4">
        <View
          className="w-14 h-14 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.info + "15" }}
        >
          <Ionicons name="cloud" size={28} color={colors.info} />
        </View>
        <View className="flex-1">
          <Text
            className="text-xl font-bold"
            style={{ color: colors.text.primary }}
          >
            Backup & Restore
          </Text>
          <Text
            className="text-sm mt-1"
            style={{ color: colors.text.secondary }}
          >
            Save or restore your complete data
          </Text>
        </View>
      </View>

      <View
        className="rounded-2xl p-4 mb-4"
        style={{ backgroundColor: colors.info + "10" }}
      >
        <View className="flex-row items-start gap-3">
          <Ionicons name="information-circle" size={20} color={colors.info} />
          <Text className="text-sm flex-1" style={{ color: colors.info }}>
            Backup exports all your accounts, categories, transactions, and
            transfers as a JSON file that you can save and restore later.
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <TouchableOpacity
          onPress={onBackup}
          disabled={backingUp}
          className="flex-row items-center gap-4 rounded-2xl p-4 active:scale-98"
          style={{
            backgroundColor: colors.info + "15",
            opacity: backingUp ? 0.7 : 1,
          }}
        >
          <View
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.info + "30" }}
          >
            {backingUp ? (
              <ActivityIndicator size="small" color={colors.info} />
            ) : (
              <Ionicons name="cloud-upload" size={24} color={colors.info} />
            )}
          </View>
          <View className="flex-1">
            <Text
              className="font-bold text-base"
              style={{ color: colors.text.primary }}
            >
              {backingUp ? "Creating Backup..." : "Create Backup"}
            </Text>
            <Text className="text-sm" style={{ color: colors.text.secondary }}>
              Export all data to JSON file
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.text.tertiary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onRestore}
          disabled={restoring}
          className="flex-row items-center gap-4 rounded-2xl p-4 active:scale-98"
          style={{
            backgroundColor: colors.warning + "15",
            opacity: restoring ? 0.7 : 1,
          }}
        >
          <View
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.warning + "30" }}
          >
            {restoring ? (
              <ActivityIndicator size="small" color={colors.warning} />
            ) : (
              <Ionicons
                name="cloud-download"
                size={24}
                color={colors.warning}
              />
            )}
          </View>
          <View className="flex-1">
            <Text
              className="font-bold text-base"
              style={{ color: colors.text.primary }}
            >
              {restoring ? "Restoring..." : "Restore Backup"}
            </Text>
            <Text className="text-sm" style={{ color: colors.text.secondary }}>
              Import data from JSON file
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.text.tertiary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
