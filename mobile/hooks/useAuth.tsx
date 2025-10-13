import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import Toast from "react-native-toast-message";
import { api, setAuthToken } from "../lib/api";

const STORAGE_TOKEN_KEY = "debit-credit-token";

type Admin = {
  _id: string;
  name: string;
  email: string;
  phone: string;
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

type AuthContextType = {
  state: AuthState;
  signIn: (credentials: Credentials) => Promise<void>;
  signUp: (payload: SignupPayload) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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

  const bootstrap = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_TOKEN_KEY);
      if (!token) {
        setAuthToken();
        setState({ status: "unauthenticated", user: null, token: null });
        return;
      }

      setAuthToken(token);
      const { data } = await api.get("/auth/me");
      setState({ status: "authenticated", token, user: data.admin });
    } catch (error) {
      console.warn("Failed to bootstrap session", error);
      setAuthToken();
      await SecureStore.deleteItemAsync(STORAGE_TOKEN_KEY);
      setState({ status: "unauthenticated", user: null, token: null });
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const signIn = useCallback(async ({ identifier, password }: Credentials) => {
    const { data } = await api.post("/auth/login", { identifier, password });
    setAuthToken(data.token);
    await SecureStore.setItemAsync(STORAGE_TOKEN_KEY, data.token);
    setState({ status: "authenticated", token: data.token, user: data.admin });
    Toast.show({ type: "success", text1: "Welcome back!" });
  }, []);

  const signUp = useCallback(async (payload: SignupPayload) => {
    const { data } = await api.post("/auth/signup", payload);
    setAuthToken(data.token);
    await SecureStore.setItemAsync(STORAGE_TOKEN_KEY, data.token);
    setState({ status: "authenticated", token: data.token, user: data.admin });
    Toast.show({ type: "success", text1: "Account created" });
  }, []);

  const signOut = useCallback(async () => {
    setAuthToken();
    await SecureStore.deleteItemAsync(STORAGE_TOKEN_KEY);
    setState({ status: "unauthenticated", user: null, token: null });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (state.status !== "authenticated") return;
    try {
      const { data } = await api.get("/auth/me");
      setState((prev) =>
        prev.status === "authenticated"
          ? { ...prev, user: data.admin }
          : { status: "unauthenticated", user: null, token: null }
      );
    } catch (error) {
      console.warn("Failed to refresh profile", error);
    }
  }, [state.status]);

  const value = useMemo(
    () => ({
      state,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [state, signIn, signUp, signOut, refreshProfile]
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
