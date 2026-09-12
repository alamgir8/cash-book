import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";
import { toast } from "@/lib/toast";
import {
  isCloudSyncEnabled,
  isLocalFirstEnabled,
  subscribeLocalFirstFlags,
} from "@/lib/local-first/flags";
import {
  resolveSyncUiState,
  type SyncUiState,
} from "@/sync/pending";
import {
  probeBackendAvailable,
  requestSyncNow,
} from "@/sync/scheduler";

/**
 * States where a manual retry makes sense. "syncing" is excluded (already
 * running) and storage-only messages get no button (nothing to sync).
 */
const RETRYABLE: SyncUiState[] = [
  "offline",
  "server_unavailable",
  "pending",
  "failed",
  "synced",
];

function messageFor(
  state: SyncUiState,
  pending: number,
  t: (key: any) => string,
): string | null {
  switch (state) {
    case "offline":
      return pending > 0
        ? `Offline — ${pending} change${pending === 1 ? "" : "s"} saved on this device`
        : "Offline — changes saved on this device";
    case "server_unavailable":
      return pending > 0
        ? `Server unavailable — ${pending} pending`
        : "Server unavailable — working offline";
    case "syncing":
      return t("syncingNow");
    case "pending":
      return `${pending} change${pending === 1 ? "" : "s"} waiting to sync`;
    case "failed":
      return pending > 0
        ? `Sync failed — ${pending} pending (will retry)`
        : "Sync failed — will retry";
    case "synced":
    case "hidden":
    default:
      return null;
  }
}

/**
 * Non-blocking status strip for local-first mode.
 * Distinguishes device offline vs backend unavailable vs pending sync.
 */
export function OfflineBanner() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [localFirst, setLocalFirst] = useState(isLocalFirstEnabled());
  const [cloudSync, setCloudSync] = useState(isCloudSyncEnabled());
  const [deviceOnline, setDeviceOnline] = useState(true);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [state, setState] = useState<SyncUiState>("hidden");
  const [pending, setPending] = useState(0);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    return subscribeLocalFirstFlags((flags) => {
      setLocalFirst(flags.localFirstEnabled);
      setCloudSync(flags.localFirstEnabled && flags.cloudSyncEnabled);
    });
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((net) => {
      const online =
        net.isConnected === true && net.isInternetReachable !== false;
      setDeviceOnline(online);
    });
    return unsub;
  }, []);

  const refresh = useCallback(async () => {
    let backend: boolean | null = null;
    if (deviceOnline && cloudSync) {
      backend = await probeBackendAvailable(3500);
      setBackendOk(backend);
    } else if (!deviceOnline) {
      setBackendOk(null);
    }

    const resolved = await resolveSyncUiState({
      localFirst,
      cloudSync,
      deviceOnline,
      backendOk: backend,
      syncing: false,
    });
    setState(resolved.state);
    setPending(resolved.pending);

    try {
      const { getLocalStorageReport } = await import(
        "@/lib/local-first/storage-monitor"
      );
      const report = await getLocalStorageReport();
      setStorageMessage(
        report.stalledSync ||
          report.level === "strong" ||
          report.level === "critical"
          ? report.message
          : null,
      );
    } catch {
      setStorageMessage(null);
    }
  }, [localFirst, cloudSync, deviceOnline]);

  useEffect(() => {
    if (!localFirst) return;
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      await refresh();
    };

    void run();
    const id = setInterval(() => {
      void run();
    }, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [localFirst, refresh]);

  /**
   * Manual retry from the banner. Verifies reachability first so the user gets
   * a precise reason instead of a silent no-op, and never blocks their work.
   */
  const handleRetry = useCallback(async () => {
    if (retrying) return;

    if (!deviceOnline) {
      toast.info(t("deviceOfflineKeepWorking"));
      return;
    }
    if (!cloudSync) {
      toast.info(t("backendDownKeepWorking"));
      return;
    }

    setRetrying(true);
    try {
      const reachable = await probeBackendAvailable(4000);
      if (!reachable) {
        toast.error(t("backendDownKeepWorking"));
        return;
      }
      toast.info(t("syncStarted"));
      await requestSyncNow();
      await refresh();
    } catch {
      toast.error(t("syncFailedKeepWorking"));
    } finally {
      setRetrying(false);
    }
  }, [retrying, deviceOnline, cloudSync, refresh, t]);

  const syncText = messageFor(state, pending, t);
  const text = syncText || storageMessage;
  if (!text) return null;

  const storageOnly = !syncText && Boolean(storageMessage);
  const showRetry = !storageOnly && RETRYABLE.includes(state) && cloudSync;
  // Rose (not hard red) for failed / unavailable / storage pressure.
  const bg =
    state === "failed" || state === "server_unavailable" || storageOnly
      ? colors.error
      : state === "syncing" || state === "pending"
        ? colors.primary
        : colors.warning;
  const fg =
    state === "failed" ||
    state === "server_unavailable" ||
    state === "syncing" ||
    state === "pending" ||
    storageOnly
      ? "#fff"
      : "#111827";

  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: 13,
          fontWeight: "600",
          flex: 1,
        }}
        numberOfLines={2}
      >
        {text}
      </Text>

      {showRetry ? (
        <TouchableOpacity
          onPress={handleRetry}
          disabled={retrying}
          accessibilityRole="button"
          accessibilityLabel={t("retrySync")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            // Subtle chip that reads on both dark and light banner colors.
            backgroundColor:
              fg === "#fff" ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.08)",
            borderWidth: 1,
            borderColor:
              fg === "#fff" ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.15)",
            opacity: retrying ? 0.7 : 1,
          }}
        >
          {retrying ? (
            <ActivityIndicator size="small" color={fg} />
          ) : (
            <Ionicons name="refresh" size={13} color={fg} />
          )}
          <Text style={{ color: fg, fontSize: 12, fontWeight: "700" }}>
            {retrying ? t("syncingNow") : t("retrySync")}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
