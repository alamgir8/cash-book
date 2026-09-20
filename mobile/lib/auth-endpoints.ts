/**
 * Auth endpoints that must never trigger the axios 401 refresh-and-retry flow.
 *
 * `/auth/refresh` is the important one. If its own 401 re-entered the response
 * interceptor, that request would mark itself `_retry` and then `await
 * refreshPromise` — the very promise it was already part of. Neither could ever
 * settle, so a refresh token the server rejects (for example after switching
 * `EXPO_PUBLIC_BASE_URL` between the deployed API and a local backend) hung
 * forever: the session was never cleared, the user was never asked to sign in
 * again, and cloud sync silently never pushed on-device changes.
 *
 * `/auth/login` and `/auth/signup` are listed so a wrong password (401) cannot be
 * mistaken for an expired session and sign the user out of a valid session.
 *
 * Kept dependency-free so it can be unit tested without React Native.
 */
export const AUTH_ENDPOINTS = ["/auth/refresh", "/auth/login", "/auth/signup"];

/**
 * True when `url` targets one of {@link AUTH_ENDPOINTS}.
 *
 * Handles relative paths (`/auth/refresh`), absolute URLs
 * (`http://host:5050/api/auth/refresh`) and query strings.
 */
export const isAuthEndpoint = (url?: string | null): boolean => {
  if (!url) return false;
  const path = url.split("?")[0];
  return AUTH_ENDPOINTS.some((endpoint) => path.endsWith(endpoint));
};
