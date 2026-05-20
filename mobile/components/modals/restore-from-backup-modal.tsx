/**
 * RestoreFromBackupModal
 *
 * Shown automatically when the user logs in on a fresh device that has no
 * local auto-backup but the server already contains data (transactions,
 * accounts, etc.).  Gives the user three choices:
 *   1. Import from a backup file (JSON)
 *   2. Skip — continue with server data as-is
 *   3. Dismiss and decide later
 */
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import { importBackupFromFile } from "@/services/backup";
import Toast from "react-native-toast-message";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

interface ServerDataSummary {
  accounts: number;
  transactions: number;
  categories: number;
  transfers: number;
}

interface RestoreFromBackupModalProps {
  visible: boolean;
  serverData: ServerDataSummary;
  onRestored: () => void;
  onSkip: () => void;
}

export function RestoreFromBackupModal({
  visible,
  serverData,
  onRestored,
  onSkip,
}: RestoreFromBackupModalProps) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const accentColor = "#10b981";
  const warnColor = "#f59e0b";

  const handleImport = async () => {
    try {
      setImporting(true);
      const result = await importBackupFromFile();
      if (!result?.summary) throw new Error("Invalid backup response");

      // Refresh all data
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });

      const { summary } = result;
      const parts: string[] = [];
      if (summary.accountsImported)
        parts.push(`${summary.accountsImported} accounts`);
      if (summary.transactionsImported)
        parts.push(`${summary.transactionsImported} transactions`);
      if (summary.categoriesImported)
        parts.push(`${summary.categoriesImported} categories`);

      Toast.show({
        type: "success",
        text1: "Backup restored ✅",
        text2: parts.join(", ") || "Data imported successfully",
        visibilityTime: 4000,
      });
      onRestored();
    } catch (e: any) {
      if (e?.message === "No file selected") return; // user cancelled picker
      Toast.show({
        type: "error",
        text1: "Restore failed",
        text2: e?.message || "Please try again",
        visibilityTime: 4000,
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
    >
      <View
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      >
        <View
          className="rounded-t-3xl px-6 pt-6 pb-10"
          style={{ backgroundColor: colors.bg.secondary }}
        >
          {/* Drag handle */}
          <View
            className="w-10 h-1 rounded-full self-center mb-5"
            style={{ backgroundColor: colors.border }}
          />

          {/* Icon + title */}
          <View className="items-center mb-5">
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-3"
              style={{ backgroundColor: warnColor + "18" }}
            >
              <Ionicons name="cloud-download" size={32} color={warnColor} />
            </View>
            <Text
              className="text-xl font-bold text-center"
              style={{ color: colors.text.primary }}
            >
              Restore from backup?
            </Text>
            <Text
              className="text-sm text-center mt-1.5 px-4"
              style={{ color: colors.text.secondary }}
            >
              This looks like a fresh device. Your account already has data on
              the server.
            </Text>
          </View>

          {/* Server data summary */}
          <View
            className="rounded-2xl p-4 mb-5 flex-row flex-wrap gap-3 justify-center"
            style={{ backgroundColor: warnColor + "10" }}
          >
            {serverData.accounts > 0 && (
              <DataPill
                icon="wallet-outline"
                count={serverData.accounts}
                label="Accounts"
                color={colors.info}
              />
            )}
            {serverData.transactions > 0 && (
              <DataPill
                icon="swap-horizontal-outline"
                count={serverData.transactions}
                label="Transactions"
                color={accentColor}
              />
            )}
            {serverData.categories > 0 && (
              <DataPill
                icon="pricetag-outline"
                count={serverData.categories}
                label="Categories"
                color="#8b5cf6"
              />
            )}
            {serverData.transfers > 0 && (
              <DataPill
                icon="arrow-forward-circle-outline"
                count={serverData.transfers}
                label="Transfers"
                color={warnColor}
              />
            )}
          </View>

          {/* Explanation */}
          <View
            className="rounded-2xl p-4 mb-5 flex-row items-start gap-3"
            style={{ backgroundColor: colors.bg.primary }}
          >
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.text.secondary}
            />
            <Text
              className="text-sm flex-1 leading-5"
              style={{ color: colors.text.secondary }}
            >
              If you have a backup file (from Google Drive or email), import it
              now to restore your full history. Otherwise, your server data is
              already accessible — no action needed.
            </Text>
          </View>

          {/* Actions */}
          <View className="gap-3">
            {/* Import from file */}
            <TouchableOpacity
              onPress={() => void handleImport()}
              disabled={importing}
              activeOpacity={0.75}
              className="flex-row items-center gap-4 rounded-2xl p-4"
              style={{
                backgroundColor: accentColor + "15",
                opacity: importing ? 0.6 : 1,
              }}
            >
              <View
                className="w-11 h-11 rounded-full items-center justify-center"
                style={{ backgroundColor: accentColor + "30" }}
              >
                {importing ? (
                  <ActivityIndicator size="small" color={accentColor} />
                ) : (
                  <Ionicons
                    name="document-attach-outline"
                    size={22}
                    color={accentColor}
                  />
                )}
              </View>
              <View className="flex-1">
                <Text
                  className="text-base font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  {importing ? "Importing…" : "Import from backup file"}
                </Text>
                <Text
                  className="text-sm mt-0.5"
                  style={{ color: colors.text.secondary }}
                >
                  Select a .json backup from Files, Drive or email
                </Text>
              </View>
              {!importing && (
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.text.secondary}
                />
              )}
            </TouchableOpacity>

            {/* Skip */}
            <TouchableOpacity
              onPress={onSkip}
              disabled={importing}
              activeOpacity={0.75}
              className="flex-row items-center justify-center rounded-2xl p-4"
              style={{
                backgroundColor: colors.bg.primary,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: importing ? 0.5 : 1,
              }}
            >
              <Text
                className="text-base font-medium"
                style={{ color: colors.text.secondary }}
              >
                Skip — use server data as-is
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DataPill({
  icon,
  count,
  label,
  color,
}: {
  icon: any;
  count: number;
  label: string;
  color: string;
}) {
  return (
    <View className="items-center gap-1">
      <View
        className="w-10 h-10 rounded-full items-center justify-center"
        style={{ backgroundColor: color + "20" }}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text className="text-sm font-bold" style={{ color }}>
        {count}
      </Text>
      <Text className="text-xs" style={{ color: "#6b7280" }}>
        {label}
      </Text>
    </View>
  );
}
