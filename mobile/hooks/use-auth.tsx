import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import Toast from "react-native-toast-message";
import axios from "axios";
import {
  getApiErrorMessage,
  setAuthToken,
  setTokenRefreshHandler,
  setUnauthorizedHandler,
} from "../lib/api";
import { clearUserScopedData } from "../lib/clear-user-data";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as authService from "../services/auth";
import { registerTrustedDevice } from "../services/device";
import type {
  AuthSessionResponse,
  AuthTokens,
  LoginRequest,
  SignupRequest,
  UpdateProfileRequest,
  User as Admin,
} from "../services/auth";

const LEGACY_TOKEN_KEY = "debit-credit-token";
const STORAGE_SESSION_KEY = "cash-book-auth-session";
const STORAGE_USER_KEY = "cash-book-auth-user";
/** Set on Switch Account so sign-in skips Face ID auto-login once. */
export const SKIP_BIOMETRIC_AUTO_LOGIN_KEY = "cash-book-skip-biometric-auto";
// Disable automatic token refresh - only refresh on demand to prevent auto logouts
const REFRESH_INTERVAL_MS = 0; // Disabled - manual refresh only

type AuthState =
  | { status: "loading"; user: null; tokens: null }
  | { status: "unauthenticated"; user: null; tokens: null }
  | { status: "authenticated"; user: Admin; tokens: AuthTokens };

