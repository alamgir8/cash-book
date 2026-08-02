import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { DRIVE_OAUTH_SCOPE, setDriveAccessToken } from "@/services/drive-backup";

WebBrowser.maybeCompleteAuthSession();

/**
 * Client IDs from Google Cloud Console (OAuth).
 * Set in .env.local — without these, Settings falls back to paste-token.
 */
export function getGoogleOAuthClientIds() {
  return {
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || undefined,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId:
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  };
}

/** True only when this platform has a usable OAuth client id. */
export function hasGoogleOAuthConfigured(): boolean {
  const ids = getGoogleOAuthClientIds();
  if (Platform.OS === "ios") return Boolean(ids.iosClientId);
  if (Platform.OS === "android") return Boolean(ids.androidClientId);
  return Boolean(ids.webClientId || ids.expoClientId);
}

/**
 * Opens Google OAuth only when client IDs exist for this platform.
 * Lazy (no hooks) so Settings never crashes when IDs are missing.
 */
export async function promptGoogleDriveAccessToken(): Promise<string | null> {
  if (!hasGoogleOAuthConfigured()) return null;

  const ids = getGoogleOAuthClientIds();
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "hisab-boi" });
  const clientId =
    Platform.OS === "ios"
      ? ids.iosClientId!
      : Platform.OS === "android"
        ? ids.androidClientId!
        : (ids.webClientId || ids.expoClientId)!;

  const discovery = await AuthSession.fetchDiscoveryAsync(
    "https://accounts.google.com",
  );

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: [DRIVE_OAUTH_SCOPE, "openid", "profile", "email"],
    redirectUri,
    responseType: AuthSession.ResponseType.Token,
    usePKCE: false,
  });

  await request.makeAuthUrlAsync(discovery);
  const result = await request.promptAsync(discovery);
  if (result.type !== "success") return null;

  return (
    result.authentication?.accessToken ||
    (result.params as { access_token?: string })?.access_token ||
    null
  );
}

export async function persistDriveAccessToken(
  token: string | null | undefined,
): Promise<boolean> {
  const t = token?.trim();
  if (!t) return false;
  await setDriveAccessToken(t);
  return true;
}
