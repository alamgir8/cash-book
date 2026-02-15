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
import { clearQueryCache } from "../lib/queryClient";
import * as authService from "../services/auth";
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
  refreshProfile: () => Promise<void>;
  updateProfile: (payload: UpdateProfileRequest) => Promise<void>;
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

  const clearSession = useCallback(async () => {
    setAuthToken();
    stopRefreshTimer();
    // Clear React Query cache to prevent stale data from previous user
    clearQueryCache();
    try {
      await SecureStore.deleteItemAsync(STORAGE_SESSION_KEY);
      await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
      await SecureStore.deleteItemAsync(STORAGE_USER_KEY);
    } catch (error) {
      console.warn("Failed to clear stored session", error);
    }
    if (isMountedRef.current) {
      setState({ status: "unauthenticated", user: null, tokens: null });
    }
  }, [stopRefreshTimer]);

  const applySession = useCallback(
    async ({ tokens, admin }: AuthSessionResponse) => {
      setAuthToken(tokens.accessToken);
      await persistSession(tokens, admin);
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
          console.warn("Refresh token rejected by server, clearing session");
          await clearSessionRef.current();
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

    const previousState = stateRef.current;
    try {
      await clearSessionRef.current();
      if (previousState.status === "authenticated") {
        Toast.show({
          type: "info",
          text1: "Session expired",
          text2: "Please sign in again.",
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

      // Try to get fresh profile, but fall back to cached user
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
        // If we have a cached user, use it even if profile fetch fails
        if (cachedUser) {
          console.warn(
            "Using cached user profile due to fetch error",
            profileError,
          );
          if (isMountedRef.current) {
            setState({ status: "authenticated", tokens, user: cachedUser });
          }
          return;
        }

        // For bootstrap, keep session alive on network errors
        // Only clear on explicit auth errors (401/403)
        const isAuthError =
          axios.isAxiosError(profileError) &&
          profileError.response &&
          [401, 403].includes(profileError.response.status);

        if (isAuthError) {
          // Explicit auth error - try refresh
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
          } catch (refreshError) {
            const isRefreshAuthError =
              axios.isAxiosError(refreshError) &&
              refreshError.response &&
              [401, 403].includes(refreshError.response.status);

            if (isRefreshAuthError) {
              console.warn("Session expired, clearing", refreshError);
              await clearSessionRef.current();
            } else {
              // Network error during refresh - keep session
              console.warn(
                "Bootstrap refresh failed (network) but keeping session",
                refreshError,
              );
              if (isMountedRef.current) {
                setState({
                  status: "authenticated",
                  tokens,
                  user: cachedUser || {
                    _id: "",
                    email: "",
                    phone: "",
                    name: "",
                  },
                });
              }
            }
          }
        } else {
          // Network error or server error - keep session alive
          console.warn(
            "Bootstrap profile fetch failed (network/server) but keeping session",
            profileError,
          );
          // Use cached user if available, otherwise create minimal user object
          if (isMountedRef.current) {
            setState({
              status: "authenticated",
              tokens,
              user: cachedUser || {
                _id: "",
                email: "",
                phone: "",
                name: "",
              },
            });
          }
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

  const signIn = useCallback(
    async ({ identifier, password, pin }: LoginRequest) => {
      try {
        const data = await authService.login({ identifier, password, pin });
        await applySession(data);
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
    await clearSession();
  }, [clearSession]);

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

  const updateProfile = useCallback(async (payload: UpdateProfileRequest) => {
    if (stateRef.current.status !== "authenticated") return;
    try {
      const data = await authService.updateProfile(payload);
      if (isMountedRef.current) {
        setState((prev) =>
          prev.status === "authenticated"
            ? { ...prev, user: data.admin }
            : { status: "unauthenticated", user: null, tokens: null },
        );
      }
      Toast.show({ type: "success", text1: "Profile updated successfully" });
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        "Failed to update profile. Please try again.",
      );
      Toast.show({ type: "error", text1: "Update failed", text2: message });
      throw new Error(message);
    }
  }, []);

  const value = useMemo(
    () => ({
      state,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      updateProfile,
    }),
    [state, signIn, signUp, signOut, refreshProfile, updateProfile],
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