type AuthContextType = {
  state: AuthState;
  signIn: (credentials: LoginRequest) => Promise<void>;
  signUp: (payload: SignupRequest) => Promise<void>;
  signOut: () => Promise<void>;
  /** Sign out and clear caches so another user can sign in on this device. */
  switchAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (payload: UpdateProfileRequest) => Promise<{ synced: boolean }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
    tokens: null,
  });
  const stateRef = useRef(state);
  const isMountedRef = useRef(true);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handlingUnauthorized = useRef(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const stopRefreshTimer = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, []);

  const persistSession = useCallback(
    async (tokens: AuthTokens, user?: Admin) => {
      try {
        await SecureStore.setItemAsync(
          STORAGE_SESSION_KEY,
          JSON.stringify(tokens),
        );
        await SecureStore.setItemAsync(LEGACY_TOKEN_KEY, tokens.accessToken);
        if (user) {
          await SecureStore.setItemAsync(
            STORAGE_USER_KEY,
            JSON.stringify(user),
          );
        }
      } catch (error) {
        console.warn("Failed to persist auth session", error);
      }
    },
    [],
  );

  const clearSession = useCallback(
    async (options: { wipeLedger?: boolean } = {}) => {
      const wipeLedger = options.wipeLedger ?? false;
      setAuthToken();
      stopRefreshTimer();
      await clearUserScopedData({ wipeLedger });
      try {
        await SecureStore.deleteItemAsync(STORAGE_SESSION_KEY);
        await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
        await SecureStore.deleteItemAsync(STORAGE_USER_KEY);
      } catch (error) {
        console.warn("Failed to clear stored session", error);
      }
      try {
        const { resetSessionUnlock } = await import("@/lib/auth/login-mode");
        resetSessionUnlock();
      } catch {
        /* ignore */
      }
      if (isMountedRef.current) {
        setState({ status: "unauthenticated", user: null, tokens: null });
      }
    },
    [stopRefreshTimer],
  );

  const applySession = useCallback(
    async ({ tokens, admin }: AuthSessionResponse) => {
      setAuthToken(tokens.accessToken);
      await persistSession(tokens, admin);
      try {
        const { markSessionUnlocked } = await import("@/lib/auth/login-mode");
        markSessionUnlocked();
      } catch {
        /* ignore */
      }
      if (isMountedRef.current) {
        setState({ status: "authenticated", tokens, user: admin });
      }
    },
    [persistSession],
  );

  // Store callbacks in refs to avoid dependency changes causing re-runs
  const persistSessionRef = useRef(persistSession);
  const clearSessionRef = useRef(clearSession);
  const applySessionRef = useRef(applySession);
  const refreshAccessTokenRef = useRef<
    (() => Promise<string | null>) | undefined
  >(undefined);
  const handleUnauthorizedRef = useRef<(() => Promise<void>) | undefined>(
    undefined,
  );

  useEffect(() => {
    persistSessionRef.current = persistSession;
    clearSessionRef.current = clearSession;
    applySessionRef.current = applySession;
  }, [persistSession, clearSession, applySession]);

  const refreshAccessToken = useCallback(async () => {
    const current = stateRef.current;
    if (current.status !== "authenticated") return null;
    try {
      const refreshed = await authService.refreshSession(
        current.tokens.refreshToken,
      );
      await applySessionRef.current(refreshed);
      return refreshed.tokens.accessToken;
    } catch (error) {
      // On network error, don't log out - just keep the current session
      if (axios.isAxiosError(error) && !error.response) {
        console.warn(
          "Refresh token request failed (network issue)",
          error.message,
        );
        return current.tokens.accessToken; // Return current token, let next request retry
      }

      // Only clear session on explicit auth errors (401, 403)
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        if (status === 401 || status === 403) {
          console.warn(
            "Refresh token rejected by server — deferring to unauthorized handler",
          );
          // Do not wipe here; interceptor → handleUnauthorized decides
          // (keeps offline session when backend is down).
          throw error;
        }
      }

      // For other errors (500, etc.), keep session and throw to let caller handle
      console.warn("Refresh token request failed with server error", error);
      throw error;
    }
  }, []);

  const startRefreshTimer = useCallback(() => {
    stopRefreshTimer();
    // Token refresh disabled - keep session alive until manual logout
    // Only refresh when needed by individual API requests
    if (REFRESH_INTERVAL_MS <= 0) {
      return; // Disabled
    }
    if (stateRef.current.status !== "authenticated") return;
    refreshIntervalRef.current = setInterval(() => {
      void refreshAccessTokenRef.current?.().catch((err) => {
        if (axios.isAxiosError(err) && !err.response) {
          // transient network failure already logged
          return;
        }
        console.warn("Scheduled token refresh failed", err);
      });
    }, REFRESH_INTERVAL_MS);
  }, [stopRefreshTimer]);

  const handleUnauthorized = useCallback(async () => {
    if (handlingUnauthorized.current) return;
    handlingUnauthorized.current = true;

    try {
      // Never lock the user out when the device/backend is unavailable —
      // local-first cash book must keep working offline.
      try {
        const NetInfo = (await import("@react-native-community/netinfo"))
          .default;
        const net = await NetInfo.fetch();
        const deviceOnline =
          net.isConnected === true && net.isInternetReachable !== false;
        if (!deviceOnline) {
          Toast.show({
            type: "info",
            text1: "Working offline",
            text2: "Your cash book stays available on this device.",
          });
          return;
        }
        const { probeBackendAvailable } = await import("@/sync/scheduler");
        const backendOk = await probeBackendAvailable(3500);
        if (!backendOk) {
          Toast.show({
            type: "info",
            text1: "Server unavailable",
            text2: "Continuing with on-device data.",
          });
          return;
        }
      } catch {
        // If we cannot probe, prefer staying signed in for offline use.
        return;
      }

      const previousState = stateRef.current;
      // Soft clear: drop tokens so the user can sign in again, but keep SQLite.
      await clearSessionRef.current({ wipeLedger: false });
      if (previousState.status === "authenticated") {
        Toast.show({
          type: "info",
          text1: "Session expired",
          text2: "Please sign in again. Your on-device data is safe.",
        });
      }
    } finally {
      handlingUnauthorized.current = false;
    }
  }, []);

  // Update refs with latest callback values
  useEffect(() => {
    refreshAccessTokenRef.current = refreshAccessToken;
    handleUnauthorizedRef.current = handleUnauthorized;
  }, [refreshAccessToken, handleUnauthorized]);
  const bootstrap = useCallback(async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_SESSION_KEY);
      const storedUser = await SecureStore.getItemAsync(STORAGE_USER_KEY);
      if (!stored) {
        if (isMountedRef.current) {
          setState({ status: "unauthenticated", user: null, tokens: null });
        }
        return;
      }

      let tokens: AuthTokens | null = null;
      try {
        tokens = JSON.parse(stored) as AuthTokens;
      } catch (parseError) {
        console.warn("Failed to parse stored session", parseError);
        if (isMountedRef.current) {
          setState({ status: "unauthenticated", user: null, tokens: null });
        }
        return;
      }

      if (!tokens?.accessToken || !tokens.refreshToken) {
        if (isMountedRef.current) {
          setState({ status: "unauthenticated", user: null, tokens: null });
        }
        return;
      }

      let cachedUser: Admin | null = null;
      if (storedUser) {
        try {
          cachedUser = JSON.parse(storedUser) as Admin;
        } catch (error) {
          console.warn("Failed to parse stored user", error);
        }
      }

      setAuthToken(tokens.accessToken);

      // Optimistic restore: enter the app immediately from SecureStore so
      // offline / sleeping backends never force a login screen.
      if (cachedUser && isMountedRef.current) {
        setState({
          status: "authenticated",
          tokens,
          user: cachedUser,
        });
        try {
          const { markSessionUnlocked, loadLoginMode } = await import(
            "@/lib/auth/login-mode"
          );
          const mode = await loadLoginMode();
          if (mode === "single") markSessionUnlocked();
        } catch {
          /* ignore */
        }
      }

      // Background renewal — never blocks entry when we already have a cache.
      try {
        const profile = await authService.getProfile();
        await persistSessionRef.current(tokens, profile.admin);
        if (isMountedRef.current) {
          setState({
            status: "authenticated",
            tokens,
            user: profile.admin,
          });
        }
      } catch (profileError) {
        if (cachedUser) {
          // Already authenticated from cache — try silent refresh if 401.
          const isAuthError =
            axios.isAxiosError(profileError) &&
            profileError.response &&
            [401, 403].includes(profileError.response.status);
          if (isAuthError) {
            try {
              const refreshed = await authService.refreshSession(
                tokens.refreshToken,
              );
              await persistSessionRef.current(
                refreshed.tokens,
                refreshed.admin,
              );
              setAuthToken(refreshed.tokens.accessToken);
              if (isMountedRef.current) {
                setState({
                  status: "authenticated",
                  tokens: refreshed.tokens,
                  user: refreshed.admin,
                });
              }
            } catch (refreshError) {
              const isRefreshAuthError =
                axios.isAxiosError(refreshError) &&
                refreshError.response &&
                [401, 403].includes(refreshError.response.status);
              // Soft-fail: keep cached session for offline. Only drop tokens
              // when the server explicitly rejects the refresh AND we can
              // confirm the backend is reachable (handled by unauthorized path
              // on later API calls). Do not wipe the ledger here.
              if (isRefreshAuthError) {
                console.warn(
                  "Refresh rejected — keeping offline session until online re-auth",
                  refreshError,
                );
              }
            }
          }
          return;
        }

        // No cached user — try refresh, else stay unauthenticated (no wipe).
        const isAuthError =
          axios.isAxiosError(profileError) &&
          profileError.response &&
          [401, 403].includes(profileError.response.status);

        if (isAuthError) {
          try {
            const refreshed = await authService.refreshSession(
              tokens.refreshToken,
            );
            await persistSessionRef.current(refreshed.tokens, refreshed.admin);
            setAuthToken(refreshed.tokens.accessToken);
            if (isMountedRef.current) {
              setState({
                status: "authenticated",
                tokens: refreshed.tokens,
                user: refreshed.admin,
              });
            }
            try {
              const { markSessionUnlocked, loadLoginMode } = await import(
                "@/lib/auth/login-mode"
              );
              const mode = await loadLoginMode();
              if (mode === "single") markSessionUnlocked();
            } catch {
              /* ignore */
            }
          } catch {
            if (isMountedRef.current) {
              setState({
                status: "unauthenticated",
                user: null,
                tokens: null,
              });
            }
          }
        } else if (isMountedRef.current) {
          // Network/server error and no cached user
          setState({ status: "unauthenticated", user: null, tokens: null });
        }
      }
    } catch (error) {
      console.warn("Failed to bootstrap session", error);
      if (isMountedRef.current) {
        setState({ status: "unauthenticated", user: null, tokens: null });
      }
    }
  }, []);

  // Set up unauthorized and token refresh handlers once on mount
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void handleUnauthorizedRef.current?.();
    });
    setTokenRefreshHandler(
      () => refreshAccessTokenRef.current?.() ?? Promise.resolve(null),
    );
    return () => {
      setUnauthorizedHandler();
      setTokenRefreshHandler();
    };
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (state.status === "authenticated") {
      startRefreshTimer();
    } else {
      stopRefreshTimer();
    }

    return () => {
      stopRefreshTimer();
    };
  }, [startRefreshTimer, state.status, stopRefreshTimer]);

  // Bind (or wipe+rebind) the local SQLite ledger to the signed-in admin.
  useEffect(() => {
    if (state.status !== "authenticated" || !state.user?._id) return;
    let cancelled = false;
    void (async () => {
      try {
        const { ensureLocalLedgerOwner } = await import(
          "@/lib/local-first/owner"
        );
        if (!cancelled) {
          await ensureLocalLedgerOwner(state.user._id);
        }
      } catch (error) {
        console.warn("[auth] ensureLocalLedgerOwner failed", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, state.status === "authenticated" ? state.user._id : null]);

  const signIn = useCallback(
    async ({ identifier, password, pin }: LoginRequest) => {
      try {
        const data = await authService.login({ identifier, password, pin });
        await applySession(data);
        // Register device trust after password login (not PIN — already trusted)
        if (password) {
          void registerTrustedDevice();
        }
        Toast.show({ type: "success", text1: "Welcome back!" });
      } catch (error) {
        const message = getApiErrorMessage(
          error,
          "Check your credentials and try again.",
        );
        Toast.show({ type: "error", text1: "Sign-in failed", text2: message });
        throw new Error(message);
      }
    },
    [applySession],
  );

  const signUp = useCallback(
    async (payload: SignupRequest) => {
      try {
        const data = await authService.signup(payload);
        await applySession(data);
        Toast.show({ type: "success", text1: "Account created" });
      } catch (error) {
        const message = getApiErrorMessage(
          error,
          "Please review your details and try again.",
        );
        Toast.show({ type: "error", text1: "Sign-up failed", text2: message });
        throw new Error(message);
      }
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    const current = stateRef.current;
    if (current.status === "authenticated") {
      await authService.logout(current.tokens.refreshToken);
    }
    await clearSession({ wipeLedger: true });
  }, [clearSession]);

  const switchAccount = useCallback(async () => {
    // Prevent sign-in screen from auto Face ID-ing the previous user
    try {
      await AsyncStorage.setItem(SKIP_BIOMETRIC_AUTO_LOGIN_KEY, "1");
    } catch (error) {
      console.warn("Failed to set skip-biometric flag", error);
    }
    await signOut();
    Toast.show({
      type: "info",
      text1: "Switch account",
      text2: "Enter the other account’s email/phone and password.",
    });
  }, [signOut]);

  const refreshProfile = useCallback(async () => {
    if (stateRef.current.status !== "authenticated") return;
    try {
      const data = await authService.getProfile();
      if (isMountedRef.current) {
        setState((prev) =>
          prev.status === "authenticated"
            ? { ...prev, user: data.admin }
            : { status: "unauthenticated", user: null, tokens: null },
        );
      }
    } catch (error) {
      console.warn("Failed to refresh profile", error);
    }
  }, []);

  /**
   * Offline-first profile/preferences save.
   *
   * 1. Persist + queue locally (never blocks, works offline)
   * 2. Apply optimistic in-memory patch so the UI updates instantly
   * 3. Best-effort flush; an unreachable backend is NOT an error
   *
   * The login PIN is handed to SecureStore (never SQLite) until it is flushed.
   */
  const updateProfile = useCallback(
    async (payload: UpdateProfileRequest): Promise<{ synced: boolean }> => {
      if (stateRef.current.status !== "authenticated") {
        return { synced: false };
      }

      const { login_pin, ...rest } = (payload ?? {}) as Record<string, any>;

      const settingsSync = await import("@/lib/local-first/settings-sync");

      // 1) Local-first persistence.
      let localSaved = false;
      try {
        await settingsSync.saveLocalProfile(rest);
        if (login_pin !== undefined) {
          await settingsSync.queuePinChange(String(login_pin));
        }
        localSaved = true;
      } catch (error) {
        console.warn("Failed to persist profile locally", error);
      }

      // 2) Optimistic UI so an offline save is visible immediately.
      if (isMountedRef.current) {
        setState((prev) =>
          prev.status === "authenticated"
            ? {
                ...prev,
                user: settingsSync.applyProfilePatchToUser(
                  prev.user as any,
                  rest,
                  login_pin,
                ),
              }
            : { status: "unauthenticated", user: null, tokens: null },
        );
      }

      if (!localSaved) {
        throw new Error("Could not save settings on this device");
      }

      // 3) Best-effort push. Offline leaves the change queued for next sync.
      try {
        const result = await settingsSync.flushPendingOps();
        if (result.flushed > 0 && result.failed === 0) {
          await refreshProfile();
          return { synced: true };
        }
        return { synced: false };
      } catch (error) {
        console.warn("Profile queued for later sync", error);
        return { synced: false };
      }
    },
    [refreshProfile],
  );

  const value = useMemo(
    () => ({
      state,
      signIn,
      signUp,
      signOut,
      switchAccount,
      refreshProfile,
      updateProfile,
    }),
    [
      state,
      signIn,
      signUp,
      signOut,
      switchAccount,
      refreshProfile,
      updateProfile,
    ],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopRefreshTimer();
    };
  }, [stopRefreshTimer]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
