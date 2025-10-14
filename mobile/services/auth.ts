import { api } from "../lib/api";

export type User = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  security?: {
    has_login_pin?: boolean;
    pin_updated_at?: string;
    password_updated_at?: string;
  };
  settings?: {
    currency: string;
    language: string;
    week_starts_on: number;
  };
  profile_settings?: {
    language: string;
    currency_code: string;
    currency_symbol?: string;
    locale?: string;
    date_format?: string;
    time_format?: string;
    week_starts_on?: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type LoginRequest = {
  identifier: string;
  password?: string;
  pin?: string;
};

export type SignupRequest = {
  name: string;
  email: string;
  phone?: string;
  password: string;
};

export type UpdateProfileRequest = {
  name?: string;
  email?: string;
  phone?: string;
  login_pin?: string | null;
  settings?: {
    currency?: string;
    language?: string;
    week_starts_on?: number;
  };
  profile_settings?: {
    currency_code?: string;
    currency_symbol?: string;
    language?: string;
    locale?: string;
    date_format?: string;
    time_format?: string;
    week_starts_on?: number;
  };
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt?: string;
  sessionId?: string;
};

export type AuthSessionResponse = {
  tokens: AuthTokens;
  admin: User;
};

const normalizeUser = (admin: any): User => {
  if (!admin) return admin;

  const normalized: User = {
    ...admin,
    profile_settings: admin.profile_settings,
  };

  if (!normalized.settings && normalized.profile_settings) {
    const prefs = normalized.profile_settings;
    normalized.settings = {
      currency: prefs.currency_code ?? "USD",
      language: prefs.language ?? "en",
      week_starts_on: prefs.week_starts_on ?? 1,
    };
  }

  return normalized;
};

const normalizeAuthResponse = (data: any): AuthSessionResponse => {
  if (data?.admin) {
    data.admin = normalizeUser(data.admin);
  }

  const accessToken = data?.token ?? data?.access_token;
  const refreshToken = data?.refresh_token;

  if (!accessToken || !refreshToken || !data?.admin) {
    throw new Error("Authentication response missing token information");
  }

  return {
    tokens: {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: data?.refresh_token_expires_at,
      sessionId: data?.session_id,
    },
    admin: data.admin,
  };
};

export const login = async (
  data: LoginRequest
): Promise<AuthSessionResponse> => {
  const payload: Record<string, unknown> = {};
  const identifier = data.identifier?.trim();

  if (identifier) {
    payload.identifier = identifier;
    if (identifier.includes("@")) {
      payload.email = identifier.toLowerCase();
    }
  }

  if (data.password) {
    payload.password = data.password;
  }

  if (data.pin) {
    payload.pin = data.pin;
  }

  const response = await api.post("/auth/login", payload);
  return normalizeAuthResponse(response.data);
};

export const signup = async (
  data: SignupRequest
): Promise<AuthSessionResponse> => {
  const response = await api.post("/auth/signup", data);
  return normalizeAuthResponse(response.data);
};

export const refreshSession = async (
  refreshToken: string
): Promise<AuthSessionResponse> => {
  const response = await api.post("/auth/refresh", {
    refresh_token: refreshToken,
  });
  return normalizeAuthResponse(response.data);
};

export const logout = async (refreshToken?: string | null) => {
  try {
    await api.post("/auth/logout", refreshToken ? { refresh_token: refreshToken } : {});
  } catch (error) {
    // swallow logout errors to avoid blocking client-side sign out
    console.warn("Logout request failed", error);
  }
};

export const getProfile = async (): Promise<{ admin: User }> => {
  const response = await api.get("/auth/me");
  return {
    admin: normalizeUser(response.data?.admin),
  };
};

export const updateProfile = async (
  data: UpdateProfileRequest
): Promise<{ message: string; admin: User }> => {
  const payload: Record<string, unknown> = {};

  if (data.name !== undefined) payload.name = data.name;
  if (data.email !== undefined) payload.email = data.email;
  if (data.phone !== undefined) payload.phone = data.phone;

  if (data.profile_settings) {
    payload.profile_settings = data.profile_settings;
  } else if (data.settings) {
    payload.profile_settings = {
      ...(data.settings.currency ? { currency_code: data.settings.currency } : {}),
      ...(data.settings.language ? { language: data.settings.language } : {}),
      ...(data.settings.week_starts_on !== undefined
        ? { week_starts_on: data.settings.week_starts_on }
        : {}),
    };
  }

  if (data.login_pin !== undefined) {
    payload.login_pin = data.login_pin;
  }

  const response = await api.put("/auth/me/profile", payload);
  return {
    message: response.data?.message,
    admin: normalizeUser(response.data?.admin),
  };
};
