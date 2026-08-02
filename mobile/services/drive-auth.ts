import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";
import type { AuthSessionResult } from "expo-auth-session";
import { useEffect } from "react";

export const DRIVE_OAUTH_SCOPE =
  "https://www.googleapis.com/auth/drive.file";

WebBrowser.maybeCompleteAuthSession();

/**
 * Google iOS OAuth expects the reversed client ID as the callback scheme:
 * `com.googleusercontent.apps.<CLIENT>:/oauthredirect`
 * (must also be listed under CFBundleURLSchemes).
 */
export function googleIosReversedScheme(iosClientId: string): string | null {
  const match = iosClientId.match(
    /^([a-z0-9-]+)\.apps\.googleusercontent\.com$/i,
  );
  if (!match) return null;
  return `com.googleusercontent.apps.${match[1]}`;
}

export function googleIosRedirectUri(iosClientId: string): string | undefined {
  const scheme = googleIosReversedScheme(iosClientId);
  if (!scheme) return undefined;
  return AuthSession.makeRedirectUri({
    native: `${scheme}:/oauthredirect`,
  });
}

const TOKEN_BUNDLE_KEY = "hisabboi_drive_token_bundle";

export type DriveTokenBundle = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null; // epoch ms
};

export function getGoogleOAuthClientIds() {
  return {
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || undefined,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId:
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  };
}

/** True when this platform has the client id Expo Google auth requires. */
export function hasGoogleOAuthConfigured(): boolean {
  const ids = getGoogleOAuthClientIds();
  if (Platform.OS === "ios") return Boolean(ids.iosClientId);
  if (Platform.OS === "android") return Boolean(ids.androidClientId);
  return Boolean(ids.webClientId || ids.expoClientId);
}

export async function getDriveTokenBundle(): Promise<DriveTokenBundle | null> {
  const raw = await SecureStore.getItemAsync(TOKEN_BUNDLE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DriveTokenBundle;
  } catch {
    // Legacy: plain access token string
    return { accessToken: raw };
  }
}

export async function setDriveTokenBundle(
  bundle: DriveTokenBundle | null,
): Promise<void> {
  if (!bundle?.accessToken) {
    await SecureStore.deleteItemAsync(TOKEN_BUNDLE_KEY);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_BUNDLE_KEY, JSON.stringify(bundle));
}

/** Paste-token / simple access token (no refresh). */
export async function persistDriveAccessToken(
  token: string | null | undefined,
): Promise<boolean> {
  const t = token?.trim();
  if (!t) return false;
  await setDriveTokenBundle({ accessToken: t, expiresAt: null, refreshToken: null });
  return true;
}

export async function clearDriveSession(): Promise<void> {
  await setDriveTokenBundle(null);
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<DriveTokenBundle | null> {
  const ids = getGoogleOAuthClientIds();
  const clientId =
    Platform.OS === "ios"
      ? ids.iosClientId
      : Platform.OS === "android"
        ? ids.androidClientId
        : ids.webClientId || ids.expoClientId;
  if (!clientId) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json();
  if (!json.access_token) {
    console.warn("[drive-auth] refresh failed", json.error || json);
    return null;
  }
  const expiresAt = json.expires_in
    ? Date.now() + Number(json.expires_in) * 1000 - 60_000
    : null;
  const next: DriveTokenBundle = {
    accessToken: json.access_token,
    refreshToken,
    expiresAt,
  };
  await setDriveTokenBundle(next);
  return next;
}

/**
 * Returns a usable access token, refreshing when possible.
 */
export async function getValidDriveAccessToken(): Promise<string | null> {
  const bundle = await getDriveTokenBundle();
  if (!bundle?.accessToken) return null;

  const expired =
    typeof bundle.expiresAt === "number" && bundle.expiresAt < Date.now();
  if (!expired) return bundle.accessToken;

  if (bundle.refreshToken) {
    const refreshed = await refreshAccessToken(bundle.refreshToken);
    return refreshed?.accessToken ?? null;
  }
  // Pasted short-lived token — still try until Drive API rejects it
  return bundle.accessToken;
}

export async function persistAuthSessionAuthentication(
  auth: {
    accessToken: string;
    refreshToken?: string | null;
    expiresIn?: number | null;
  } | null | undefined,
): Promise<boolean> {
  if (!auth?.accessToken) return false;
  const expiresAt = auth.expiresIn
    ? Date.now() + Number(auth.expiresIn) * 1000 - 60_000
    : null;
  await setDriveTokenBundle({
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken ?? null,
    expiresAt,
  });
  return true;
}

/**
 * Hook: ONLY call from a component mounted when hasGoogleOAuthConfigured() is true.
 * Uses Expo's Google provider (correct native redirect + code exchange).
 */
export function useGoogleDriveAuthRequest() {
  const ids = getGoogleOAuthClientIds();
  const iosRedirect =
    Platform.OS === "ios" && ids.iosClientId
      ? googleIosRedirectUri(ids.iosClientId)
      : undefined;

  return Google.useAuthRequest({
    scopes: [DRIVE_OAUTH_SCOPE, "openid", "profile", "email"],
    iosClientId: ids.iosClientId,
    androidClientId: ids.androidClientId,
    webClientId: ids.webClientId,
    // Prefer offline refresh; avoid selectAccount which overwrites prompt=consent.
    redirectUri: iosRedirect,
    extraParams: {
      access_type: "offline",
      prompt: "consent",
    },
  });
}

/**
 * Apply a successful Google auth response into SecureStore.
 */
export function usePersistGoogleDriveResponse(
  response: AuthSessionResult | null,
  onConnected?: () => void,
) {
  useEffect(() => {
    if (response?.type !== "success") return;
    void (async () => {
      const ok = await persistAuthSessionAuthentication(response.authentication);
      if (!ok) {
        const token = (response.params as { access_token?: string })
          ?.access_token;
        if (token) await persistDriveAccessToken(token);
      }
      onConnected?.();
    })();
  }, [response, onConnected]);
}
