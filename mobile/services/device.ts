import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { api } from "../lib/api";

const DEVICE_ID_KEY = "cash-book-device-id";

/**
 * Generate and persist a stable device fingerprint.
 * Uses Device.osBuildId + Device.modelId for stability.
 * Falls back to a random UUID stored in SecureStore.
 */
export const getOrCreateDeviceId = async (): Promise<string> => {
  const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (stored) return stored;

  // Build a deterministic ID from device hardware info
  const base = [
    Device.modelId ?? "",
    Device.osBuildId ?? "",
    Device.osInternalBuildId ?? "",
  ]
    .filter(Boolean)
    .join("-");

  let deviceId: string;
  if (base.length > 5) {
    // Hash to a consistent UUID-like string
    let hash = 0;
    for (let i = 0; i < base.length; i++) {
      const char = base.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    deviceId = `dev-${Math.abs(hash).toString(16)}-${Date.now().toString(16)}`;
  } else {
    // No hardware info available — use random UUID
    deviceId = `dev-rnd-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  }

  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  return deviceId;
};

/**
 * Register current device as trusted after a successful password login.
 * Call this immediately after login() succeeds.
 */
export const registerTrustedDevice = async (): Promise<void> => {
  try {
    const deviceId = await getOrCreateDeviceId();
    const deviceName =
      Device.deviceName ?? Device.modelName ?? "Unknown Device";
    const platform = Platform.OS as "ios" | "android" | "web";

    await api.post("/auth/devices/trust", {
      device_id: deviceId,
      device_name: deviceName,
      platform,
    });
  } catch (error) {
    // Non-critical — log but don't throw. Device can be re-registered later.
    console.warn("[DeviceTrust] Failed to register device:", error);
  }
};

/**
 * Fetch all trusted devices for the current admin.
 */
export const listTrustedDevices = async () => {
  const response = await api.get<{
    devices: {
      device_id: string;
      device_name: string;
      platform: string;
      trusted_at: string;
      last_used_at: string;
      revoked: boolean;
    }[];
  }>("/auth/devices");
  return response.data.devices;
};

/**
 * Revoke a specific trusted device.
 */
export const revokeTrustedDevice = async (deviceId: string): Promise<void> => {
  await api.delete(`/auth/devices/${deviceId}`);
};
