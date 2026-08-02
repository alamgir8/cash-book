import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Text,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import {
  hasGoogleOAuthConfigured,
  useGoogleDriveAuthRequest,
  usePersistGoogleDriveResponse,
} from "@/services/drive-auth";

type Props = {
  colors: any;
  busy?: boolean;
  onConnected: () => void;
  onPasteToken: () => void;
  onDisconnect: () => void;
  connected: boolean;
};

/**
 * Mount only when Google OAuth client IDs exist for this platform.
 * Isolates Google.useAuthRequest so Settings never crashes without IDs.
 */
export function DriveGoogleConnectButton({
  colors,
  busy,
  onConnected,
  onPasteToken,
  onDisconnect,
  connected,
}: Props) {
  if (!hasGoogleOAuthConfigured()) {
    return null;
  }

  return (
    <DriveGoogleConnectButtonInner
      colors={colors}
      busy={busy}
      onConnected={onConnected}
      onPasteToken={onPasteToken}
      onDisconnect={onDisconnect}
      connected={connected}
    />
  );
}

function DriveGoogleConnectButtonInner({
  colors,
  busy,
  onConnected,
  onPasteToken,
  onDisconnect,
  connected,
}: Props) {
  const [request, response, promptAsync] = useGoogleDriveAuthRequest();
  const [prompting, setPrompting] = useState(false);
  const inFlight = useRef(false);

  const handleConnected = useCallback(() => {
    Toast.show({
      type: "success",
      text1: "Drive connected",
      text2: "You can upload dated backups now",
    });
    onConnected();
  }, [onConnected]);

  usePersistGoogleDriveResponse(response, handleConnected);

  const startGoogleSignIn = useCallback(async () => {
    if (inFlight.current) return;
    if (!request) {
      Toast.show({
        type: "info",
        text1: "Google sign-in not ready",
        text2: "Wait a moment, or use paste token",
      });
      onPasteToken();
      return;
    }

    inFlight.current = true;
    setPrompting(true);
    try {
      // Do NOT Face ID immediately before this — ASWebAuthenticationSession
      // fails to start while another system sheet is dismissing (keyWindow nil).
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          setTimeout(resolve, 250);
        });
      });

      const result = await promptAsync({
        // Keep cookies so returning users finish faster; still get consent once.
        preferEphemeralSession: false,
        showInRecents: true,
      });

      if (result.type === "cancel" || result.type === "dismiss") {
        Toast.show({ type: "info", text1: "Google sign-in cancelled" });
      } else if (result.type === "error") {
        Toast.show({
          type: "error",
          text1: "Google sign-in failed",
          text2: result.error?.message || "Try again or use paste token",
        });
      }
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      Toast.show({
        type: "error",
        text1: "Could not open Google sign-in",
        text2: /WebAuthSessionFailedToStart/i.test(msg)
          ? "Close other sheets, unlock the phone, then try again — or use paste token"
          : msg.slice(0, 120),
      });
    } finally {
      inFlight.current = false;
      setPrompting(false);
    }
  }, [request, promptAsync, onPasteToken]);

  return (
    <TouchableOpacity
      onPress={() => {
        if (connected) {
          onDisconnect();
          return;
        }
        void startGoogleSignIn();
      }}
      disabled={Boolean(busy) || prompting}
      className="flex-row items-center gap-4 rounded-2xl p-4"
      style={{
        backgroundColor: colors.bg.primary,
        opacity: busy || prompting ? 0.6 : 1,
      }}
    >
      <Ionicons
        name={connected ? "checkmark-circle" : "logo-google"}
        size={22}
        color={connected ? colors.success : colors.text.primary}
      />
      <Text className="flex-1 font-semibold" style={{ color: colors.text.primary }}>
        {busy || prompting
          ? "Connecting…"
          : connected
            ? "Drive connected · tap to manage"
            : "Sign in with Google"}
      </Text>
      {busy || prompting ? (
        <ActivityIndicator color={colors.info} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
      )}
    </TouchableOpacity>
  );
}
