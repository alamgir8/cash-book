import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

// Base keys - will be suffixed with user identifier for per-user storage
const BIOMETRIC_ENABLED_KEY_PREFIX = "cash-book-biometric-enabled-";
const BIOMETRIC_CREDENTIALS_KEY_PREFIX = "cash-book-biometric-credentials-";

// For backward compatibility and to know which users have biometric enabled
const BIOMETRIC_USERS_KEY = "cash-book-biometric-users";

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
 * @param userIdentifier - Optional user identifier to check for specific user
 */
export async function getBiometricStatus(
  userIdentifier?: string
): Promise<BiometricStatus> {
  const availability = await checkBiometricAvailability();
  const isEnabled = await isBiometricEnabled(userIdentifier);

  return {
    ...availability,
    isEnabled: availability.isAvailable && isEnabled,
  };
}

/**
 * Get storage keys for a specific user
 */
function getUserKeys(userIdentifier?: string): {
  enabledKey: string;
  credentialsKey: string;
} {
  // If no identifier, use a hash of "default" or check stored users
  const suffix = userIdentifier || "default";
  return {
    enabledKey: `${BIOMETRIC_ENABLED_KEY_PREFIX}${suffix}`,
    credentialsKey: `${BIOMETRIC_CREDENTIALS_KEY_PREFIX}${suffix}`,
  };
}

/**
 * Check if biometric authentication is enabled by the user
 * @param userIdentifier - Optional user identifier (email or phone)
 */
export async function isBiometricEnabled(
  userIdentifier?: string
): Promise<boolean> {
  try {
    const { enabledKey } = getUserKeys(userIdentifier);
    const enabled = await SecureStore.getItemAsync(enabledKey);
    return enabled === "true";
  } catch (error) {
    console.warn("Failed to check biometric enabled status:", error);
    return false;
  }
}

/**
 * Enable biometric authentication and store credentials securely
 * @param credentials - User credentials to store
 * @param userIdentifier - Optional user identifier for multi-user support
 */
export async function enableBiometric(
  credentials: StoredCredentials,
  userIdentifier?: string
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

    // Use the identifier from credentials if not provided
    const identifier = userIdentifier || credentials.identifier;
    const { enabledKey, credentialsKey } = getUserKeys(identifier);

    // Store credentials securely
    await SecureStore.setItemAsync(credentialsKey, JSON.stringify(credentials));
    await SecureStore.setItemAsync(enabledKey, "true");

    // Track this user in the list of biometric users
    await addBiometricUser(identifier);

    return true;
  } catch (error) {
    console.warn("Failed to enable biometric:", error);
    return false;
  }
}

/**
 * Track users who have enabled biometric
 */
async function addBiometricUser(identifier: string): Promise<void> {
  try {
    const usersJson = await SecureStore.getItemAsync(BIOMETRIC_USERS_KEY);
    const users: string[] = usersJson ? JSON.parse(usersJson) : [];
    if (!users.includes(identifier)) {
      users.push(identifier);
      await SecureStore.setItemAsync(
        BIOMETRIC_USERS_KEY,
        JSON.stringify(users)
      );
    }
  } catch (error) {
    console.warn("Failed to track biometric user:", error);
  }
}

/**
 * Remove user from biometric users list
 */
async function removeBiometricUser(identifier: string): Promise<void> {
  try {
    const usersJson = await SecureStore.getItemAsync(BIOMETRIC_USERS_KEY);
    const users: string[] = usersJson ? JSON.parse(usersJson) : [];
    const filtered = users.filter((u) => u !== identifier);
    await SecureStore.setItemAsync(
      BIOMETRIC_USERS_KEY,
      JSON.stringify(filtered)
    );
  } catch (error) {
    console.warn("Failed to remove biometric user:", error);
  }
}

/**
 * Get list of users who have biometric enabled
 */
export async function getBiometricUsers(): Promise<string[]> {
  try {
    const usersJson = await SecureStore.getItemAsync(BIOMETRIC_USERS_KEY);
    return usersJson ? JSON.parse(usersJson) : [];
  } catch (error) {
    console.warn("Failed to get biometric users:", error);
    return [];
  }
}

/**
 * Disable biometric authentication and remove stored credentials
 * @param userIdentifier - Optional user identifier
 */
export async function disableBiometric(
  userIdentifier?: string
): Promise<boolean> {
  try {
    const { enabledKey, credentialsKey } = getUserKeys(userIdentifier);
    await SecureStore.deleteItemAsync(credentialsKey);
    await SecureStore.deleteItemAsync(enabledKey);

    if (userIdentifier) {
      await removeBiometricUser(userIdentifier);
    }

    return true;
  } catch (error) {
    console.warn("Failed to disable biometric:", error);
    return false;
  }
}

/**
 * Authenticate using biometrics and return stored credentials
 * @param userIdentifier - Optional user identifier to get specific user's credentials
 */
export async function authenticateWithBiometric(
  userIdentifier?: string
): Promise<StoredCredentials | null> {
  try {
    const isEnabled = await isBiometricEnabled(userIdentifier);
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

    const { credentialsKey } = getUserKeys(userIdentifier);
    const credentialsJson = await SecureStore.getItemAsync(credentialsKey);
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
 * Find any user with stored biometric credentials
 * Used for quick login on app start
 */
export async function findBiometricCredentials(): Promise<StoredCredentials | null> {
  try {
    const users = await getBiometricUsers();

    for (const user of users) {
      const isEnabled = await isBiometricEnabled(user);
      if (isEnabled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Login with biometrics",
          cancelLabel: "Cancel",
          disableDeviceFallback: false,
          fallbackLabel: "Use passcode",
        });

        if (result.success) {
          const { credentialsKey } = getUserKeys(user);
          const credentialsJson = await SecureStore.getItemAsync(
            credentialsKey
          );
          if (credentialsJson) {
            return JSON.parse(credentialsJson) as StoredCredentials;
          }
        }
        break; // Only try once
      }
    }

    return null;
  } catch (error) {
    console.warn("Failed to find biometric credentials:", error);
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
 * @param credentials - New credentials to store
 * @param userIdentifier - Optional user identifier
 */
export async function updateStoredCredentials(
  credentials: StoredCredentials,
  userIdentifier?: string
): Promise<boolean> {
  try {
    const identifier = userIdentifier || credentials.identifier;
    const isEnabled = await isBiometricEnabled(identifier);
    if (!isEnabled) {
      return false;
    }

    const { credentialsKey } = getUserKeys(identifier);
    await SecureStore.setItemAsync(credentialsKey, JSON.stringify(credentials));
    return true;
  } catch (error) {
    console.warn("Failed to update stored credentials:", error);
    return false;
  }
}

/**
 * Check if credentials are stored for biometric login
 * @param userIdentifier - Optional user identifier
 */
export async function hasStoredCredentials(
  userIdentifier?: string
): Promise<boolean> {
  try {
    const { credentialsKey } = getUserKeys(userIdentifier);
    const credentials = await SecureStore.getItemAsync(credentialsKey);
    return credentials !== null;
  } catch (error) {
    console.warn("Failed to check stored credentials:", error);
    return false;
  }
}
