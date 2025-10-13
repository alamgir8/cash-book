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
  api,
  getApiErrorMessage,
  setAuthToken,
  setUnauthorizedHandler,
} from "../lib/api";
import * as authService from "../services/auth";

const STORAGE_TOKEN_KEY = "debit-credit-token";

type Admin = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  settings: {
    currency: string;
    language: string;
    weekStartsOn: number;
  };
  createdAt: string;
  updatedAt: string;
};

type AuthState =
  | { status: "loading"; user: null; token: null }
  | { status: "unauthenticated"; user: null; token: null }
  | { status: "authenticated"; user: Admin; token: string };

type Credentials = {
  identifier: string;
  password: string;
};

type SignupPayload = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

type AuthResponse = {
  token: string;
  admin: Admin;
};

type UpdateProfilePayload = {
  name?: string;
  email?: string;
  phone?: string;
  settings?: {
    currency?: string;
    language?: string;
    weekStartsOn?: number;
  };
};

type AuthContextType = {
  state: AuthState;
  signIn: (credentials: Credentials) => Promise<void>;
  signUp: (payload: SignupPayload) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
    token: null,
  });
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handlingUnauthorized = useRef(false);

  const clearSession = useCallback(async () => {
    setAuthToken();
    try {
      await SecureStore.deleteItemAsync(STORAGE_TOKEN_KEY);
    } catch (error) {
      console.warn("Failed to delete auth token", error);
    }
    setState({ status: "unauthenticated", user: null, token: null });
  }, []);

  const applySession = useCallback(async ({ token, admin }: AuthResponse) => {
    setAuthToken(token);
    try {
      await SecureStore.setItemAsync(STORAGE_TOKEN_KEY, token);
    } catch (error) {
      console.warn("Failed to persist auth token", error);
    }
    setState({ status: "authenticated", token, user: admin });
  }, []);

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
      const token = await SecureStore.getItemAsync(STORAGE_TOKEN_KEY);
      if (!token) {
        await clearSession();
        return;
      }

      setAuthToken(token);
      const { data } = await api.get<{ admin: Admin }>("/auth/me");
      setState({ status: "authenticated", token, user: data.admin });
    } catch (error) {
      console.warn("Failed to bootstrap session", error);
      await clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void handleUnauthorized();
    });
    return () => setUnauthorizedHandler();
  }, [handleUnauthorized]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const signIn = useCallback(
    async ({ identifier, password }: Credentials) => {
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
    async (payload: SignupPayload) => {
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
    await clearSession();
  }, [clearSession]);

  const refreshProfile = useCallback(async () => {
    if (stateRef.current.status !== "authenticated") return;
    try {
      const data = await authService.getProfile();
      setState((prev) =>
        prev.status === "authenticated"
          ? { ...prev, user: data.admin }
          : { status: "unauthenticated", user: null, token: null }
      );
    } catch (error) {
      console.warn("Failed to refresh profile", error);
    }
  }, []);

  const updateProfile = useCallback(async (payload: UpdateProfilePayload) => {
    if (stateRef.current.status !== "authenticated") return;
    try {
      const data = await authService.updateProfile(payload);
      setState((prev) =>
        prev.status === "authenticated"
          ? { ...prev, user: data.admin }
          : { status: "unauthenticated", user: null, token: null }
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
