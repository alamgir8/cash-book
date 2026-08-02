import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import {
  getLocalFirstFlagsSync,
  loadLocalFirstFlags,
  setLocalFirstFlags,
  subscribeLocalFirstFlags,
  type LocalFirstFlags,
} from "@/lib/local-first/flags";
import { migrateCloudToLocal } from "@/services/migrate-cloud";
import { runSync, getSyncStatus } from "@/sync/engine";
import {
  exportAndShareLocalBackup,
  importBackupFromPicker,
} from "@/services/local-backup";
import {
  getDriveAccessToken,
  listDriveBackupDates,
  restoreFromDriveFile,
  setDriveAccessToken,
  uploadDatedDriveBackup,
  DRIVE_OAUTH_SCOPE,
} from "@/services/drive-backup";
import { useAuth } from "@/hooks/use-auth";
import Toast from "react-native-toast-message";
import * as WebBrowser from "expo-web-browser";

export function LocalFirstSection() {
  const { colors } = useTheme();
  const { state: authState } = useAuth();
  const [flags, setFlags] = useState<LocalFirstFlags>(getLocalFirstFlagsSync());
  const [busy, setBusy] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<{
    lastSyncAt: string | null;
    lastError: string | null;
  }>({ lastSyncAt: null, lastError: null });
  const [driveConnected, setDriveConnected] = useState(false);

  useEffect(() => {
    loadLocalFirstFlags().then(setFlags);
    return subscribeLocalFirstFlags(setFlags);
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!flags.localFirstEnabled) return;
    try {
      const { getDb } = await import("@/db/client");
      await getDb();
      const s = await getSyncStatus();
      setSyncInfo({ lastSyncAt: s.lastSyncAt, lastError: s.lastError });
      setDriveConnected(Boolean(await getDriveAccessToken()));
    } catch {
      /* db may not be ready */
    }
  }, [flags.localFirstEnabled]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const userKey =
    authState.status === "authenticated"
      ? (authState.user as any)?._id ||
        (authState.user as any)?.email ||
        "user"
      : "user";

  const toggle = async (key: keyof LocalFirstFlags, value: boolean) => {
    if (key === "migrationCompletedAt") return;
    const next = await setLocalFirstFlags({ [key]: value } as any);
    setFlags(next);
  };

  const onMigrate = () => {
    Alert.alert(
      "Switch to on-device storage",
      "Download your cloud data into this phone. You can keep using the app offline after this.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Migrate",
          onPress: async () => {
            setBusy("migrate");
            try {
              const result = await migrateCloudToLocal({ force: false });
              if (!result.migrated) {
                Toast.show({
                  type: "info",
                  text1: "Already migrated",
                });
              } else {
                Toast.show({
                  type: "success",
                  text1: "Migration complete",
                  text2: `${result.summary?.transactionsCount ?? 0} transactions`,
                });
              }
              await refreshStatus();
            } catch (e: any) {
              Toast.show({
                type: "error",
                text1: "Migration failed",
                text2: e?.message,
              });
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const onSync = async () => {
    setBusy("sync");
    try {
      const result = await runSync();
      if (result.ok) {
        Toast.show({
          type: "success",
          text1: "Synced",
          text2: `↑${result.pushed} ↓${result.pulled}`,
        });
      } else {
        Toast.show({
          type: "error",
          text1: "Sync failed",
          text2: result.error,
        });
      }
      await refreshStatus();
    } finally {
      setBusy(null);
    }
  };

  const onLocalBackup = async () => {
    setBusy("backup");
    try {
      await exportAndShareLocalBackup();
      Toast.show({ type: "success", text1: "Local backup ready" });
    } catch (e: any) {
      Toast.show({ type: "error", text1: "Backup failed", text2: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const onLocalRestore = async () => {
    setBusy("restore");
    try {
      const summary = await importBackupFromPicker();
      Toast.show({
        type: "success",
        text1: "Restored",
        text2: `${summary.transactionsCount} transactions`,
      });
    } catch (e: any) {
      if (e?.message !== "No file selected") {
        Toast.show({
          type: "error",
          text1: "Restore failed",
          text2: e?.message,
        });
      }
    } finally {
      setBusy(null);
    }
  };

  const onDriveUpload = async () => {
    setBusy("drive");
    try {
      const result = await uploadDatedDriveBackup(String(userKey));
      Toast.show({
        type: "success",
        text1: "Uploaded to Drive",
        text2: result.path,
      });
      await refreshStatus();
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Drive upload failed",
        text2: e?.message,
      });
    } finally {
      setBusy(null);
    }
  };

  const onDriveRestore = async () => {
    setBusy("drive-restore");
    try {
      const entries = await listDriveBackupDates(String(userKey));
      if (!entries.length) {
        Toast.show({ type: "info", text1: "No Drive backups found" });
        return;
      }
      const latest = entries[0];
      Alert.alert(
        "Restore from Drive",
        `Restore ${latest.fileName}? This replaces local personal data.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore",
            style: "destructive",
            onPress: async () => {
              try {
                await restoreFromDriveFile(latest.fileId);
                Toast.show({ type: "success", text1: "Drive restore done" });
              } catch (e: any) {
                Toast.show({
                  type: "error",
                  text1: "Restore failed",
                  text2: e?.message,
                });
              }
            },
          },
        ],
      );
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Drive list failed",
        text2: e?.message,
      });
    } finally {
      setBusy(null);
    }
  };

  const onConnectDriveHelp = async () => {
    Alert.alert(
      "Connect Google Drive",
      `1. Create OAuth client (iOS/Android) with scope:\n${DRIVE_OAUTH_SCOPE}\n2. Complete AuthSession and call setDriveAccessToken.\n\nFor dogfood you can paste a short-lived access token.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Google docs",
          onPress: () => {
            void WebBrowser.openBrowserAsync(
              "https://developers.google.com/drive/api/guides/api-specific-auth",
            );
          },
        },
        {
          text: "Clear token",
          style: "destructive",
          onPress: async () => {
            await setDriveAccessToken(null);
            setDriveConnected(false);
          },
        },
      ],
    );
  };

  const Row = ({
    label,
    value,
    onValueChange,
    disabled,
  }: {
    label: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
    disabled?: boolean;
  }) => (
    <View className="flex-row items-center justify-between py-3">
      <Text className="text-base flex-1 pr-3" style={{ color: colors.text.primary }}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled || Boolean(busy)}
      />
    </View>
  );

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
          style={{ backgroundColor: colors.success + "15" }}
        >
          <Ionicons name="phone-portrait" size={28} color={colors.success} />
        </View>
        <View className="flex-1">
          <Text
            className="text-xl font-bold"
            style={{ color: colors.text.primary }}
          >
            On-device storage
          </Text>
          <Text
            className="text-sm mt-1"
            style={{ color: colors.text.secondary }}
          >
            Local-first ledger (WhatsApp-style). Cloud sync optional.
          </Text>
        </View>
      </View>

      <Row
        label="Use on-device database"
        value={flags.localFirstEnabled}
        onValueChange={(v) => toggle("localFirstEnabled", v)}
      />
      <Row
        label="Cloud sync"
        value={flags.cloudSyncEnabled}
        onValueChange={(v) => toggle("cloudSyncEnabled", v)}
        disabled={!flags.localFirstEnabled}
      />
      <Row
        label="Google Drive backups"
        value={flags.driveBackupEnabled}
        onValueChange={(v) => toggle("driveBackupEnabled", v)}
        disabled={!flags.localFirstEnabled}
      />
      <Row
        label="Dual-write (dogfood)"
        value={flags.dualWriteEnabled}
        onValueChange={(v) => toggle("dualWriteEnabled", v)}
        disabled={!flags.localFirstEnabled}
      />

      {flags.migrationCompletedAt ? (
        <Text className="text-xs mb-2" style={{ color: colors.text.secondary }}>
          Migrated: {flags.migrationCompletedAt}
        </Text>
      ) : null}
      {syncInfo.lastSyncAt ? (
        <Text className="text-xs mb-2" style={{ color: colors.text.secondary }}>
          Last sync: {syncInfo.lastSyncAt}
        </Text>
      ) : null}
      {syncInfo.lastError ? (
        <Text className="text-xs mb-2" style={{ color: colors.error }}>
          Sync error: {syncInfo.lastError}
        </Text>
      ) : null}
      <Text className="text-xs mb-4" style={{ color: colors.text.secondary }}>
        Drive: {driveConnected ? "connected" : "not connected"} · Org books stay
        on cloud in v1
      </Text>

      <View className="gap-3">
        <Action
          colors={colors}
          icon="cloud-download"
          label="Migrate from cloud"
          onPress={onMigrate}
          busy={busy === "migrate"}
        />
        <Action
          colors={colors}
          icon="sync"
          label="Sync now"
          onPress={onSync}
          busy={busy === "sync"}
          disabled={!flags.cloudSyncEnabled}
        />
        <Action
          colors={colors}
          icon="save"
          label="Export local backup"
          onPress={onLocalBackup}
          busy={busy === "backup"}
          disabled={!flags.localFirstEnabled}
        />
        <Action
          colors={colors}
          icon="folder-open"
          label="Restore local backup"
          onPress={onLocalRestore}
          busy={busy === "restore"}
          disabled={!flags.localFirstEnabled}
        />
        <Action
          colors={colors}
          icon="logo-google"
          label="Upload dated Drive backup"
          onPress={onDriveUpload}
          busy={busy === "drive"}
          disabled={!flags.driveBackupEnabled}
        />
        <Action
          colors={colors}
          icon="download"
          label="Restore latest from Drive"
          onPress={onDriveRestore}
          busy={busy === "drive-restore"}
          disabled={!flags.driveBackupEnabled}
        />
        <Action
          colors={colors}
          icon="key"
          label="Drive connection help"
          onPress={onConnectDriveHelp}
        />
      </View>
    </View>
  );
}

function Action({
  colors,
  icon,
  label,
  onPress,
  busy,
  disabled,
}: {
  colors: any;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      className="flex-row items-center gap-4 rounded-2xl p-4"
      style={{
        backgroundColor: colors.info + "15",
        opacity: disabled || busy ? 0.5 : 1,
      }}
    >
      <View
        className="w-12 h-12 rounded-full items-center justify-center"
        style={{ backgroundColor: colors.info + "25" }}
      >
        {busy ? (
          <ActivityIndicator color={colors.info} />
        ) : (
          <Ionicons name={icon} size={22} color={colors.info} />
        )}
      </View>
      <Text
        className="text-base font-semibold flex-1"
        style={{ color: colors.text.primary }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
