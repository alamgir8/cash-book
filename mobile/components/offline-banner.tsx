import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useTheme } from "@/hooks/use-theme";
import {
  isCloudSyncEnabled,
  isLocalFirstEnabled,
  subscribeLocalFirstFlags,
} from "@/lib/local-first/flags";
import {
  resolveSyncUiState,
  type SyncUiState,
} from "@/sync/pending";
import { probeBackendAvailable } from "@/sync/scheduler";

function messageFor(state: SyncUiState, pending: number): string | null {
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
      return "Syncing…";
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
  const [localFirst, setLocalFirst] = useState(isLocalFirstEnabled());
  const [cloudSync, setCloudSync] = useState(isCloudSyncEnabled());
  const [deviceOnline, setDeviceOnline] = useState(true);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [state, setState] = useState<SyncUiState>("hidden");
  const [pending, setPending] = useState(0);

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

  useEffect(() => {
    if (!localFirst) return;
    let cancelled = false;

    const refresh = async () => {
      let backend: boolean | null = null;
      if (deviceOnline && cloudSync) {
        backend = await probeBackendAvailable(3500);
        if (cancelled) return;
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
      if (cancelled) return;
      setState(resolved.state);
      setPending(resolved.pending);
    };

    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [localFirst, cloudSync, deviceOnline]);

  const text = messageFor(state, pending);
  if (!text) return null;

  const bg =
    state === "failed" || state === "server_unavailable"
      ? colors.error
      : state === "syncing" || state === "pending"
        ? colors.primary
        : colors.warning;
  const fg =
    state === "failed" ||
    state === "server_unavailable" ||
    state === "syncing" ||
    state === "pending"
      ? "#fff"
      : "#111827";

  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: 13,
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        {text}
      </Text>
    </View>
  );
}
