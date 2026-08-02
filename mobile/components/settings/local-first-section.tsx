import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Alert,
  Modal,
  TextInput,
  FlatList,
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
  getDriveAccessToken,
  listDriveBackupDates,
  restoreFromDriveFile,
  uploadDatedDriveBackup,
  type DriveBackupEntry,
} from "@/services/drive-backup";
import {
  clearDriveSession,
  hasGoogleOAuthConfigured,
  persistDriveAccessToken,
} from "@/services/drive-auth";
import { maybeUploadDriveBackup } from "@/services/drive-scheduler";
import { DriveGoogleConnectButton } from "@/components/settings/drive-google-connect-button";
import { useAuth } from "@/hooks/use-auth";
import { warmLocalFirstRuntime } from "@/lib/local-first/warm";
import { queryClient } from "@/lib/queryClient";
import Toast from "react-native-toast-message";

async function refreshLocalQueries() {
  await queryClient.invalidateQueries();
}

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
  const [tokenModal, setTokenModal] = useState(false);
  const [tokenDraft, setTokenDraft] = useState("");
  const [restoreModal, setRestoreModal] = useState(false);
  const [driveEntries, setDriveEntries] = useState<DriveBackupEntry[]>([]);
  const [lastDriveAt, setLastDriveAt] = useState<string | null>(null);
  const [lastDrivePath, setLastDrivePath] = useState<string | null>(null);
  const [lastDriveError, setLastDriveError] = useState<string | null>(null);
  const oauthReady = hasGoogleOAuthConfigured();

  useEffect(() => {
    loadLocalFirstFlags().then(setFlags);
    return subscribeLocalFirstFlags(setFlags);
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!flags.localFirstEnabled) return;
    try {
      const { getDb } = await import("@/db/client");
      const { getMeta, META_KEYS } = await import("@/db/meta");
      const db = await getDb();
      const s = await getSyncStatus();
      setSyncInfo({ lastSyncAt: s.lastSyncAt, lastError: s.lastError });
      setDriveConnected(Boolean(await getDriveAccessToken()));
      setLastDriveAt(await getMeta(db, META_KEYS.LAST_DRIVE_BACKUP_AT));
      setLastDrivePath(await getMeta(db, META_KEYS.LAST_DRIVE_PATH));
      setLastDriveError(await getMeta(db, META_KEYS.LAST_DRIVE_ERROR));
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

  const runMigrate = useCallback(
    async (force = false) => {
      setBusy("migrate");
      try {
        await warmLocalFirstRuntime();
        const result = await migrateCloudToLocal({ force });
        if (!result.migrated) {
          Toast.show({ type: "info", text1: "Already migrated" });
        } else {
          await refreshLocalQueries();
          Toast.show({
            type: "success",
            text1: "Migration complete",
            text2: `${result.summary?.transactionsCount ?? 0} transactions now on this device`,
          });
          // Best-effort Drive snapshot after migrate (if connected).
          void maybeUploadDriveBackup("post-migrate").then((r) => {
            if (r.ok) {
              Toast.show({
                type: "success",
                text1: "Drive backup uploaded",
                text2: r.path,
              });
            }
          });
        }
        const next = await loadLocalFirstFlags();
        setFlags(next);
        await refreshStatus();
      } catch (e: any) {
        Toast.show({
          type: "error",
          text1: "Migration failed",
          text2:
            e?.response?.data?.message ||
            e?.message ||
            "Check you are logged in and online",
        });
      } finally {
        setBusy(null);
      }
    },
    [refreshStatus],
  );

  const toggle = async (key: keyof LocalFirstFlags, value: boolean) => {
    if (key === "migrationCompletedAt") return;

    if (key === "localFirstEnabled" && value) {
      const next = await setLocalFirstFlags({
        localFirstEnabled: true,
        // Dual-write keeps every save on the network — off by default for real offline use.
        dualWriteEnabled: false,
      });
      setFlags(next);
      void warmLocalFirstRuntime().catch(() => {});
      if (!next.migrationCompletedAt) {
        Alert.alert(
          "Download your data?",
          "On-device mode is on, but this phone has no local copy yet. Migrate from cloud once — after that Home/Accounts/Ledger read SQLite (offline).",
          [
            { text: "Later", style: "cancel" },
            { text: "Migrate now", onPress: () => void runMigrate(false) },
          ],
        );
      } else {
        await refreshLocalQueries();
      }
      return;
    }

    const next = await setLocalFirstFlags({ [key]: value } as any);
    setFlags(next);
    if (key === "localFirstEnabled" && !value) {
      await refreshLocalQueries();
    }
  };

  const onMigrate = () => {
    const already = Boolean(flags.migrationCompletedAt);
    Alert.alert(
      already ? "Re-download from cloud?" : "Switch to on-device storage",
      already
        ? "This replaces local personal data with a fresh cloud export."
        : "Download your cloud data into this phone. After this, lists load from local storage — not Mongo.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: already ? "Re-migrate" : "Migrate",
          style: already ? "destructive" : "default",
          onPress: () => {
            void (async () => {
              if (already) {
                const { requireDeviceAuth } = await import(
                  "@/lib/local-first/secure-gate"
                );
                const ok = await requireDeviceAuth(
                  "Authenticate to replace local data",
                );
                if (!ok) return;
              }
              await runMigrate(already);
            })();
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
      const msg = String(e?.message || "Upload failed");
      Toast.show({
        type: "error",
        text1: "Drive upload failed",
        text2: msg.slice(0, 160),
        visibilityTime: 6000,
      });
    } finally {
      setBusy(null);
    }
  };

  const openDriveRestorePicker = async () => {
    setBusy("drive-restore");
    try {
      const entries = await listDriveBackupDates(String(userKey));
      if (!entries.length) {
        Toast.show({
          type: "info",
          text1: "No Drive backups found",
          text2: "Upload a dated backup first",
        });
        return;
      }
      setDriveEntries(entries);
      setRestoreModal(true);
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

  const confirmRestoreEntry = (entry: DriveBackupEntry) => {
    Alert.alert(
      "Restore from Drive?",
      `${entry.fileName}\n\nThis replaces local personal data on this phone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            const { requireDeviceAuth } = await import(
              "@/lib/local-first/secure-gate"
            );
            const ok = await requireDeviceAuth(
              "Authenticate to restore from Drive",
            );
            if (!ok) {
              Toast.show({
                type: "info",
                text1: "Restore cancelled",
                text2: "Authentication required",
              });
              return;
            }
            setBusy("drive-restore");
            setRestoreModal(false);
            try {
              await restoreFromDriveFile(entry.fileId);
              await refreshLocalQueries();
              Toast.show({ type: "success", text1: "Drive restore done" });
            } catch (e: any) {
              Toast.show({
                type: "error",
                text1: "Restore failed",
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

  const onManageDrive = () => {
    Alert.alert(
      driveConnected ? "Google Drive" : "Connect Google Drive",
      "Backups stay in your Google account — we don’t host them.\n\nDevice backups / Share latest file are separate (phone only).\n\nTip: Expo Go may block Google OAuth; a development build works best. Paste token is a fallback.",
      [
        { text: "Cancel", style: "cancel" },
        ...(driveConnected
          ? [
              {
                text: "Disconnect",
                style: "destructive" as const,
                onPress: async () => {
                  await clearDriveSession();
                  setDriveConnected(false);
                },
              },
            ]
          : [
              {
                text: "Paste token",
                onPress: async () => {
                  const { requireDeviceAuth } = await import(
                    "@/lib/local-first/secure-gate"
                  );
                  const ok = await requireDeviceAuth(
                    "Authenticate to connect Google Drive",
                  );
                  if (!ok) return;
                  setTokenModal(true);
                },
              },
            ]),
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
            Offline-first on this phone. Cloud sync and Drive are optional
            backups — lists always read SQLite when this is on.
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
      {flags.localFirstEnabled &&
      (flags.cloudSyncEnabled || flags.driveBackupEnabled) ? (
        <Text className="text-xs mb-2" style={{ color: colors.text.secondary }}>
          Auto: once per local day (after midnight) when you open the app —
          Mongo sync and/or Drive backup, depending on toggles above.
        </Text>
      ) : null}
      <Row
        label="Dual-write (keeps using API)"
        value={flags.dualWriteEnabled}
        onValueChange={(v) => toggle("dualWriteEnabled", v)}
        disabled={!flags.localFirstEnabled}
      />

      {flags.localFirstEnabled && !flags.migrationCompletedAt ? (
        <View
          className="rounded-xl p-3 mb-3"
          style={{ backgroundColor: colors.warning + "22" }}
        >
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.warning }}
          >
            Not migrated yet
          </Text>
          <Text className="text-xs mt-1" style={{ color: colors.text.secondary }}>
            Toggles alone do not copy cloud data. Tap “Migrate from cloud” once
            — until then local DB is empty and screens look like they are still
            loading.
          </Text>
        </View>
      ) : null}

      {flags.migrationCompletedAt ? (
        <Text className="text-xs mb-2" style={{ color: colors.success }}>
          Local copy ready · Migrated {flags.migrationCompletedAt}
        </Text>
      ) : null}
      {flags.migrationCompletedAt ? (
        <Text className="text-xs mb-2" style={{ color: colors.text.secondary }}>
          Missing rows / wrong balances / empty vendor-for-notes? Switch to your
          organization (if books are org-scoped), then “Re-download from cloud”.
        </Text>
      ) : null}
      {flags.dualWriteEnabled ? (
        <Text className="text-xs mb-2" style={{ color: colors.warning }}>
          Dual-write is ON — every save still hits the server (dogfood only).
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
      <Text className="text-xs mb-1" style={{ color: colors.text.secondary }}>
        Drive API: {driveConnected ? "connected" : "not connected"}
        {lastDriveAt ? ` · Last upload ${lastDriveAt}` : ""}
      </Text>
      {lastDrivePath ? (
        <Text className="text-xs mb-1" style={{ color: colors.success }}>
          Drive path: {lastDrivePath}
        </Text>
      ) : null}
      {lastDriveError ? (
        <Text className="text-xs mb-2" style={{ color: colors.error }}>
          Drive error: {lastDriveError}
        </Text>
      ) : null}
      <Text className="text-xs mb-4" style={{ color: colors.text.secondary }}>
        Look in My Drive → HisabBoi → backups. JSON on-phone files are under
        “Device backups” above. Org books stay on cloud in v1.
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
          label="Sync now (Mongo)"
          onPress={onSync}
          busy={busy === "sync"}
          disabled={!flags.cloudSyncEnabled}
        />
        <Text
          className="text-xs font-semibold mt-2"
          style={{ color: colors.text.secondary }}
        >
          Google Drive (API — separate from Share latest file)
        </Text>
        {oauthReady ? (
          <DriveGoogleConnectButton
            colors={colors}
            busy={busy === "drive-auth"}
            connected={driveConnected}
            onConnected={() => {
              setDriveConnected(true);
              void refreshStatus();
            }}
            onPasteToken={() => setTokenModal(true)}
            onDisconnect={onManageDrive}
          />
        ) : (
          <Action
            colors={colors}
            icon="key"
            label="Connect Google Drive (token)"
            onPress={() => setTokenModal(true)}
          />
        )}
        <Action
          colors={colors}
          icon="information-circle"
          label="Drive help / disconnect"
          onPress={onManageDrive}
        />
        <Action
          colors={colors}
          icon="logo-google"
          label="Upload dated Drive backup"
          onPress={onDriveUpload}
          busy={busy === "drive"}
          disabled={!flags.driveBackupEnabled || !driveConnected}
        />
        <Action
          colors={colors}
          icon="download"
          label="Restore from Drive (pick date)"
          onPress={openDriveRestorePicker}
          busy={busy === "drive-restore"}
          disabled={!flags.driveBackupEnabled || !driveConnected}
        />
      </View>

      <Modal visible={restoreModal} transparent animationType="fade">
        <View
          className="flex-1 justify-center px-6"
          style={{ backgroundColor: "#00000088" }}
        >
          <View
            className="rounded-3xl p-5 max-h-[70%]"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <Text
              className="text-lg font-bold mb-1"
              style={{ color: colors.text.primary }}
            >
              Restore from Drive
            </Text>
            <Text
              className="text-xs mb-3"
              style={{ color: colors.text.secondary }}
            >
              Pick a dated backup. Checksum is verified before import.
            </Text>
            <FlatList
              data={driveEntries}
              keyExtractor={(item) => item.fileId}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="rounded-2xl p-3 mb-2"
                  style={{ backgroundColor: colors.bg.primary }}
                  onPress={() => confirmRestoreEntry(item)}
                >
                  <Text
                    className="font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {item.date}
                  </Text>
                  <Text
                    className="text-xs mt-0.5"
                    style={{ color: colors.text.secondary }}
                    numberOfLines={1}
                  >
                    {item.fileName}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              className="rounded-2xl py-3 items-center mt-2"
              style={{ backgroundColor: colors.bg.primary }}
              onPress={() => setRestoreModal(false)}
            >
              <Text style={{ color: colors.text.secondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={tokenModal} transparent animationType="fade">
        <View
          className="flex-1 justify-center px-6"
          style={{ backgroundColor: "#00000088" }}
        >
          <View
            className="rounded-3xl p-5"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <Text
              className="text-lg font-bold mb-2"
              style={{ color: colors.text.primary }}
            >
              Paste Drive access token
            </Text>
            <Text
              className="text-xs mb-3"
              style={{ color: colors.text.secondary }}
            >
              Short-lived Google OAuth token with drive.file scope. Or set
              EXPO_PUBLIC_GOOGLE_*_CLIENT_ID in .env.local for Sign in with
              Google.
            </Text>
            <TextInput
              value={tokenDraft}
              onChangeText={setTokenDraft}
              placeholder="ya29...."
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              style={{
                minHeight: 88,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 12,
                color: colors.text.primary,
                textAlignVertical: "top",
              }}
            />
            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                className="flex-1 rounded-2xl py-3 items-center"
                style={{ backgroundColor: colors.bg.primary }}
                onPress={() => {
                  setTokenModal(false);
                  setTokenDraft("");
                }}
              >
                <Text style={{ color: colors.text.secondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 rounded-2xl py-3 items-center"
                style={{ backgroundColor: colors.info }}
                onPress={async () => {
                  if (await persistDriveAccessToken(tokenDraft)) {
                    setDriveConnected(true);
                    setTokenModal(false);
                    setTokenDraft("");
                    Toast.show({
                      type: "success",
                      text1: "Drive connected",
                      text2: "Tap Upload dated Drive backup",
                    });
                  }
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
