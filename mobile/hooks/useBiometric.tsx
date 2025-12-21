import { useCallback, useEffect, useState } from "react";
import * as biometricService from "../services/biometric";
import type {
  BiometricStatus,
  BiometricType,
  StoredCredentials,
} from "../services/biometric";

interface UseBiometricOptions {
  /** User identifier (e.g., email or user ID) for per-user biometric storage */
  userIdentifier?: string;
}

interface UseBiometricReturn {
  status: BiometricStatus | null;
  isLoading: boolean;
  isEnabling: boolean;
  isAuthenticating: boolean;
  enableBiometric: (credentials: StoredCredentials) => Promise<boolean>;
  disableBiometric: () => Promise<boolean>;
  authenticateWithBiometric: () => Promise<StoredCredentials | null>;
  /** Find any user with biometric enabled (for login screen) */
  findBiometricCredentials: () => Promise<StoredCredentials | null>;
  refreshStatus: () => Promise<void>;
  getBiometricDisplayName: (type: BiometricType) => string;
  getBiometricIconName: (
    type: BiometricType
  ) => "finger-print" | "scan" | "eye" | "lock-closed";
}

export function useBiometric(
  options: UseBiometricOptions = {}
): UseBiometricReturn {
  const { userIdentifier } = options;
  const [status, setStatus] = useState<BiometricStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const biometricStatus = await biometricService.getBiometricStatus(
        userIdentifier
      );
      setStatus(biometricStatus);
    } catch (error) {
      console.warn("Failed to get biometric status:", error);
      setStatus({
        isAvailable: false,
        isEnabled: false,
        biometricType: "none",
        enrolledLevel: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [userIdentifier]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const enableBiometric = useCallback(
    async (credentials: StoredCredentials): Promise<boolean> => {
      try {
        setIsEnabling(true);
        const success = await biometricService.enableBiometric(
          credentials,
          userIdentifier
        );
        if (success) {
          await refreshStatus();
        }
        return success;
      } finally {
        setIsEnabling(false);
      }
    },
    [refreshStatus, userIdentifier]
  );

  const disableBiometric = useCallback(async (): Promise<boolean> => {
    try {
      setIsEnabling(true);
      const success = await biometricService.disableBiometric(userIdentifier);
      if (success) {
        await refreshStatus();
      }
      return success;
    } finally {
      setIsEnabling(false);
    }
  }, [refreshStatus, userIdentifier]);

  const authenticateWithBiometric =
    useCallback(async (): Promise<StoredCredentials | null> => {
      try {
        setIsAuthenticating(true);
        return await biometricService.authenticateWithBiometric(userIdentifier);
      } finally {
        setIsAuthenticating(false);
      }
    }, [userIdentifier]);

  const findBiometricCredentials =
    useCallback(async (): Promise<StoredCredentials | null> => {
      try {
        setIsAuthenticating(true);
        return await biometricService.findBiometricCredentials();
      } finally {
        setIsAuthenticating(false);
      }
    }, []);

  return {
    status,
    isLoading,
    isEnabling,
    isAuthenticating,
    enableBiometric,
    disableBiometric,
    authenticateWithBiometric,
    findBiometricCredentials,
    refreshStatus,
    getBiometricDisplayName: biometricService.getBiometricDisplayName,
    getBiometricIconName: biometricService.getBiometricIconName,
  };
}
