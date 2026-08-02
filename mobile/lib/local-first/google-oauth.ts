/**
 * Pure Google OAuth URL helpers (no React Native imports).
 */

/**
 * Google iOS OAuth expects the reversed client ID as the callback scheme:
 * `com.googleusercontent.apps.<CLIENT>:/oauthredirect`
 */
export function googleIosReversedScheme(iosClientId: string): string | null {
  const match = iosClientId.match(
    /^([a-z0-9-]+)\.apps\.googleusercontent\.com$/i,
  );
  if (!match) return null;
  return `com.googleusercontent.apps.${match[1]}`;
}
