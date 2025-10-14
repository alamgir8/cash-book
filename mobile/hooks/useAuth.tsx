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
import {
  getApiErrorMessage,
  setAuthToken,
  setTokenRefreshHandler,
  setUnauthorizedHandler,
} from "../lib/api";
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
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handlingUnauthorized = useRef(false);

  const persistSession = useCallback(async (tokens: AuthTokens) => {
    try {
      await SecureStore.setItemAsync(
        STORAGE_SESSION_KEY,
        JSON.stringify(tokens)
      );
      await SecureStore.setItemAsync(LEGACY_TOKEN_KEY, tokens.accessToken);
    } catch (error) {
      console.warn("Failed to persist auth session", error);
    }
  }, []);

  const clearSession = useCallback(async () => {
    setAuthToken();
    try {
      await SecureStore.deleteItemAsync(STORAGE_SESSION_KEY);
      await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
    } catch (error) {
      console.warn("Failed to clear stored session", error);
    }
    setState({ status: "unauthenticated", user: null, tokens: null });
  }, []);

  const applySession = useCallback(
    async ({ tokens, admin }: AuthSessionResponse) => {
      setAuthToken(tokens.accessToken);
      await persistSession(tokens);
      setState({ status: "authenticated", tokens, user: admin });
    },
    [persistSession]
  );

  const refreshAccessToken = useCallback(async () => {
    const current = stateRef.current;
    if (current.status !== "authenticated") return null;
    try {
      const refreshed = await authService.refreshSession(
        current.tokens.refreshToken
      );
      await applySession(refreshed);
      return refreshed.tokens.accessToken;
    } catch (error) {
      await clearSession();
      return null;
    }
  }, [applySession, clearSession]);

  const handleUnauthorized = useCallback(async () => {
    if (handlingUnauthorized.current) return;
    handlingUnauthorized.current = true;

    const previousState = stateRef.current;
    try {
      await clearSession();
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
  }, [clearSession]);

  const bootstrap = useCallback(async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_SESSION_KEY);
      if (!stored) {
        await clearSession();
        return;
      }

      let tokens: AuthTokens | null = null;
      try {
        tokens = JSON.parse(stored) as AuthTokens;
      } catch (parseError) {
        console.warn("Failed to parse stored session", parseError);
        await clearSession();
        return;
      }

      if (!tokens?.accessToken || !tokens.refreshToken) {
        await clearSession();
        return;
      }

      setAuthToken(tokens.accessToken);
      try {
        const profile = await authService.getProfile();
        await persistSession(tokens);
        setState({
          status: "authenticated",
          tokens,
          user: profile.admin,
        });
      } catch (profileError) {
        try {
          const refreshed = await authService.refreshSession(
            tokens.refreshToken
          );
          await applySession(refreshed);
        } catch (refreshError) {
          console.warn("Failed to refresh session during bootstrap", refreshError);
          await clearSession();
        }
      }
    } catch (error) {
      console.warn("Failed to bootstrap session", error);
      await clearSession();
    }
  }, [applySession, clearSession, persistSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void handleUnauthorized();
    });
    setTokenRefreshHandler(() => refreshAccessToken());
    return () => {
      setUnauthorizedHandler();
      setTokenRefreshHandler();
    };
  }, [handleUnauthorized, refreshAccessToken]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const signIn = useCallback(
    async ({ identifier, password }: LoginRequest) => {
      try {
        const data = await authService.login({ identifier, password });
        await applySession(data);
        Toast.show({ type: "success", text1: "Welcome back!" });
      } catch (error) {
        const message = getApiErrorMessage(
          error,
          "Check your credentials and try again."
        );
        Toast.show({ type: "error", text1: "Sign-in failed", text2: message });
        throw new Error(message);
      }
    },
    [applySession]
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
          "Please review your details and try again."
        );
        Toast.show({ type: "error", text1: "Sign-up failed", text2: message });
        throw new Error(message);
      }
    },
    [applySession]
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
      setState((prev) =>
        prev.status === "authenticated"
          ? { ...prev, user: data.admin }
          : { status: "unauthenticated", user: null, tokens: null }
      );
    } catch (error) {
      console.warn("Failed to refresh profile", error);
    }
  }, []);

  const updateProfile = useCallback(async (payload: UpdateProfileRequest) => {
    if (stateRef.current.status !== "authenticated") return;
    try {
      const data = await authService.updateProfile(payload);
      setState((prev) =>
        prev.status === "authenticated"
          ? { ...prev, user: data.admin }
          : { status: "unauthenticated", user: null, tokens: null }
      );
      Toast.show({ type: "success", text1: "Profile updated successfully" });
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        "Failed to update profile. Please try again."
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
    [state, signIn, signUp, signOut, refreshProfile, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
