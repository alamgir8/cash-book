import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { usePathname } from "expo-router";
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

/** Main tab roots only — hide the banner on add/edit/detail/modals to free space. */
const MAIN_TAB_PATHS = new Set([
  "/",
  "/index",
  "/accounts",
  "/transactions",
  "/shop",
  "/shop/index",
  "/settings",
]);

function normalizeAppPath(pathname: string): string {
  const raw = (pathname || "/").split("?")[0] || "/";
  // Drop expo-router groups like /(app)
  const noGroups = raw.replace(/\/\([^/]+\)/g, "");
  const cleaned = noGroups.replace(/\/+/g, "/") || "/";
  if (cleaned.length > 1 && cleaned.endsWith("/")) {
    return cleaned.slice(0, -1);
  }
  return cleaned || "/";
}

export function isMainTabPath(pathname: string): boolean {
  return MAIN_TAB_PATHS.has(normalizeAppPath(pathname));
}

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
 * Shown only on main tab screens (Home / Accounts / Transactions / Shop / Settings).
 */
export function OfflineBanner() {
  const pathname = usePathname();
  const onMainTab = isMainTabPath(pathname);
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
   * a precise reason instead of a silent no-op, and surfaces the sync result.
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
    setState("syncing");
    try {
      const reachable = await probeBackendAvailable(4000);
      if (!reachable) {
        toast.error(t("backendDownKeepWorking"));
        setBackendOk(false);
        setState("server_unavailable");
        return;
      }
      setBackendOk(true);
      toast.info(t("syncStarted"));
      const result = await requestSyncNow();
      await refresh();
      if (result.ok) {
        toast.success(
          result.pushed || result.pulled
            ? t("syncSucceeded")
            : t("upToDate"),
          result.pushed || result.pulled
            ? `↑${result.pushed} ↓${result.pulled}`
            : undefined,
        );
      } else if (result.error && result.error !== "Cloud sync disabled") {
        toast.error(
          t("syncFailedKeepWorking"),
          result.error.length > 160
            ? `${result.error.slice(0, 160)}…`
            : result.error,
        );
      } else {
        toast.error(t("syncFailedKeepWorking"));
      }
    } catch {
      toast.error(t("syncFailedKeepWorking"));
      await refresh();
    } finally {
      setRetrying(false);
    }
  }, [retrying, deviceOnline, cloudSync, refresh, t]);

  const syncText = messageFor(state, pending, t);
  const text = syncText || storageMessage;
  // Only the five main tabs — hide on add/edit/detail so forms keep vertical space.
  if (!onMainTab) return null;
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
