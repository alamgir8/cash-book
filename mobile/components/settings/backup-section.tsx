import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  return (
    <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg">
      <View className="flex-row items-center gap-4 mb-4">
        <View className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full items-center justify-center">
          <Ionicons name="cloud" size={28} color="#3b82f6" />
        </View>
        <View className="flex-1">
          <Text className="text-gray-900 text-xl font-bold">
            Backup & Restore
          </Text>
          <Text className="text-gray-600 text-sm mt-1">
            Save or restore your complete data
          </Text>
        </View>
      </View>

      <View className="bg-blue-50 rounded-2xl p-4 mb-4">
        <View className="flex-row items-start gap-3">
          <Ionicons name="information-circle" size={20} color="#3b82f6" />
          <Text className="text-blue-800 text-sm flex-1">
            Backup exports all your accounts, categories, transactions, and
            transfers as a JSON file that you can save and restore later.
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <TouchableOpacity
          onPress={onBackup}
          disabled={backingUp}
          className="flex-row items-center gap-4 bg-blue-50 rounded-2xl p-4 active:scale-98"
          style={{ opacity: backingUp ? 0.7 : 1 }}
        >
          <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center">
            {backingUp ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <Ionicons name="cloud-upload" size={24} color="#3b82f6" />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 font-bold text-base">
              {backingUp ? "Creating Backup..." : "Create Backup"}
            </Text>
            <Text className="text-gray-600 text-sm">
              Export all data to JSON file
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onRestore}
          disabled={restoring}
          className="flex-row items-center gap-4 bg-amber-50 rounded-2xl p-4 active:scale-98"
          style={{ opacity: restoring ? 0.7 : 1 }}
        >
          <View className="w-12 h-12 bg-amber-100 rounded-full items-center justify-center">
            {restoring ? (
              <ActivityIndicator size="small" color="#f59e0b" />
            ) : (
              <Ionicons name="cloud-download" size={24} color="#f59e0b" />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 font-bold text-base">
              {restoring ? "Restoring..." : "Restore Backup"}
            </Text>
            <Text className="text-gray-600 text-sm">
              Import data from JSON file
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
