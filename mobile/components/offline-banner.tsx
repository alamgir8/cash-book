import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useTheme } from "@/hooks/use-theme";
import {
  isLocalFirstEnabled,
  subscribeLocalFirstFlags,
} from "@/lib/local-first/flags";

/**
 * Shown when local-first is on and the device is offline.
 * Changes remain on-device until sync/connectivity returns.
 */
export function OfflineBanner() {
  const { colors } = useTheme();
  const [localFirst, setLocalFirst] = useState(isLocalFirstEnabled());
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    return subscribeLocalFirstFlags((flags) => {
      setLocalFirst(flags.localFirstEnabled);
    });
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const connected =
        state.isConnected === true && state.isInternetReachable !== false;
      setOffline(!connected);
    });
    return unsub;
  }, []);

  if (!localFirst || !offline) return null;

  return (
    <View
      style={{
        backgroundColor: colors.warning,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text
        style={{
          color: "#111827",
          fontSize: 13,
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        Offline — changes saved on this device
      </Text>
    </View>
  );
}
