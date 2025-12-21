import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_ENABLED_KEY = "cash-book-biometric-enabled";
const BIOMETRIC_CREDENTIALS_KEY = "cash-book-biometric-credentials";

export type BiometricType = "fingerprint" | "facial" | "iris" | "none";

export interface BiometricStatus {
  isAvailable: boolean;
  isEnabled: boolean;
  biometricType: BiometricType;
  enrolledLevel: LocalAuthentication.SecurityLevel;
}

export interface StoredCredentials {
  identifier: string;
  password: string;
}

/**
 * Check if biometric authentication is available on the device
 */
export async function checkBiometricAvailability(): Promise<{
  isAvailable: boolean;
  biometricType: BiometricType;
  enrolledLevel: LocalAuthentication.SecurityLevel;
}> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return {
        isAvailable: false,
        biometricType: "none",
        enrolledLevel: LocalAuthentication.SecurityLevel.NONE,
      };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      return {
        isAvailable: false,
        biometricType: "none",
        enrolledLevel: LocalAuthentication.SecurityLevel.NONE,
      };
    }

    const supportedTypes =
      await LocalAuthentication.supportedAuthenticationTypesAsync();
    const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();

    let biometricType: BiometricType = "none";
    if (
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FINGERPRINT
      )
    ) {
      biometricType = "fingerprint";
    } else if (
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
      )
    ) {
      biometricType = "facial";
    } else if (
      supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)
    ) {
      biometricType = "iris";
    }

    return {
      isAvailable: true,
      biometricType,
      enrolledLevel,
    };
  } catch (error) {
    console.warn("Failed to check biometric availability:", error);
    return {
      isAvailable: false,
      biometricType: "none",
      enrolledLevel: LocalAuthentication.SecurityLevel.NONE,
    };
  }
}

/**
 * Get the full biometric status including enabled state
 */
export async function getBiometricStatus(): Promise<BiometricStatus> {
  const availability = await checkBiometricAvailability();
  const isEnabled = await isBiometricEnabled();

  return {
    ...availability,
    isEnabled: availability.isAvailable && isEnabled,
  };
}

/**
 * Check if biometric authentication is enabled by the user
 */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return enabled === "true";
  } catch (error) {
    console.warn("Failed to check biometric enabled status:", error);
    return false;
  }
}

/**
 * Enable biometric authentication and store credentials securely
 */
export async function enableBiometric(
  credentials: StoredCredentials
): Promise<boolean> {
  try {
    // First, verify biometric authentication works
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Verify your identity to enable biometric login",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
      fallbackLabel: "Use passcode",
    });

    if (!result.success) {
      return false;
    }

    // Store credentials securely
    await SecureStore.setItemAsync(
      BIOMETRIC_CREDENTIALS_KEY,
      JSON.stringify(credentials)
    );
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");

    return true;
  } catch (error) {
    console.warn("Failed to enable biometric:", error);
    return false;
  }
}

/**
 * Disable biometric authentication and remove stored credentials
 */
export async function disableBiometric(): Promise<boolean> {
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    return true;
  } catch (error) {
    console.warn("Failed to disable biometric:", error);
    return false;
  }
}

/**
 * Authenticate using biometrics and return stored credentials
 */
export async function authenticateWithBiometric(): Promise<StoredCredentials | null> {
  try {
    const isEnabled = await isBiometricEnabled();
    if (!isEnabled) {
      return null;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Login with biometrics",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
      fallbackLabel: "Use passcode",
    });

    if (!result.success) {
      return null;
    }

    const credentialsJson = await SecureStore.getItemAsync(
      BIOMETRIC_CREDENTIALS_KEY
    );
    if (!credentialsJson) {
      return null;
    }

    return JSON.parse(credentialsJson) as StoredCredentials;
  } catch (error) {
    console.warn("Failed to authenticate with biometric:", error);
    return null;
  }
}

/**
 * Get the display name for the biometric type
 */
export function getBiometricDisplayName(type: BiometricType): string {
  switch (type) {
    case "fingerprint":
      return "Fingerprint";
    case "facial":
      return "Face ID";
    case "iris":
      return "Iris Scan";
    default:
      return "Biometric";
  }
}

/**
 * Get the icon name for the biometric type (Ionicons)
 */
export function getBiometricIconName(
  type: BiometricType
): "finger-print" | "scan" | "eye" | "lock-closed" {
  switch (type) {
    case "fingerprint":
      return "finger-print";
    case "facial":
      return "scan";
    case "iris":
      return "eye";
    default:
      return "lock-closed";
  }
}

/**
 * Update stored credentials (e.g., after password change)
 */
export async function updateStoredCredentials(
  credentials: StoredCredentials
): Promise<boolean> {
  try {
    const isEnabled = await isBiometricEnabled();
    if (!isEnabled) {
      return false;
    }

    await SecureStore.setItemAsync(
      BIOMETRIC_CREDENTIALS_KEY,
      JSON.stringify(credentials)
    );
    return true;
  } catch (error) {
    console.warn("Failed to update stored credentials:", error);
    return false;
  }
}

/**
 * Check if credentials are stored for biometric login
 */
export async function hasStoredCredentials(): Promise<boolean> {
  try {
    const credentials = await SecureStore.getItemAsync(
      BIOMETRIC_CREDENTIALS_KEY
    );
    return credentials !== null;
  } catch (error) {
    console.warn("Failed to check stored credentials:", error);
    return false;
  }
}
