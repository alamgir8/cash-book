import { useCallback, useEffect, useState } from "react";
import * as biometricService from "../services/biometric";
import type {
  BiometricStatus,
  BiometricType,
  StoredCredentials,
} from "../services/biometric";

interface UseBiometricReturn {
  status: BiometricStatus | null;
  isLoading: boolean;
  isEnabling: boolean;
  isAuthenticating: boolean;
  enableBiometric: (credentials: StoredCredentials) => Promise<boolean>;
  disableBiometric: () => Promise<boolean>;
  authenticateWithBiometric: () => Promise<StoredCredentials | null>;
  refreshStatus: () => Promise<void>;
  getBiometricDisplayName: (type: BiometricType) => string;
  getBiometricIconName: (
    type: BiometricType
  ) => "finger-print" | "scan" | "eye" | "lock-closed";
}

export function useBiometric(): UseBiometricReturn {
  const [status, setStatus] = useState<BiometricStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const biometricStatus = await biometricService.getBiometricStatus();
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
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const enableBiometric = useCallback(
    async (credentials: StoredCredentials): Promise<boolean> => {
      try {
        setIsEnabling(true);
        const success = await biometricService.enableBiometric(credentials);
        if (success) {
          await refreshStatus();
        }
        return success;
      } finally {
        setIsEnabling(false);
      }
    },
    [refreshStatus]
  );

  const disableBiometric = useCallback(async (): Promise<boolean> => {
    try {
      setIsEnabling(true);
      const success = await biometricService.disableBiometric();
      if (success) {
        await refreshStatus();
      }
      return success;
    } finally {
      setIsEnabling(false);
    }
  }, [refreshStatus]);

  const authenticateWithBiometric =
    useCallback(async (): Promise<StoredCredentials | null> => {
      try {
        setIsAuthenticating(true);
        return await biometricService.authenticateWithBiometric();
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
    refreshStatus,
    getBiometricDisplayName: biometricService.getBiometricDisplayName,
    getBiometricIconName: biometricService.getBiometricIconName,
  };
}
