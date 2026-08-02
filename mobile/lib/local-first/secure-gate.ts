import * as LocalAuthentication from "expo-local-authentication";
import { Alert } from "react-native";

/**
 * Gate sensitive local-first actions (restore, Drive connect) behind
 * device biometrics / passcode when the OS has a lock enrolled.
 */
export async function requireDeviceAuth(
  promptMessage: string,
): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !enrolled) {
      // No lock on device — warn once, allow (caller already confirmed intent).
      return new Promise((resolve) => {
        Alert.alert(
          "No device lock",
          "Set a passcode or biometrics on this phone to protect restores and Drive access. Continue without verification?",
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Continue", onPress: () => resolve(true) },
          ],
        );
      });
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
      fallbackLabel: "Use passcode",
    });
    return result.success;
  } catch {
    return false;
  }
}
